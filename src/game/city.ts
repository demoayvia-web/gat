import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { CITY_POIS } from './data';

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface PhysicsProp {
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  avX: number;
  avZ: number;
  radius: number;
  halfH: number;
}

export type SignalColor = 'green' | 'yellow' | 'red';

export interface TrafficSignalSet {
  nsRed: THREE.MeshBasicMaterial;
  nsYellow: THREE.MeshBasicMaterial;
  nsGreen: THREE.MeshBasicMaterial;
  ewRed: THREE.MeshBasicMaterial;
  ewYellow: THREE.MeshBasicMaterial;
  ewGreen: THREE.MeshBasicMaterial;
}

export interface CityBuildResult {
  group: THREE.Group;
  colliders: BuildingCollider[];
  streetLampHeads: THREE.MeshBasicMaterial;
  roadCenters: number[];
  poiBeacons: THREE.Mesh[];
  physicsProps: PhysicsProp[];
  trafficSignals: TrafficSignalSet[];
}

export const ROAD_CENTERS = [-210, -150, -90, -30, 30, 90, 150, 210];
export const ROAD_WIDTH = 16;

// Deterministic 18-second traffic light cycle with staggered green-wave across adjacent intersections
export function getIntersectionSignal(
  elapsed: number,
  roadX: number,
  roadZ: number
): { ns: SignalColor; ew: SignalColor; waveIdx: number } {
  const gx = Math.round((roadX + 210) / 60);
  const gz = Math.round((roadZ + 210) / 60);
  const waveIdx = Math.abs(gx + gz) % 2;
  const cycle = 18.0; // 7s green + 2s yellow + 7s red + 2s red-clearance
  const t = (elapsed + waveIdx * 9.0) % cycle;
  if (t < 7.0) return { ns: 'green', ew: 'red', waveIdx };
  if (t < 9.0) return { ns: 'yellow', ew: 'red', waveIdx };
  if (t < 16.0) return { ns: 'red', ew: 'green', waveIdx };
  return { ns: 'red', ew: 'yellow', waveIdx };
}

