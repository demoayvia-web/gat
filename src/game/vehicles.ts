import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { VehicleKind } from './types';

export interface VehicleInstance {
  id: string;
  kind: VehicleKind;
  name: string;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[]; // front-left, front-right, rear-left, rear-right (or front, rear for moto)
  frontSteerPivots: THREE.Group[];
  steeringWheel?: THREE.Group;
  leftDoor?: THREE.Group;
  mainRotor?: THREE.Group;
  tailRotor?: THREE.Group;
  afterburnerGlow?: THREE.Mesh[];
  policeLights?: { red: THREE.Mesh; blue: THREE.Mesh };
  taillightMat?: THREE.MeshStandardMaterial;
  turnSignals?: { leftMat: THREE.MeshStandardMaterial; rightMat: THREE.MeshStandardMaterial };
  headlightSpot?: THREE.SpotLight;
  hullMesh?: THREE.Mesh;
  hullRestPositions?: Float32Array;
  paintMat?: THREE.MeshPhysicalMaterial;
  cabinGlass?: THREE.Mesh;
  cabinGlassMat?: THREE.MeshPhysicalMaterial;
  frontSplitter?: THREE.Mesh;
  rearSpoiler?: THREE.Group;
  headlightMats?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];
  damageZones: { front: number; rear: number; left: number; right: number };
  // Physics state
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  steerAngle: number;
  mass: number;
  health: number;
  maxHealth: number;
  maxSpeed: number; // m/s
  accel: number;
  doorOpenProgress: number;
  isTraffic: boolean;
  isPolice: boolean;
  trafficDirX: number;
  trafficDirZ: number;
  driverOccupied: boolean;
  policeRole?: 'patrol' | 'pursuit' | 'interceptor' | 'roadblock';
  patrolTargetYaw?: number;
  patrolTurnCooldown?: number;
  turnSignal?: 'none' | 'left' | 'right' | 'hazard';
  aiPlannedTurn?: 'straight' | 'left' | 'right';
  aiPlanKey?: string;
  aiLaneDodgeOffset?: number;
  aiPanicTimer?: number;
  aiStuckTimer?: number;
  aiReverseTimer?: number;
  aiReverseDir?: number;
  aiBlockSign?: number;
  aiBlockAngle?: number;
  aiSpawnedForChase?: boolean;
  aiDeployTimer?: number;
  smokeCooldown?: number;
  crashJolt?: number;
}

function createWheel(radius: number, width: number, mats: MaterialLibrary): THREE.Group {
  const wg = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, mats.tireMat);
  tire.castShadow = true;
  wg.add(tire);

  // Alloy rim & spokes
  const rimGeo = new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width * 1.03, 18);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, mats.chromeMat);
  wg.add(rim);

  const hubGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.06, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, mats.carbonFiberMat);
  wg.add(hub);

  // 5 spoke bars
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, radius * 0.11, radius * 0.56), spokeMat);
    spoke.position.set(0, Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3);
    spoke.rotation.x = a;
    wg.add(spoke);
  }

  return wg;
}

function createPlateTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Oxanium, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildVehicle(
  id: string,
  kind: VehicleKind,
  name: string,
  colorHex: string,
  mats: MaterialLibrary,
  opts: { isTraffic?: boolean; isPolice?: boolean; maxSpeedKmh?: number } = {}
): VehicleInstance {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.82,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.85,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.6,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
  });

  const leftSignalMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
  });
  const rightSignalMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
  });
  let turnSignals: { leftMat: THREE.MeshStandardMaterial; rightMat: THREE.MeshStandardMaterial } | undefined;

  const wheels: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  let steeringWheel: THREE.Group | undefined;
  let leftDoor: THREE.Group | undefined;
  let mainRotor: THREE.Group | undefined;
  let tailRotor: THREE.Group | undefined;
  let afterburnerGlow: THREE.Mesh[] | undefined;
  let policeLights: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
  let hullMesh: THREE.Mesh | undefined;
  let hullRestPositions: Float32Array | undefined;
  let cabinGlass: THREE.Mesh | undefined;
  let cabinGlassMat: THREE.MeshPhysicalMaterial | undefined;
  let frontSplitter: THREE.Mesh | undefined;
  let rearSpoiler: THREE.Group | undefined;
  let headlightMats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | undefined;

  if (kind === 'helicopter') {
    // Sleek sculpted helicopter fuselage
    const hullPts = [
      new THREE.Vector2(0.01, -2.5),
      new THREE.Vector2(0.72, -1.6),
      new THREE.Vector2(0.95, -0.4),
      new THREE.Vector2(0.88, 1.1),
      new THREE.Vector2(0.42, 2.2),
      new THREE.Vector2(0.01, 2.6),
    ];
    const hullGeo = new THREE.LatheGeometry(hullPts, 20);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.scale(1.0, 0.92, 1.0);
    const hull = new THREE.Mesh(hullGeo, paintMat);
    hull.position.set(0, 1.45, 0);
    hull.castShadow = true;
    bodyGroup.add(hull);

    // Panoramic glass cockpit canopy
    const canopyGeo = new THREE.SphereGeometry(0.86, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    canopyGeo.scale(0.94, 0.9, 1.45);
    const canopy = new THREE.Mesh(canopyGeo, mats.glassMat);
    canopy.position.set(0, 1.68, 0.72);
    canopy.rotation.x = 0.24;
    bodyGroup.add(canopy);

    // Tail boom & vertical fin
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 4.2, 14), paintMat);
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.set(0, 1.62, -3.5);
    tailBoom.castShadow = true;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.75), mats.carbonFiberMat);
    fin.position.set(0, 2.05, -5.35);
    fin.rotation.x = -0.35;
    bodyGroup.add(tailBoom, fin);

    // Landing skids
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.6, 10), mats.titaniumCyberMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.06, 0.1);
      const strutF = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), mats.titaniumCyberMat);
      strutF.position.set(sx * 0.85, 0.48, 0.85);
      strutF.rotation.z = sx > 0 ? 0.28 : -0.28;
      const strutR = strutF.clone();
      strutR.position.z = -0.75;
      bodyGroup.add(skid, strutF, strutR);
    }

    // Main Rotor Mast & 4 Aerodynamic Blades
    mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.55, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 12), mats.titaniumCyberMat);
    mainRotor.add(mast);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 4.4), mats.carbonFiberMat);
      blade.position.y = 0.2;
      blade.rotation.y = (i * Math.PI) / 2;
      mainRotor.add(blade);
    }
    bodyGroup.add(mainRotor);

    tailRotor = new THREE.Group();
    tailRotor.position.set(0.14, 2.15, -5.4);
    for (let i = 0; i < 2; i++) {
      const tb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.09), mats.carbonFiberMat);
      tb.rotation.x = (i * Math.PI) / 2;
      tailRotor.add(tb);
    }
    bodyGroup.add(tailRotor);
  } else if (kind === 'jet') {
    // Supersonic Fighter Jet NX-22 Peregrine
    const fusePts = [
      new THREE.Vector2(0.01, -4.4),
      new THREE.Vector2(0.55, -3.5),
      new THREE.Vector2(0.75, -1.0),
      new THREE.Vector2(0.68, 2.2),
      new THREE.Vector2(0.32, 4.2),
      new THREE.Vector2(0.01, 5.2),
    ];
    const fuseGeo = new THREE.LatheGeometry(fusePts, 20);
    fuseGeo.rotateX(Math.PI / 2);
    fuseGeo.scale(1.18, 0.68, 1.0);
    const fuse = new THREE.Mesh(fuseGeo, paintMat);
    fuse.position.set(0, 1.25, 0);
    fuse.castShadow = true;
    bodyGroup.add(fuse);

    // Swept Delta Wings (ExtrudeGeometry)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.45, 1.4);
    wingShape.lineTo(4.2, -1.8);
    wingShape.lineTo(4.2, -2.5);
    wingShape.lineTo(0.5, -2.7);
    wingShape.closePath();
    const wingGeoR = new THREE.ExtrudeGeometry(wingShape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.04 });
    wingGeoR.rotateX(-Math.PI / 2);
    const wingR = new THREE.Mesh(wingGeoR, paintMat);
    wingR.position.set(0, 1.18, 0);
    wingR.castShadow = true;
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    bodyGroup.add(wingR, wingL);

    // Twin canted vertical stabilizers
    for (const sx of [-0.65, 0.65]) {
      const stab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 1.4), paintMat);
      stab.position.set(sx, 1.85, -3.2);
      stab.rotation.z = sx > 0 ? -0.25 : 0.25;
      stab.rotation.x = -0.3;
      bodyGroup.add(stab);
    }

    // Bubble canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), mats.glassMat);
    canopy.scale.set(0.85, 0.72, 2.3);
    canopy.position.set(0, 1.62, 1.45);
    bodyGroup.add(canopy);

    // Landing gear
    for (const [gx, gz] of [[0, 2.6], [-1.3, -1.4], [1.3, -1.4]]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), mats.titaniumCyberMat);
      strut.position.set(gx, 0.55, gz);
      const w = createWheel(0.28, 0.16, mats);
      w.position.set(gx, 0.28, gz);
      wheels.push(w);
      bodyGroup.add(strut, w);
    }

    // Twin afterburners
    afterburnerGlow = [];
    const abMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
    for (const ex of [-0.34, 0.34]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.55, 14), mats.titaniumCyberMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(ex, 1.22, -4.35);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 12), abMat);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(ex, 1.22, -5.2);
      flame.visible = false;
      afterburnerGlow.push(flame);
      bodyGroup.add(nozzle, flame);
    }
  } else if (kind === 'motorcycle') {
    // Sleek Sport Motorcycle
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 1.35), mats.carbonFiberMat);
    frame.position.set(0, 0.62, 0);
    frame.castShadow = true;

    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), paintMat);
    tank.scale.set(0.78, 0.65, 1.45);
    tank.position.set(0, 0.88, 0.22);

    const fairing = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.78, 14), paintMat);
    fairing.rotation.x = Math.PI / 2.4;
    fairing.position.set(0, 0.84, 0.68);

    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.04), mats.glassMat);
    windscreen.position.set(0, 1.03, 0.58);
    windscreen.rotation.x = -0.7;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.58), mats.leatherJacketMat);
    seat.position.set(0, 0.78, -0.32);

    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), headlightMat);
    headlight.position.set(0, 0.82, 0.92);
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), taillightMat);
    taillight.position.set(0, 0.8, -0.82);

    // Motorcycle Amber Turn Signals (+X Left, -X Right)
    const motoSigGeo = new THREE.BoxGeometry(0.07, 0.045, 0.05);
    const sigFL = new THREE.Mesh(motoSigGeo, leftSignalMat);
    sigFL.position.set(0.2, 0.8, 0.72);
    const sigRL = new THREE.Mesh(motoSigGeo, leftSignalMat);
    sigRL.position.set(0.15, 0.78, -0.8);
    const sigFR = new THREE.Mesh(motoSigGeo, rightSignalMat);
    sigFR.position.set(-0.2, 0.8, 0.72);
    const sigRR = new THREE.Mesh(motoSigGeo, rightSignalMat);
    sigRR.position.set(-0.15, 0.78, -0.8);
    turnSignals = { leftMat: leftSignalMat, rightMat: rightSignalMat };

    bodyGroup.add(frame, tank, fairing, windscreen, seat, headlight, taillight, sigFL, sigRL, sigFR, sigRR);

    const steerPivot = new THREE.Group();
    steerPivot.position.set(0, 0.35, 0.78);
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 8), mats.chromeMat);
    forkL.position.set(-0.1, 0.32, -0.1);
    forkL.rotation.x = -0.35;
    const forkR = forkL.clone();
    forkR.position.x = 0.1;
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), mats.carbonFiberMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.66, -0.2);
    const fw = createWheel(0.34, 0.14, mats);
    steerPivot.add(forkL, forkR, handlebar, fw);
    bodyGroup.add(steerPivot);
    frontSteerPivots.push(steerPivot);
    wheels.push(fw);

    const rw = createWheel(0.35, 0.19, mats);
    rw.position.set(0, 0.35, -0.76);
    bodyGroup.add(rw);
    wheels.push(rw);
  } else {
    // 4-Wheeled Cars: Supercar, Sedan, SUV, Police Interceptor
    const isSuper = kind === 'supercar';
    const isSuv = kind === 'suv';
    const isPolice = kind === 'police' || Boolean(opts.isPolice);

    const length = isSuper ? 4.55 : isSuv ? 4.65 : 4.5;
    const width = isSuper ? 2.02 : isSuv ? 2.04 : 1.92;
    const height = isSuper ? 1.18 : isSuv ? 1.66 : 1.38;

    // Sculpted side profile with subdivided segments along hood, roof, rocker & rear for realistic mesh crumpling
    const profile = new THREE.Shape();
    const halfL = length / 2;
    if (isSuper) {
      profile.moveTo(-halfL, 0.24);
      profile.lineTo(-halfL * 0.5, 0.22);
      profile.lineTo(0, 0.21);
      profile.lineTo(halfL * 0.5, 0.2);
      profile.lineTo(halfL - 0.12, 0.2);
      profile.quadraticCurveTo(halfL + 0.08, 0.36, halfL - 0.08, 0.56);
      profile.lineTo(halfL * 0.72, 0.64);
      profile.lineTo(halfL * 0.44, 0.72); // sculpted hood
      profile.lineTo(halfL * 0.26, height * 0.84);
      profile.lineTo(halfL * 0.1, height); // swept windshield
      profile.lineTo(-halfL * 0.15, height);
      profile.lineTo(-halfL * 0.38, height - 0.02); // roofline
      profile.lineTo(-halfL * 0.64, 0.96);
      profile.lineTo(-halfL * 0.88, 0.82); // fastback engine deck
      profile.lineTo(-halfL, 0.66);
      profile.closePath();
    } else if (isSuv) {
      profile.moveTo(-halfL, 0.32);
      profile.lineTo(-halfL * 0.45, 0.32);
      profile.lineTo(0, 0.32);
      profile.lineTo(halfL * 0.45, 0.32);
      profile.lineTo(halfL - 0.08, 0.32);
      profile.lineTo(halfL, 0.55);
      profile.lineTo(halfL, 0.78);
      profile.lineTo(halfL * 0.72, 0.88);
      profile.lineTo(halfL * 0.45, 0.96);
      profile.lineTo(halfL * 0.22, height);
      profile.lineTo(-halfL * 0.3, height);
      profile.lineTo(-halfL * 0.82, height);
      profile.lineTo(-halfL * 0.92, 1.28);
      profile.lineTo(-halfL, 0.92);
      profile.closePath();
    } else {
      // Sedan / Police Interceptor
      profile.moveTo(-halfL, 0.26);
      profile.lineTo(-halfL * 0.45, 0.26);
      profile.lineTo(0, 0.26);
      profile.lineTo(halfL * 0.45, 0.26);
      profile.lineTo(halfL - 0.06, 0.26);
      profile.lineTo(halfL, 0.45);
      profile.lineTo(halfL, 0.64);
      profile.lineTo(halfL * 0.72, 0.74);
      profile.lineTo(halfL * 0.45, 0.82);
      profile.lineTo(halfL * 0.3, height * 0.82);
      profile.lineTo(halfL * 0.16, height);
      profile.lineTo(-halfL * 0.14, height);
      profile.lineTo(-halfL * 0.42, height);
      profile.lineTo(-halfL * 0.6, 1.06);
      profile.lineTo(-halfL * 0.76, 0.88);
      profile.lineTo(-halfL, 0.78);
      profile.closePath();
    }

    const bodyGeo = new THREE.ExtrudeGeometry(profile, {
      depth: width - 0.14,
      steps: 4,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.05,
      bevelSegments: 4,
    });
    // Center along X and orient so +Z is forward!
    bodyGeo.translate(0, 0, -(width - 0.14) / 2);
    bodyGeo.rotateY(-Math.PI / 2);
    bodyGeo.computeVertexNormals();
    hullRestPositions = new Float32Array(bodyGeo.attributes.position.array as Float32Array);

    const mainHull = new THREE.Mesh(bodyGeo, paintMat);
    mainHull.castShadow = true;
    mainHull.receiveShadow = true;
    hullMesh = mainHull;
    bodyGroup.add(mainHull);

    // Police Black & White doors/roof accent
    if (isPolice) {
      const whiteDoor = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.01, 0.52, length * 0.42),
        new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.2, clearcoat: 0.9 })
      );
      whiteDoor.position.set(0, 0.62, 0.05);
      bodyGroup.add(whiteDoor);

      // Police Roof Lightbar
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.06, 0.24), mats.carbonFiberMat);
      barBase.position.set(0, height + 0.06, -0.15);
      const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 3.0 });
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 3.0 });
      const redL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.22), redMat);
      redL.position.set(-0.3, height + 0.1, -0.15);
      const blueL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.22), blueMat);
      blueL.position.set(0.3, height + 0.1, -0.15);
      bodyGroup.add(barBase, redL, blueL);
      policeLights = { red: redL, blue: blueL };
    }

    // Tinted Cabin Windshield & Side Glass (per-car material so cracks/shattering apply per vehicle)
    cabinGlassMat = mats.glassMat.clone();
    cabinGlass = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.84, height * 0.36, length * 0.48),
      cabinGlassMat
    );
    cabinGlass.position.set(0, height * 0.78, -0.18);
    bodyGroup.add(cabinGlass);

    // Visible Interior (Dashboard, Steering Wheel, Seats)
    const dash = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.22, 0.32), mats.carbonFiberMat);
    dash.position.set(0, 0.76, 0.56);
    bodyGroup.add(dash);

    steeringWheel = new THREE.Group();
    steeringWheel.position.set(-0.38, 0.82, 0.34);
    const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 20), mats.carbonFiberMat);
    const swSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.02), mats.titaniumCyberMat);
    steeringWheel.add(swRing, swSpoke);
    steeringWheel.rotation.x = -0.35;
    bodyGroup.add(steeringWheel);

    // Opening Left Door Accent
    leftDoor = new THREE.Group();
    leftDoor.position.set(-width / 2 - 0.01, 0.56, 0.45);
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 1.05), paintMat);
    doorPanel.position.set(0, 0, -0.52);
    leftDoor.add(doorPanel);
    bodyGroup.add(leftDoor);

    // Front Splitter, Carbon Rear Wing (Supercar), Exhausts & License Plate
    frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.07, 0.35), mats.carbonFiberMat);
    frontSplitter.position.set(0, 0.21, halfL - 0.08);
    bodyGroup.add(frontSplitter);

    if (isSuper) {
      rearSpoiler = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.05, 0.28), mats.carbonFiberMat);
      wing.position.set(0, 1.02, -halfL + 0.16);
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.18), mats.carbonFiberMat);
      pylonL.position.set(-0.55, 0.9, -halfL + 0.18);
      const pylonR = pylonL.clone();
      pylonR.position.x = 0.55;
      rearSpoiler.add(wing, pylonL, pylonR);
      bodyGroup.add(rearSpoiler);
    }

    // Independent Left/Right LED Headlights (Left = +X, Right = -X)
    const hlLeftMat = headlightMat.clone();
    const hlRightMat = headlightMat.clone();
    headlightMats = [hlLeftMat, hlRightMat];
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.08), hlLeftMat);
    hlLeft.position.set(width * 0.34, 0.55, halfL - 0.02);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.08), hlRightMat);
    hlRight.position.set(-width * 0.34, 0.55, halfL - 0.02);
    bodyGroup.add(hlLeft, hlRight);

    const sigGeo = new THREE.BoxGeometry(0.14, 0.08, 0.09);
    const sigFL = new THREE.Mesh(sigGeo, leftSignalMat);
    sigFL.position.set(width * 0.45, 0.54, halfL - 0.03);
    const sigRL = new THREE.Mesh(sigGeo, leftSignalMat);
    sigRL.position.set(width * 0.45, 0.64, -halfL - 0.015);
    const sigFR = new THREE.Mesh(sigGeo, rightSignalMat);
    sigFR.position.set(-width * 0.45, 0.54, halfL - 0.03);
    const sigRR = new THREE.Mesh(sigGeo, rightSignalMat);
    sigRR.position.set(-width * 0.45, 0.64, -halfL - 0.015);
    turnSignals = { leftMat: leftSignalMat, rightMat: rightSignalMat };
    bodyGroup.add(sigFL, sigRL, sigFR, sigRR);

    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, 0.075, 0.06), taillightMat);
    tailBar.position.set(0, 0.64, -halfL - 0.01);
    bodyGroup.add(tailBar);

    const plateMat = new THREE.MeshStandardMaterial({
      map: createPlateTexture(isPolice ? 'NCPD-911' : 'NEXORUM'),
      roughness: 0.4,
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.12), plateMat);
    plate.position.set(0, 0.42, -halfL - 0.02);
    plate.rotation.y = Math.PI;
    bodyGroup.add(plate);

    // 4 Realistic Wheels with steering front pivots
    const wheelR = isSuv ? 0.42 : 0.35;
    const wheelW = isSuper ? 0.3 : 0.25;
    const trackX = width * 0.46;
    const axleFrontZ = length * 0.31;
    const axleRearZ = -length * 0.31;

    for (const sx of [-trackX, trackX]) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(sx, wheelR, axleFrontZ);
      const fw = createWheel(wheelR, wheelW, mats);
      steerPivot.add(fw);
      root.add(steerPivot);
      frontSteerPivots.push(steerPivot);
      wheels.push(fw);
    }
    for (const sx of [-trackX, trackX]) {
      const rw = createWheel(wheelR, wheelW, mats);
      rw.position.set(sx, wheelR, axleRearZ);
      root.add(rw);
      wheels.push(rw);
    }
  }

  const maxSpeedMs = (opts.maxSpeedKmh ?? (kind === 'jet' ? 160 : kind === 'helicopter' ? 68 : kind === 'supercar' ? 86 : 56)) / 3.6;
  const isPoliceVeh = kind === 'police' || Boolean(opts.isPolice);
  const vehMass =
    kind === 'helicopter'
      ? 3600
      : kind === 'jet'
      ? 8500
      : kind === 'suv'
      ? 2450
      : isPoliceVeh
      ? 2350
      : kind === 'motorcycle'
      ? 320
      : kind === 'supercar'
      ? 1480
      : 1550;

  return {
    id,
    kind,
    name,
    root,
    bodyGroup,
    wheels,
    frontSteerPivots,
    steeringWheel,
    leftDoor,
    mainRotor,
    tailRotor,
    afterburnerGlow,
    policeLights,
    taillightMat,
    turnSignals,
    hullMesh,
    hullRestPositions,
    paintMat,
    cabinGlass,
    cabinGlassMat,
    frontSplitter,
    rearSpoiler,
    headlightMats,
    damageZones: { front: 0, rear: 0, left: 0, right: 0 },
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    speed: 0,
    steerAngle: 0,
    mass: vehMass,
    health: kind === 'suv' || isPoliceVeh ? 200 : 120,
    maxHealth: kind === 'suv' || isPoliceVeh ? 200 : 120,
    maxSpeed: maxSpeedMs,
    accel: kind === 'supercar' ? 28 : kind === 'motorcycle' ? 32 : isPoliceVeh ? 24 : 20,
    doorOpenProgress: 0,
    isTraffic: Boolean(opts.isTraffic),
    isPolice: isPoliceVeh,
    trafficDirX: 0,
    trafficDirZ: 1,
    driverOccupied: false,
    policeRole: isPoliceVeh ? 'patrol' : undefined,
    patrolTargetYaw: undefined,
    patrolTurnCooldown: 0,
    turnSignal: 'none',
    aiPlannedTurn: 'straight',
    aiPlanKey: '',
    aiLaneDodgeOffset: 0,
    aiPanicTimer: 0,
    aiStuckTimer: 0,
    aiReverseTimer: 0,
    aiReverseDir: 1,
    aiBlockSign: Math.random() < 0.5 ? 1 : -1,
    aiBlockAngle: 0,
    aiSpawnedForChase: false,
    aiDeployTimer: 0,
    smokeCooldown: 0,
    crashJolt: 0,
  };
}