export function buildCity(mats: MaterialLibrary): CityBuildResult {
  const group = new THREE.Group();
  const colliders: BuildingCollider[] = [];
  const poiBeacons: THREE.Mesh[] = [];
  const physicsProps: PhysicsProp[] = [];

  // 1. Continuous Ground Asphalt Base (city landmass -500..500 x -500..225)
  const groundGeo = new THREE.PlaneGeometry(1100, 760);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, mats.asphaltMaterial);
  ground.position.set(0, 0, -150);
  ground.receiveShadow = true;
  group.add(ground);

  // Port Concrete Pier Deck (z = 225..310, x = -220..220)
  const pierGeo = new THREE.BoxGeometry(440, 1.4, 95);
  const pier = new THREE.Mesh(pierGeo, mats.sidewalkMaterial);
  pier.position.set(0, -0.68, 265);
  pier.receiveShadow = true;
  group.add(pier);

  // 2. Animated Ocean Harbor Bay extending to horizon
  const waterGeo = new THREE.PlaneGeometry(1800, 1100, 48, 32);
  const water = new THREE.Mesh(waterGeo, mats.waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.55, 680);
  group.add(water);

  // 3. Road Lane Markings & Crosswalks (InstancedMesh for crisp low draw-call markings)
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const dashMatrices: THREE.Matrix4[] = [];
  const yellowMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (const rc of ROAD_CENTERS) {
    if (rc <= 180) {
      // North-South road centerlines
      for (let z = -230; z <= 200; z += 10) {
        dummy.position.set(rc, 0.025, z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(0.28, 4.2, 1);
        dummy.updateMatrix();
        yellowMatrices.push(dummy.matrix.clone());
      }
      // East-West road centerlines
      for (let x = -230; x <= 230; x += 10) {
        dummy.position.set(x, 0.025, rc);
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        dummy.scale.set(0.28, 4.2, 1);
        dummy.updateMatrix();
        yellowMatrices.push(dummy.matrix.clone());
      }
    }
  }

  // Crosswalks at major intersections
  for (const rx of ROAD_CENTERS) {
    for (const rz of ROAD_CENTERS) {
      if (rz > 160) continue;
      for (let s = -5; s <= 5; s += 2) {
        dummy.position.set(rx + s, 0.03, rz + 9.2);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(0.7, 2.4, 1);
        dummy.updateMatrix();
        dashMatrices.push(dummy.matrix.clone());
      }
    }
  }

  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const yellowInst = new THREE.InstancedMesh(quadGeo, yellowLineMat, yellowMatrices.length);
  yellowMatrices.forEach((m, i) => yellowInst.setMatrixAt(i, m));
  yellowInst.computeBoundingSphere();
  group.add(yellowInst);

  const crossInst = new THREE.InstancedMesh(quadGeo, stripeMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => crossInst.setMatrixAt(i, m));
  crossInst.computeBoundingSphere();
  group.add(crossInst);

  // 4. City Blocks, Sidewalks & Realistic Multi-Tier Architecture
  const blockCenters = [-180, -120, -60, 0, 60, 120, 180];
  const palmPositions: Array<{ x: number; z: number; scale: number }> = [];
  const lampPositions: Array<{ x: number; z: number; rotY: number }> = [];

  for (let bxIdx = 0; bxIdx < blockCenters.length; bxIdx++) {
    for (let bzIdx = 0; bzIdx < blockCenters.length; bzIdx++) {
      const cx = blockCenters[bxIdx];
      const cz = blockCenters[bzIdx];
      if (cz > 180) continue;

      // Sidewalk block platform (42x42m, raised 0.16m)
      const swGeo = new THREE.BoxGeometry(42, 0.16, 42);
      const sw = new THREE.Mesh(swGeo, mats.sidewalkMaterial);
      sw.position.set(cx, 0.08, cz);
      sw.receiveShadow = true;
      group.add(sw);

      // Streetlamps on corners
      lampPositions.push({ x: cx - 19.5, z: cz - 19.5, rotY: Math.PI / 4 });
      lampPositions.push({ x: cx + 19.5, z: cz + 19.5, rotY: -Math.PI * 0.75 });

      // Palm trees lining main avenues
      if (Math.abs(cx) <= 60 || Math.abs(cz) <= 60) {
        palmPositions.push({ x: cx - 19, z: cz, scale: 0.9 + ((bxIdx + bzIdx) % 3) * 0.12 });
        palmPositions.push({ x: cx + 19, z: cz, scale: 0.95 + (bxIdx % 2) * 0.15 });
      }

      // Skip building on Central Plaza / Spawn Park at (0, 0) so Gord spawns in a grand open intersection/plaza!
      if (cx === 0 && cz === 0) {
        // Architectural Central Monument Plaza
        const plazaDisc = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.5, 0.25, 32), mats.carbonFiberMat);
        plazaDisc.position.set(0, 0.2, 0);
        plazaDisc.receiveShadow = true;
        group.add(plazaDisc);
        continue;
      }

      // Iconic NEXORUM Tower at (0, -120)
      if (cx === 0 && cz === -120) {
        const podium = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 34), mats.storefrontMat);
        podium.position.set(cx, 7.16, cz);
        podium.castShadow = true;
        podium.receiveShadow = true;

        const towerMid = new THREE.Mesh(new THREE.BoxGeometry(26, 78, 26), mats.skyScraperMats[0]);
        towerMid.position.set(cx, 14 + 39, cz);
        towerMid.castShadow = true;

        const towerCrown = new THREE.Mesh(new THREE.BoxGeometry(17, 36, 17), mats.skyScraperMats[2]);
        towerCrown.position.set(cx, 92 + 18, cz);
        towerCrown.castShadow = true;

        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.4, 24, 12), mats.cyberGlowCyanMat);
        spire.position.set(cx, 128 + 12, cz);

        const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), mats.nexorumSignMat);
        sign.position.set(cx, 72, cz + 13.2);

        const signBack = sign.clone();
        signBack.position.z = cz - 13.2;
        signBack.rotation.y = Math.PI;

        group.add(podium, towerMid, towerCrown, spire, sign, signBack);
        colliders.push({ minX: cx - 17.5, maxX: cx + 17.5, minZ: cz - 17.5, maxZ: cz + 17.5, maxY: 130 });
        continue;
      }

      // Billboard Plaza Building at (60, -60) facing the central street
      const seed = Math.abs(cx * 31 + cz * 17);
      const isDowntown = Math.abs(cx) <= 120 && Math.abs(cz) <= 120;

      if (isDowntown) {
        const w = 26 + (seed % 8);
        const d = 26 + ((seed >> 2) % 8);
        const h1 = 36 + (seed % 46);
        const h2 = 12 + ((seed >> 3) % 24);
        const mat = mats.skyScraperMats[seed % mats.skyScraperMats.length];

        // Ground-floor commercial podium
        const base = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 7.5, d + 2), mats.storefrontMat);
        base.position.set(cx, 3.9, cz);
        base.castShadow = true;
        base.receiveShadow = true;

        // Main tower shaft
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), mat);
        shaft.position.set(cx, 7.6 + h1 / 2, cz);
        shaft.castShadow = true;
        shaft.receiveShadow = true;

        // Setback upper tier + rooftop mechanical penthouse
        const topTier = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h2, d * 0.72), mat);
        topTier.position.set(cx, 7.6 + h1 + h2 / 2, cz);
        topTier.castShadow = true;

        const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 3.2, d * 0.4), mats.titaniumCyberMat);
        roofCap.position.set(cx, 7.6 + h1 + h2 + 1.6, cz);

        group.add(base, shaft, topTier, roofCap);

        if (cx === 60 && cz === -60) {
          const bb = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), mats.billboardMat);
          bb.position.set(cx, 16, cz + d / 2 + 1.4);
          group.add(bb);
        }

        colliders.push({
          minX: cx - w / 2 - 1.2,
          maxX: cx + w / 2 + 1.2,
          minZ: cz - d / 2 - 1.2,
          maxZ: cz + d / 2 + 1.2,
          maxY: 7.6 + h1 + h2,
        });
      } else {
        // Residential / Commercial Mid-Rise District (2 buildings per block)
        const mat = mats.residentialMats[seed % mats.residentialMats.length];
        const w = 30;
        const d = 28;
        const h = 15 + (seed % 20);

        const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 5.2, d + 1.5), mats.storefrontMat);
        podium.position.set(cx, 2.75, cz);
        podium.castShadow = true;
        podium.receiveShadow = true;

        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.set(cx, 5.35 + h / 2, cz);
        body.castShadow = true;
        body.receiveShadow = true;

        const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.9, d + 0.8), mats.carbonFiberMat);
        cornice.position.set(cx, 5.35 + h + 0.45, cz);

        group.add(podium, body, cornice);
        colliders.push({
          minX: cx - w / 2 - 1,
          maxX: cx + w / 2 + 1,
          minZ: cz - d / 2 - 1,
          maxZ: cz + d / 2 + 1,
          maxY: 5.35 + h,
        });
      }
    }
  }

  // 5. Elevated Highway Overpass Bridge spanning along z = -90 (east-west)
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(360, 1.2, 11), mats.sidewalkMaterial);
  bridgeDeck.position.set(0, 8.6, -90);
  bridgeDeck.castShadow = true;
  bridgeDeck.receiveShadow = true;
  group.add(bridgeDeck);
  for (let px = -150; px <= 150; px += 60) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 8.6, 12), mats.sidewalkMaterial);
    pillar.position.set(px, 4.3, -90);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // 6. Port District Shipping Containers, Cranes & Helipad/Runway
  const containerColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0xb45309, 0x334155];
  const containerPositions = [
    [-110, 240], [-92, 240], [-110, 250], [-45, 252], [-28, 252],
  ];
  containerPositions.forEach(([x, z], idx) => {
    const cMat = new THREE.MeshStandardMaterial({
      color: containerColors[idx % containerColors.length],
      roughness: 0.65,
      metalness: 0.35,
    });
    const cont = new THREE.Mesh(new THREE.BoxGeometry(12, 3.4, 3.6), cMat);
    cont.position.set(x, 1.72, z);
    cont.castShadow = true;
    cont.receiveShadow = true;
    group.add(cont);
    colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 1.8, maxZ: z + 1.8, maxY: 3.4 });
  });

  // Port Helipad Circle (x=55, z=265)
  const helipad = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11.4, 0.25, 32),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  helipad.position.set(55, 0.12, 265);
  const heliRing = new THREE.Mesh(
    new THREE.RingGeometry(8.5, 9.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  heliRing.rotation.x = -Math.PI / 2;
  heliRing.position.set(55, 0.27, 265);
  group.add(helipad, heliRing);

  // Port Jet Runway Markings (x = 95..210, z = 265)
  const runway = new THREE.Mesh(new THREE.BoxGeometry(130, 0.22, 18), mats.asphaltMaterial);
  runway.position.set(150, 0.1, 265);
  runway.receiveShadow = true;
  group.add(runway);

  // 7. Instanced Palm Trees (Trunks + Fronds)
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 7.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4636, roughness: 0.9 });
  const frondGeo = new THREE.ConeGeometry(2.6, 2.2, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x224926, roughness: 0.75 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);
  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length);
  palmPositions.forEach((p, i) => {
    dummy.position.set(p.x, 3.75 * p.scale, p.z);
    dummy.rotation.set(0, i * 1.1, 0.04);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, 7.5 * p.scale, p.z);
    dummy.rotation.set(Math.PI, i * 0.7, 0);
    dummy.scale.set(p.scale * 1.15, p.scale * 0.7, p.scale * 1.15);
    dummy.updateMatrix();
    frondInst.setMatrixAt(i, dummy.matrix);
  });
  trunkInst.computeBoundingSphere();
  frondInst.computeBoundingSphere();
  group.add(trunkInst, frondInst);

  // 8. Instanced Modern Streetlamps
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.13, 6.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.35 });
  const lampHeadGeo = new THREE.BoxGeometry(0.75, 0.16, 0.32);
  const streetLampHeads = new THREE.MeshBasicMaterial({ color: 0xffe4b5 });

  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const headInst = new THREE.InstancedMesh(lampHeadGeo, streetLampHeads, lampPositions.length);
  lampPositions.forEach((lp, i) => {
    dummy.position.set(lp.x, 3.1, lp.z);
    dummy.rotation.set(0, lp.rotY, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lp.x + Math.sin(lp.rotY) * 0.45, 6.2, lp.z + Math.cos(lp.rotY) * 0.45);
    dummy.rotation.set(0, lp.rotY, 0);
    dummy.updateMatrix();
    headInst.setMatrixAt(i, dummy.matrix);
  });
  poleInst.computeBoundingSphere();
  headInst.computeBoundingSphere();
  group.add(poleInst, headInst);

  // 9. POI Interaction Beacons (Hospital, Police, Dealership, Clinic, Shop, Port, Jobs)
  for (const poi of CITY_POIS) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.85, 28),
      new THREE.MeshBasicMaterial({ color: poi.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(poi.x, 0.18, poi.z);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.65, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: poi.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(poi.x, 4.5, poi.z);
    group.add(ring, beam);
    poiBeacons.push(ring);
  }

  // 10. Synchronized 4-Way Intersection Traffic Lights (NS & EW 3-Bulb Signals)
  const tlPostMat = new THREE.MeshStandardMaterial({ color: 0x1e242c, metalness: 0.8, roughness: 0.35 });
  const createSignalMaterials = (): TrafficSignalSet => ({
    nsRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    nsYellow: new THREE.MeshBasicMaterial({ color: 0x3b2f0b }),
    nsGreen: new THREE.MeshBasicMaterial({ color: 0x0b3b1e }),
    ewRed: new THREE.MeshBasicMaterial({ color: 0x3b0b0b }),
    ewYellow: new THREE.MeshBasicMaterial({ color: 0x3b2f0b }),
    ewGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
  });
  const trafficSignals: TrafficSignalSet[] = [createSignalMaterials(), createSignalMaterials()];
  const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
  const housingGeo = new THREE.BoxGeometry(0.36, 1.02, 0.32);

  const signalIntersections = [-150, -90, -30, 30, 90, 150];
  for (const ix of signalIntersections) {
    for (const iz of signalIntersections) {
      const gx = Math.round((ix + 210) / 60);
      const gz = Math.round((iz + 210) / 60);
      const waveIdx = Math.abs(gx + gz) % 2;
      const sig = trafficSignals[waveIdx];

      // North-South Facing Signal Mast (NW corner controlling Z-axis lanes)
      const postNS = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.2, 8), tlPostMat);
      postNS.position.set(ix - 8.6, 2.6, iz - 8.6);
      const armNS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.13, 0.13), tlPostMat);
      armNS.position.set(ix - 6.5, 5.1, iz - 8.6);
      const boxNS = new THREE.Mesh(housingGeo, tlPostMat);
      boxNS.position.set(ix - 4.7, 4.75, iz - 8.6);

      const nsR = new THREE.Mesh(bulbGeo, sig.nsRed);
      nsR.position.set(ix - 4.7, 5.05, iz - 8.42);
      const nsY = new THREE.Mesh(bulbGeo, sig.nsYellow);
      nsY.position.set(ix - 4.7, 4.75, iz - 8.42);
      const nsG = new THREE.Mesh(bulbGeo, sig.nsGreen);
      nsG.position.set(ix - 4.7, 4.45, iz - 8.42);
      // Mirror bulbs on opposite face so southbound & northbound drivers both see signals
      const nsR2 = nsR.clone();
      nsR2.position.z = iz - 8.78;
      const nsY2 = nsY.clone();
      nsY2.position.z = iz - 8.78;
      const nsG2 = nsG.clone();
      nsG2.position.z = iz - 8.78;

      // East-West Facing Signal Mast (SE corner controlling X-axis lanes)
      const postEW = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.2, 8), tlPostMat);
      postEW.position.set(ix + 8.6, 2.6, iz + 8.6);
      const armEW = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 4.2), tlPostMat);
      armEW.position.set(ix + 8.6, 5.1, iz + 6.5);
      const boxEW = new THREE.Mesh(housingGeo, tlPostMat);
      boxEW.position.set(ix + 8.6, 4.75, iz + 4.7);

      const ewR = new THREE.Mesh(bulbGeo, sig.ewRed);
      ewR.position.set(ix + 8.42, 5.05, iz + 4.7);
      const ewY = new THREE.Mesh(bulbGeo, sig.ewYellow);
      ewY.position.set(ix + 8.42, 4.75, iz + 4.7);
      const ewG = new THREE.Mesh(bulbGeo, sig.ewGreen);
      ewG.position.set(ix + 8.42, 4.45, iz + 4.7);
      const ewR2 = ewR.clone();
      ewR2.position.x = ix + 8.78;
      const ewY2 = ewY.clone();
      ewY2.position.x = ix + 8.78;
      const ewG2 = ewG.clone();
      ewG2.position.x = ix + 8.78;

      group.add(
        postNS, armNS, boxNS, nsR, nsY, nsG, nsR2, nsY2, nsG2,
        postEW, armEW, boxEW, ewR, ewY, ewG, ewR2, ewY2, ewG2
      );
    }
  }

  // Vertical Neon Street Signs on commercial avenues
  const neonPlacements = [
    [-42, -55, 0], [42, -55, 1], [-42, 65, 2], [42, 65, 3], [-102, -55, 0], [102, 55, 1],
  ];
  for (const [nx, nz, idx] of neonPlacements) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 5.4, 1.8),
      mats.verticalNeonMats[idx % mats.verticalNeonMats.length]
    );
    sign.position.set(nx, 7.2, nz);
    group.add(sign);
  }

  // 11. Chaos Physics Dynamic Props (Knockable Fire Hydrants, Traffic Cones, Port Crates)
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.38, metalness: 0.45 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.85 });

  const hydrantCoords = [
    [-20, -18], [20, -18], [-20, 42], [20, 42], [-80, -18], [80, -18], [-80, 42], [80, 42],
  ];
  for (const [hx, hz] of hydrantCoords) {
    const hg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 10), hydrantMat);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), hydrantMat);
    cap.position.y = 0.36;
    hg.add(body, cap);
    hg.position.set(hx, 0.52, hz);
    hg.castShadow = true;
    group.add(hg);
    physicsProps.push({
      mesh: hg,
      x: hx,
      y: 0.52,
      z: hz,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      rz: 0,
      avX: 0,
      avZ: 0,
      radius: 0.3,
      halfH: 0.36,
    });
  }

  for (let i = 0; i < 16; i++) {
    const cx = -24 + (i % 4) * 16;
    const cz = i < 8 ? -20 : 218;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 10), coneMat);
    cone.position.set(cx, 0.33, cz);
    cone.castShadow = true;
    group.add(cone);
    physicsProps.push({
      mesh: cone,
      x: cx,
      y: 0.33,
      z: cz,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      rz: 0,
      avX: 0,
      avZ: 0,
      radius: 0.26,
      halfH: 0.33,
    });
  }

  for (let i = 0; i < 8; i++) {
    const wx = -20 + i * 6;
    const wz = 242;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat);
    crate.position.set(wx, 0.55, wz);
    crate.castShadow = true;
    group.add(crate);
    physicsProps.push({
      mesh: crate,
      x: wx,
      y: 0.55,
      z: wz,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      rz: 0,
      avX: 0,
      avZ: 0,
      radius: 0.65,
      halfH: 0.55,
    });
  }

  return {
    group,
    colliders,
    streetLampHeads,
    roadCenters: ROAD_CENTERS,
    poiBeacons,
    physicsProps,
    trafficSignals,
  };
}