/**
 * Physically deforms a vehicle's 3D chassis mesh and structural parts in real time
 * based on world-space impact push vector and impact speed.
 */
export function deformVehicleBody(
  v: VehicleInstance,
  impactDirWorldX: number,
  impactDirWorldZ: number,
  impactSpeed: number,
  contactWorldX?: number,
  contactWorldZ?: number
) {
  if (impactSpeed < 4.5) return;
  const dirLen = Math.hypot(impactDirWorldX, impactDirWorldZ);
  if (dirLen < 0.001) return;
  const wx = impactDirWorldX / dirLen;
  const wz = impactDirWorldZ / dirLen;

  // Transform world impact push vector into vehicle-local coordinates (+Z forward, +X left)
  const cosY = Math.cos(v.yaw);
  const sinY = Math.sin(v.yaw);
  const localDirX = wx * cosY - wz * sinY;
  const localDirZ = wx * sinY + wz * cosY;

  // Determine impact point on vehicle exterior in local coordinates
  let hitX = -localDirX * 0.92;
  let hitZ = -localDirZ * 2.15;
  if (contactWorldX !== undefined && contactWorldZ !== undefined) {
    const dx = contactWorldX - v.x;
    const dz = contactWorldZ - v.z;
    hitX = THREE.MathUtils.clamp(dx * cosY - dz * sinY, -1.05, 1.05);
    hitZ = THREE.MathUtils.clamp(dx * sinY + dz * cosY, -2.3, 2.3);
  }

  const strength = THREE.MathUtils.clamp((impactSpeed - 4.0) / 26, 0.08, 0.85);

  // Accumulate directional zone damage (0..1)
  const frontFactor = Math.max(0, -localDirZ);
  const rearFactor = Math.max(0, localDirZ);
  const leftFactor = Math.max(0, -localDirX); // push in -X means struck on +X (left) side
  const rightFactor = Math.max(0, localDirX); // push in +X means struck on -X (right) side

  v.damageZones.front = Math.min(1, v.damageZones.front + frontFactor * strength * 0.72);
  v.damageZones.rear = Math.min(1, v.damageZones.rear + rearFactor * strength * 0.72);
  v.damageZones.left = Math.min(1, v.damageZones.left + leftFactor * strength * 0.72);
  v.damageZones.right = Math.min(1, v.damageZones.right + rightFactor * strength * 0.72);

  // Deform 3D body hull vertices permanently along the impact vector
  if (v.hullMesh && v.hullRestPositions) {
    const geom = v.hullMesh.geometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const rest = v.hullRestPositions;
    const radius = 1.15 + strength * 0.95;
    const maxDentDepth = 0.42;
    const dentMag = strength * 0.34;

    for (let i = 0; i < arr.length; i += 3) {
      const vx = arr[i];
      const vy = arr[i + 1];
      const vz = arr[i + 2];

      const d = Math.hypot(vx - hitX, vz - hitZ);
      if (d < radius) {
        const falloff = (1 - d / radius) * (1 - d / radius);
        // Crumple inward along impact vector, plus sheet-metal upward buckle on hood/fenders/trunk
        let nx = vx + localDirX * dentMag * falloff;
        let nz = vz + localDirZ * dentMag * falloff;
        let ny = vy + (vy > 0.45 ? falloff * strength * 0.14 : -falloff * strength * 0.04);

        // Clamp total displacement from rest geometry so panels never invert
        const rx = rest[i];
        const ry = rest[i + 1];
        const rz = rest[i + 2];
        const disp = Math.hypot(nx - rx, nz - rz);
        if (disp > maxDentDepth) {
          const s = maxDentDepth / disp;
          nx = rx + (nx - rx) * s;
          nz = rz + (nz - rz) * s;
        }
        ny = THREE.MathUtils.clamp(ny, Math.max(0.14, ry - 0.12), ry + 0.24);

        arr[i] = nx;
        arr[i + 1] = ny;
        arr[i + 2] = nz;
      }
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  }

  // Structural part visual damage: splitter, spoiler, headlights, glass, paint, wheels
  if (v.frontSplitter && v.damageZones.front > 0.25) {
    if (v.damageZones.front > 0.72) {
      v.frontSplitter.visible = false;
    } else {
      v.frontSplitter.rotation.z = (hitX >= 0 ? -1 : 1) * v.damageZones.front * 0.22;
      v.frontSplitter.position.y = 0.21 - v.damageZones.front * 0.07;
    }
  }
  if (v.rearSpoiler && v.damageZones.rear > 0.3) {
    if (v.damageZones.rear > 0.75) {
      v.rearSpoiler.visible = false;
    } else {
      v.rearSpoiler.rotation.z = (hitX >= 0 ? 1 : -1) * v.damageZones.rear * 0.26;
      v.rearSpoiler.rotation.x = -v.damageZones.rear * 0.18;
    }
  }
  if (v.headlightMats && v.damageZones.front > 0.32) {
    if (hitX > -0.2 && v.damageZones.front > 0.35) {
      v.headlightMats[0].emissiveIntensity = v.damageZones.front > 0.6 ? 0.0 : 0.45;
    }
    if (hitX < 0.2 && v.damageZones.front > 0.35) {
      v.headlightMats[1].emissiveIntensity = v.damageZones.front > 0.6 ? 0.0 : 0.45;
    }
  }
  if (v.cabinGlassMat) {
    const maxZone = Math.max(v.damageZones.front, v.damageZones.rear, v.damageZones.left, v.damageZones.right);
    if (maxZone > 0.3) {
      v.cabinGlassMat.roughness = THREE.MathUtils.clamp(0.06 + maxZone * 0.55, 0.06, 0.65);
      v.cabinGlassMat.opacity = THREE.MathUtils.clamp(0.45 + maxZone * 0.35, 0.45, 0.85);
    }
  }
  if (v.paintMat) {
    const avgDmg = (v.damageZones.front + v.damageZones.rear + v.damageZones.left + v.damageZones.right) * 0.25;
    v.paintMat.roughness = THREE.MathUtils.clamp(0.18 + avgDmg * 0.35, 0.18, 0.55);
    v.paintMat.clearcoat = THREE.MathUtils.clamp(1.0 - avgDmg * 0.6, 0.35, 1.0);
  }
  if (v.leftDoor && v.damageZones.right > 0.4) {
    v.doorOpenProgress = Math.max(v.doorOpenProgress, 0.32);
  }
  // Subtle wheel axle camber deformation on heavily impacted corners
  if (v.wheels.length === 4) {
    if (v.damageZones.front > 0.55) {
      v.wheels[0].rotation.z = (v.damageZones.front - 0.5) * 0.26;
      v.wheels[1].rotation.z = -(v.damageZones.front - 0.5) * 0.22;
    }
    if (v.damageZones.rear > 0.55) {
      v.wheels[2].rotation.z = -(v.damageZones.rear - 0.5) * 0.22;
      v.wheels[3].rotation.z = (v.damageZones.rear - 0.5) * 0.24;
    }
  }
}
