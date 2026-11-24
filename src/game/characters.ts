import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { CyberStage } from './types';

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  weaponMount: THREE.Group;
  muzzleFlash: THREE.Mesh;
  // Gord cybernetic stage layers & active weapon switcher
  setCyberStage?: (stage: CyberStage) => void;
  setActiveWeapon?: (slot: number) => void;
}

// Helper to build organic sculpted limb segments via LatheGeometry
function createLimbLathe(topR: number, midR: number, botR: number, length: number, segs = 14): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(botR * 0.85, -length * 0.04),
    new THREE.Vector2(botR, -length * 0.14),
    new THREE.Vector2(midR, -length * 0.52),
    new THREE.Vector2(topR * 0.96, -length * 0.86),
    new THREE.Vector2(topR * 0.72, -length * 0.98),
    new THREE.Vector2(0.001, -length),
  ];
  // Shift so top is at y=0 and limb hangs downward to y=-length
  const geo = new THREE.LatheGeometry(pts.reverse().map((p) => new THREE.Vector2(p.x, p.y)), segs);
  geo.computeVertexNormals();
  return geo;
}

function createTorsoLathe(isAthletic: boolean): THREE.LatheGeometry {
  const s = isAthletic ? 1.08 : 0.96;
  const pts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.155 * s, 0.03),  // pelvis
    new THREE.Vector2(0.145 * s, 0.14),  // waist
    new THREE.Vector2(0.165 * s, 0.28),  // ribs
    new THREE.Vector2(0.195 * s, 0.42),  // chest / lats
    new THREE.Vector2(0.185 * s, 0.50),  // upper chest
    new THREE.Vector2(0.082, 0.55),      // collar base
    new THREE.Vector2(0.001, 0.56),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(1.18, 1.0, 0.72); // Elliptical human cross-section (wider shoulders than depth)
  geo.computeVertexNormals();
  return geo;
}

function buildDetailedHand(mat: THREE.Material, side: -1 | 1): THREE.Group {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.056, 0.058), mat);
  palm.castShadow = true;
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.048), mat);
  fingers.position.set(0, -0.042, 0.008);
  fingers.rotation.x = 0.28;
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.034, 0.022), mat);
  thumb.position.set(-side * 0.02, -0.012, 0.03);
  thumb.rotation.z = side * 0.35;
  g.add(palm, fingers, thumb);
  return g;
}

function buildRealisticHead(
  skinMat: THREE.Material,
  hairColor: number,
  irisColor: number,
  withStubble = false,
  hairStyle = 0
): { headGroup: THREE.Group; jawMesh: THREE.Mesh; cyberEyeGroup: THREE.Group } {
  const headGroup = new THREE.Group();

  // Cranium (organic ellipsoid)
  const craniumGeo = new THREE.SphereGeometry(0.105, 22, 18);
  craniumGeo.scale(0.88, 1.06, 0.98);
  const cranium = new THREE.Mesh(craniumGeo, skinMat);
  cranium.position.set(0, 0.125, -0.005);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Cheekbones & upper face
  const cheekGeo = new THREE.SphereGeometry(0.088, 18, 14);
  cheekGeo.scale(0.92, 0.72, 0.85);
  const cheeks = new THREE.Mesh(cheekGeo, skinMat);
  cheeks.position.set(0, 0.095, 0.02);
  headGroup.add(cheeks);

  // Sculpted Jaw / Chin (animated subtly when speaking)
  const jawGeo = new THREE.CylinderGeometry(0.072, 0.044, 0.075, 16);
  jawGeo.scale(0.95, 1, 1.05);
  const jawMat = withStubble
    ? skinMat
    : skinMat;
  const jawMesh = new THREE.Mesh(jawGeo, jawMat);
  jawMesh.position.set(0, 0.045, 0.026);
  jawMesh.rotation.x = 0.18;
  jawMesh.castShadow = true;
  headGroup.add(jawMesh);

  // Brow ridge
  const browGeo = new THREE.BoxGeometry(0.115, 0.016, 0.032);
  const brow = new THREE.Mesh(browGeo, skinMat);
  brow.position.set(0, 0.136, 0.084);
  headGroup.add(brow);

  // Nose bridge & tip
  const noseBridgeGeo = new THREE.ConeGeometry(0.014, 0.046, 10);
  const nose = new THREE.Mesh(noseBridgeGeo, skinMat);
  nose.position.set(0, 0.105, 0.101);
  nose.rotation.x = 0.35;
  headGroup.add(nose);

  // Ears (left & right)
  const earGeo = new THREE.SphereGeometry(0.022, 10, 10);
  earGeo.scale(0.45, 1.15, 0.7);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.09, 0.105, 0.0);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.09, 0.105, 0.0);
  headGroup.add(earL, earR);

  // Realistic Eyes (sclera + colored iris + black pupil)
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x090b0f, roughness: 0.1 });
  const eyeGeo = new THREE.SphereGeometry(0.013, 12, 10);
  const irisGeo = new THREE.SphereGeometry(0.0075, 10, 8);
  const pupilGeo = new THREE.SphereGeometry(0.004, 8, 8);

  const makeEye = (sideX: number) => {
    const eg = new THREE.Group();
    eg.position.set(sideX, 0.119, 0.087);
    const sclera = new THREE.Mesh(eyeGeo, scleraMat);
    sclera.scale.set(1.05, 0.82, 0.75);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, 0, 0.007);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, 0.0115);
    eg.add(sclera, iris, pupil);
    return eg;
  };
  const eyeL = makeEye(-0.034);
  const eyeR = makeEye(0.034);
  headGroup.add(eyeL, eyeR);

  // Eyebrows
  const eyebrowMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });
  const ebGeo = new THREE.BoxGeometry(0.032, 0.006, 0.012);
  const ebL = new THREE.Mesh(ebGeo, eyebrowMat);
  ebL.position.set(-0.035, 0.138, 0.094);
  ebL.rotation.z = 0.06;
  const ebR = new THREE.Mesh(ebGeo, eyebrowMat);
  ebR.position.set(0.035, 0.138, 0.094);
  ebR.rotation.z = -0.06;
  headGroup.add(ebL, ebR);

  // Natural Lips
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xa46356, roughness: 0.62 });
  const lipGeo = new THREE.BoxGeometry(0.038, 0.008, 0.014);
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.position.set(0, 0.066, 0.088);
  headGroup.add(lip);

  // Sculpted Layered Hair with style variation
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.76, metalness: 0.08 });
  const hairCapGeo = new THREE.SphereGeometry(0.111, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  hairCapGeo.scale(0.9, 1.05, 1.02);
  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, 0.132, -0.012);
  hairCap.rotation.x = -0.22;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  if (hairStyle % 4 === 0) {
    // Textured tactical sweep
    const frontHairGeo = new THREE.SphereGeometry(0.062, 14, 12);
    frontHairGeo.scale(1.35, 0.45, 0.85);
    const frontHair = new THREE.Mesh(frontHairGeo, hairMat);
    frontHair.position.set(0, 0.212, 0.032);
    frontHair.rotation.x = 0.2;
    headGroup.add(frontHair);
  } else if (hairStyle % 4 === 1) {
    // Side-parted volume + temple fade
    const topWave = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.042, 0.14), hairMat);
    topWave.position.set(0.015, 0.22, 0.01);
    topWave.rotation.z = -0.1;
    headGroup.add(topWave);
  } else if (hairStyle % 4 === 2) {
    // Longer back hair / bob silhouette
    const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.15, 14, 1, true, Math.PI * 0.65, Math.PI * 0.7), hairMat);
    backHair.position.set(0, 0.11, -0.025);
    headGroup.add(backHair);
  } else {
    // Top knot / bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), hairMat);
    bun.position.set(0, 0.215, -0.085);
    headGroup.add(bun);
  }

  // Cybernetic Eye & Cranial Interface (hidden unless stage >= 2)
  const cyberEyeGroup = new THREE.Group();
  const titaniumMat = new THREE.MeshPhysicalMaterial({ color: 0x8b95a5, metalness: 0.92, roughness: 0.22 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 3.0 });
  const plateGeo = new THREE.BoxGeometry(0.045, 0.038, 0.038);
  const plate = new THREE.Mesh(plateGeo, titaniumMat);
  plate.position.set(-0.074, 0.125, 0.048);
  plate.rotation.y = -0.35;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), titaniumMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-0.034, 0.119, 0.095);
  const optic = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), glowMat);
  optic.position.set(-0.034, 0.119, 0.098);
  cyberEyeGroup.add(plate, lens, optic);
  cyberEyeGroup.visible = false;
  headGroup.add(cyberEyeGroup);

  return { headGroup, jawMesh, cyberEyeGroup };
}

export function buildGordCharacter(mats: MaterialLibrary): CharacterRig {
  const root = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.set(0, 0.93, 0);
  root.add(hips);

  const spine = new THREE.Group();
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.set(0, 0.04, 0);
  spine.add(chest);

  // Human Leather Jacket Torso + Cybernetic Torso Armor Overlay (Stage 4)
  const torsoGeo = createTorsoLathe(true);
  const humanTorso = new THREE.Mesh(torsoGeo, mats.leatherJacketMat);
  humanTorso.castShadow = true;
  humanTorso.receiveShadow = true;
  chest.add(humanTorso);

  // Back plate with NEXORUM logo (just like concept art!)
  const backEmblemGeo = new THREE.PlaneGeometry(0.24, 0.28);
  const backEmblem = new THREE.Mesh(backEmblemGeo, mats.gordJacketBackMat);
  backEmblem.position.set(0, 0.31, -0.145);
  backEmblem.rotation.y = Math.PI;
  chest.add(backEmblem);

  // Jacket collar & tactical lapels
  const collarGeo = new THREE.CylinderGeometry(0.095, 0.115, 0.085, 16, 1, true);
  const collar = new THREE.Mesh(collarGeo, mats.leatherJacketMat);
  collar.position.set(0, 0.525, -0.008);
  const lapelGeo = new THREE.BoxGeometry(0.055, 0.18, 0.025);
  const lapelL = new THREE.Mesh(lapelGeo, mats.leatherJacketMat);
  lapelL.position.set(0.09, 0.44, 0.125);
  lapelL.rotation.z = -0.22;
  lapelL.rotation.y = 0.25;
  const lapelR = lapelL.clone();
  lapelR.position.x = -0.09;
  lapelR.rotation.z = 0.22;
  lapelR.rotation.y = -0.25;
  chest.add(collar, lapelL, lapelR);

  // Pelvis / Belt
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.78, metalness: 0.08 });
  const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.155, 0.16, 16);
  pelvisGeo.scale(1.16, 1, 0.72);
  const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
  pelvis.position.set(0, -0.04, 0);
  pelvis.castShadow = true;
  hips.add(pelvis);

  // Stage 4 Cyber Torso Exoskeleton
  const cyberTorsoGroup = new THREE.Group();
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.24), mats.carbonFiberMat);
  chestPlate.position.set(0, 0.35, 0.01);
  const spineCore = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.38, 0.06), mats.titaniumCyberMat);
  spineCore.position.set(0, 0.29, -0.13);
  const reactorGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16), mats.cyberGlowCyanMat);
  reactorGlow.rotation.x = Math.PI / 2;
  reactorGlow.position.set(0, 0.34, -0.155);
  const frontCore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 16), mats.cyberGlowCyanMat);
  frontCore.rotation.x = Math.PI / 2;
  frontCore.position.set(0, 0.35, 0.13);
  cyberTorsoGroup.add(chestPlate, spineCore, reactorGlow, frontCore);
  cyberTorsoGroup.visible = false;
  chest.add(cyberTorsoGroup);

  // Neck & Realistic Head
  const neck = new THREE.Group();
  neck.position.set(0, 0.54, 0);
  chest.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.09, 14), mats.skinMat);
  neckMesh.position.set(0, 0.035, 0);
  neck.add(neckMesh);

  const { headGroup, jawMesh, cyberEyeGroup } = buildRealisticHead(mats.skinFaceMat, 0x3b281c, 0x3b6e8c, true);
  headGroup.position.set(0, 0.075, 0);
  neck.add(headGroup);

  // Arms Builder (Upper + Forearm + Detailed Hand, with articulated gold/titanium cyber plating)
  const upperArmGeo = createLimbLathe(0.062, 0.056, 0.048, 0.29);
  const forearmGeo = createLimbLathe(0.049, 0.042, 0.033, 0.27);

  const makeArm = (side: -1 | 1) => {
    const cyberAlloy = side === -1 ? mats.goldCyberMat : mats.titaniumCyberMat;
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.245, 0.455, 0);
    chest.add(shoulder);

    const upperHuman = new THREE.Mesh(upperArmGeo, mats.leatherJacketMat);
    upperHuman.castShadow = true;
    const upperCyber = new THREE.Mesh(upperArmGeo, cyberAlloy);
    upperCyber.scale.set(1.08, 1.0, 1.08);
    upperCyber.visible = false;
    upperCyber.castShadow = true;

    const shoulderPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 14), cyberAlloy);
    shoulderPauldron.scale.set(1.05, 0.88, 1.08);
    shoulderPauldron.visible = false;

    const bicepSegment = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.14, 14), mats.carbonFiberMat);
    bicepSegment.position.set(0, -0.15, 0);
    bicepSegment.visible = false;

    shoulder.add(upperHuman, upperCyber, shoulderPauldron, bicepSegment);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.29, 0);
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.09, 14), mats.carbonFiberMat);
    elbowJoint.rotation.z = Math.PI / 2;
    elbowJoint.visible = false;

    const foreHuman = new THREE.Mesh(forearmGeo, mats.skinMat);
    foreHuman.castShadow = true;
    const foreCyber = new THREE.Mesh(forearmGeo, cyberAlloy);
    foreCyber.scale.set(1.08, 1.0, 1.08);
    foreCyber.visible = false;
    foreCyber.castShadow = true;

    const forearmArmor = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.17, 0.064), cyberAlloy);
    forearmArmor.position.set(side * 0.015, -0.12, 0);
    forearmArmor.visible = false;

    const hydraulicGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.19, 8), mats.cyberGlowCyanMat);
    hydraulicGlow.position.set(side * 0.032, -0.14, -0.02);
    hydraulicGlow.visible = false;

    const handHuman = buildDetailedHand(mats.skinMat, side);
    handHuman.position.set(0, -0.285, 0.01);
    const handCyber = buildDetailedHand(cyberAlloy, side);
    handCyber.position.set(0, -0.285, 0.01);
    handCyber.visible = false;

    elbow.add(elbowJoint, foreHuman, foreCyber, forearmArmor, hydraulicGlow, handHuman, handCyber);

    return {
      shoulder,
      elbow,
      setCyber: (active: boolean) => {
        upperHuman.visible = !active;
        foreHuman.visible = !active;
        handHuman.visible = !active;
        upperCyber.visible = active;
        shoulderPauldron.visible = active;
        bicepSegment.visible = active;
        elbowJoint.visible = active;
        foreCyber.visible = active;
        forearmArmor.visible = active;
        hydraulicGlow.visible = active;
        handCyber.visible = active;
      },
    };
  };

  // Note: In Three.js character faces +Z, so character's RIGHT arm is -X!
  const rightArm = makeArm(-1);
  const leftArm = makeArm(1);

  // Weapon Mount attached to Gord's right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.31, 0.05);
  rightArm.elbow.add(weaponMount);

  const gunMetal = new THREE.MeshPhysicalMaterial({ color: 0x1b2029, metalness: 0.88, roughness: 0.28 });

  // Slot 1: Detailed NX-47 Assault Rifle (Holographic optic, suppressor, foregrip, curved mag)
  const rifleGroup = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.082, 0.36), gunMetal);
  receiver.position.set(0, 0, 0.12);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.062, 0.19), mats.carbonFiberMat);
  handguard.position.set(0, 0.008, 0.32);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.28, 12), gunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, 0.43);
  const muzzleComp = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.055, 12), mats.titaniumCyberMat);
  muzzleComp.rotation.x = Math.PI / 2;
  muzzleComp.position.set(0, 0.018, 0.56);
  const holoSight = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.038, 0.068), gunMetal);
  holoSight.position.set(0, 0.058, 0.12);
  const holoLens = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.012), mats.cyberGlowCyanMat);
  holoLens.position.set(0, 0.06, 0.15);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.145, 0.052), mats.carbonFiberMat);
  mag.position.set(0, -0.095, 0.19);
  mag.rotation.x = 0.24;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.078, 0.17), mats.carbonFiberMat);
  stock.position.set(0, -0.012, -0.095);
  rifleGroup.add(receiver, handguard, barrel, muzzleComp, holoSight, holoLens, mag, stock);

  // Slot 2: Tactical Suppressed P90 / Sidearm SMG
  const pistolGroup = new THREE.Group();
  const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.048, 0.21), gunMetal);
  pSlide.position.set(0, 0.024, 0.09);
  const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.048), mats.carbonFiberMat);
  pGrip.position.set(0, -0.032, 0.02);
  pGrip.rotation.x = 0.22;
  const pSuppr = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 12), mats.titaniumCyberMat);
  pSuppr.rotation.x = Math.PI / 2;
  pSuppr.position.set(0, 0.024, 0.25);
  const pOptic = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.035), mats.cyberGlowCyanMat);
  pOptic.position.set(0, 0.055, 0.06);
  pistolGroup.add(pSlide, pGrip, pSuppr, pOptic);

  // Slot 3: Fragmentation Grenade
  const grenadeGroup = new THREE.Group();
  const gBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.45, metalness: 0.4 })
  );
  gBody.scale.set(0.88, 1.18, 0.88);
  gBody.position.set(0, -0.01, 0.03);
  const gFuse = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), mats.chromeMat);
  gFuse.position.set(0, 0.045, 0.03);
  grenadeGroup.add(gBody, gFuse);

  // Slot 4: Cyber-Blade (Titanium Katana / Plasma Edge)
  const bladeGroup = new THREE.Group();
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.18, 10), mats.carbonFiberMat);
  hilt.rotation.x = Math.PI / 2;
  hilt.position.set(0, 0, 0.02);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.018), mats.goldCyberMat);
  guard.position.set(0, 0, 0.11);
  const steelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.044, 0.62), mats.titaniumCyberMat);
  steelBlade.position.set(0, 0.004, 0.42);
  const plasmaEdge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.61), mats.cyberGlowCyanMat);
  plasmaEdge.position.set(0, -0.018, 0.425);
  bladeGroup.add(hilt, guard, steelBlade, plasmaEdge);

  // Slot 5: Trauma-Pro Medkit
  const medkitGroup = new THREE.Group();
  const medBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.15, 0.065),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.15 })
  );
  medBox.position.set(0, -0.02, 0.05);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.07), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  crossV.position.set(0, -0.02, 0.05);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 0.07), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  crossH.position.set(0, -0.02, 0.05);
  medkitGroup.add(medBox, crossV, crossH);

  weaponMount.add(rifleGroup, pistolGroup, grenadeGroup, bladeGroup, medkitGroup);

  const setActiveWeapon = (slot: number) => {
    rifleGroup.visible = slot === 1;
    pistolGroup.visible = slot === 2;
    grenadeGroup.visible = slot === 3;
    bladeGroup.visible = slot === 4;
    medkitGroup.visible = slot === 5;
  };
  setActiveWeapon(1);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.92 })
  );
  muzzleFlash.position.set(0, 0.02, 0.58);
  muzzleFlash.visible = false;
  weaponMount.add(muzzleFlash);

  // Legs Builder (Thigh + Shin + Boot, with toggleable robotic legs)
  const thighGeo = createLimbLathe(0.092, 0.078, 0.062, 0.44);
  const shinGeo = createLimbLathe(0.062, 0.056, 0.038, 0.42);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.48, metalness: 0.2 });

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.06, 0);
    hips.add(hip);

    const thighHuman = new THREE.Mesh(thighGeo, pantsMat);
    thighHuman.castShadow = true;
    const thighCyber = new THREE.Mesh(thighGeo, mats.carbonFiberMat);
    thighCyber.visible = false;
    thighCyber.castShadow = true;
    hip.add(thighHuman, thighCyber);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const kneeJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.09, 12), mats.titaniumCyberMat);
    kneeJoint.rotation.z = Math.PI / 2;
    kneeJoint.visible = false;

    const shinHuman = new THREE.Mesh(shinGeo, pantsMat);
    shinHuman.castShadow = true;
    const shinCyber = new THREE.Mesh(shinGeo, mats.titaniumCyberMat);
    shinCyber.visible = false;
    shinCyber.castShadow = true;

    const calfPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.28, 8), mats.cyberGlowCyanMat);
    calfPiston.position.set(0, -0.21, -0.045);
    calfPiston.visible = false;

    // Realistic sculpted boot
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.085, 0.19), bootMat);
    bootUpper.position.set(0, -0.435, 0.04);
    bootUpper.castShadow = true;
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.025, 0.205), mats.tireMat);
    bootSole.position.set(0, -0.478, 0.042);

    knee.add(kneeJoint, shinHuman, shinCyber, calfPiston, bootUpper, bootSole);

    return {
      hip,
      knee,
      setCyber: (active: boolean) => {
        thighHuman.visible = !active;
        shinHuman.visible = !active;
        thighCyber.visible = active;
        kneeJoint.visible = active;
        shinCyber.visible = active;
        calfPiston.visible = active;
      },
    };
  };

  const rightLeg = makeLeg(-1);
  const leftLeg = makeLeg(1);

  const setCyberStage = (stage: CyberStage) => {
    rightArm.setCyber(stage >= 1);
    cyberEyeGroup.visible = stage >= 2;
    leftLeg.setCyber(stage >= 3);
    rightLeg.setCyber(stage >= 3);
    leftArm.setCyber(stage >= 4);
    cyberTorsoGroup.visible = stage >= 4;
  };

  setCyberStage(0);

  return {
    root,
    hips,
    spine,
    chest,
    neck,
    head: headGroup,
    jaw: jawMesh,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    weaponMount,
    muzzleFlash,
    setCyberStage,
    setActiveWeapon,
  };
}

export type NpcRole = 'civilian' | 'police' | 'gangster' | 'boss';

export function buildHumanNpc(mats: MaterialLibrary, role: NpcRole, seed: number): CharacterRig {
  const root = new THREE.Group();

  const skinTones = [0xd9a788, 0xc68e6b, 0xebbfa3, 0x8d5a42];
  const hairColors = [0x1c1714, 0x3b281d, 0x6b4b32, 0x111216, 0x8a6d4b];
  const shirtColors = [0x2a3b4c, 0x4b5563, 0x7c2d12, 0x3f4e3c, 0x5b3e52, 0xcbd5e1];

  let shirtColor = shirtColors[seed % shirtColors.length];
  let pantsColor = 0x1e242e;
  if (role === 'police') {
    shirtColor = 0x172554;
    pantsColor = 0x0f172a;
  } else if (role === 'gangster') {
    shirtColor = 0x2a1414;
    pantsColor = 0x141418;
  } else if (role === 'boss') {
    shirtColor = 0x18181b;
    pantsColor = 0x09090b;
  }

  const npcSkinMat = new THREE.MeshPhysicalMaterial({
    color: skinTones[seed % skinTones.length],
    roughness: 0.56,
    metalness: 0.0,
    clearcoat: 0.06,
  });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72, metalness: 0.08 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8, metalness: 0.05 });

  const hips = new THREE.Group();
  hips.position.set(0, 0.91, 0);
  root.add(hips);

  const spine = new THREE.Group();
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.set(0, 0.04, 0);
  spine.add(chest);

  const torso = new THREE.Mesh(createTorsoLathe(role !== 'civilian'), shirtMat);
  torso.castShadow = true;
  chest.add(torso);

  if (role === 'police') {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.24), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }));
    vest.position.set(0, 0.34, 0);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 }));
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.07, 0.39, 0.125);
    chest.add(vest, badge);
  } else if (role === 'boss') {
    // Mafia boss crimson tie & tailored suit lapel
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.02), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 }));
    tie.position.set(0, 0.34, 0.13);
    chest.add(tie);
  }

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.15, 14), pantsMat);
  pelvis.scale.set(1.14, 1, 0.7);
  pelvis.position.set(0, -0.04, 0);
  hips.add(pelvis);

  const neck = new THREE.Group();
  neck.position.set(0, 0.54, 0);
  chest.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.085, 12), npcSkinMat);
  neckMesh.position.set(0, 0.035, 0);
  neck.add(neckMesh);

  const { headGroup, jawMesh } = buildRealisticHead(
    npcSkinMat,
    hairColors[seed % hairColors.length],
    0x2f4f4f,
    seed % 3 === 0,
    seed
  );
  headGroup.position.set(0, 0.072, 0);
  neck.add(headGroup);

  if (role === 'police') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.112, 0.06, 16), shirtMat);
    cap.position.set(0, 0.21, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2 }));
    visor.position.set(0, 0.185, 0.095);
    visor.rotation.x = 0.22;
    headGroup.add(cap, visor);
  }

  const upperArmGeo = createLimbLathe(0.056, 0.05, 0.044, 0.28);
  const forearmGeo = createLimbLathe(0.045, 0.039, 0.031, 0.26);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.23, 0.45, 0);
    chest.add(shoulder);
    const up = new THREE.Mesh(upperArmGeo, shirtMat);
    up.castShadow = true;
    shoulder.add(up);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);
    const fore = new THREE.Mesh(forearmGeo, role === 'civilian' && seed % 2 === 0 ? npcSkinMat : shirtMat);
    fore.castShadow = true;
    const hand = buildDetailedHand(npcSkinMat, side);
    hand.position.set(0, -0.275, 0.01);
    elbow.add(fore, hand);
    return { shoulder, elbow };
  };

  const rightArm = makeArm(-1);
  const leftArm = makeArm(1);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.3, 0.04);
  rightArm.elbow.add(weaponMount);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  muzzleFlash.visible = false;
  if (role !== 'civilian') {
    const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.18), mats.carbonFiberMat);
    pistol.position.set(0, 0, 0.08);
    weaponMount.add(pistol);
    muzzleFlash.position.set(0, 0.02, 0.2);
    weaponMount.add(muzzleFlash);
  }

  const thighGeo = createLimbLathe(0.086, 0.072, 0.058, 0.43);
  const shinGeo = createLimbLathe(0.058, 0.052, 0.036, 0.41);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.5 });

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.098, -0.06, 0);
    hips.add(hip);
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.43, 0);
    hip.add(knee);
    const shin = new THREE.Mesh(shinGeo, pantsMat);
    shin.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.18), shoeMat);
    shoe.position.set(0, -0.43, 0.038);
    knee.add(shin, shoe);
    return { hip, knee };
  };

  const rightLeg = makeLeg(-1);
  const leftLeg = makeLeg(1);

  return {
    root,
    hips,
    spine,
    chest,
    neck,
    head: headGroup,
    jaw: jawMesh,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    weaponMount,
    muzzleFlash,
  };
}

// Natural procedural human gait, sprint, idle, aim, talk & seated animations
export function animateCharacterRig(
  rig: CharacterRig,
  state: {
    speed: number;
    maxSpeed: number;
    time: number;
    dt: number;
    aiming: boolean;
    talking: boolean;
    seated: boolean;
    meleeSwing: number;
    grounded: boolean;
    panic?: boolean;
    hitFlinch?: number;
    weaponRecoil?: number;
  },
  phaseOffset = 0
) {
  const { speed, time, dt, aiming, talking, seated, meleeSwing, grounded, panic = false, hitFlinch = 0, weaponRecoil = 0 } = state;
  const dampFactor = Math.min(1, dt * 12);

  if (seated) {
    rig.hips.position.y = THREE.MathUtils.lerp(rig.hips.position.y, 0.52, dampFactor);
    rig.leftHip.rotation.x = THREE.MathUtils.lerp(rig.leftHip.rotation.x, -1.35, dampFactor);
    rig.rightHip.rotation.x = THREE.MathUtils.lerp(rig.rightHip.rotation.x, -1.35, dampFactor);
    rig.leftKnee.rotation.x = THREE.MathUtils.lerp(rig.leftKnee.rotation.x, 1.35, dampFactor);
    rig.rightKnee.rotation.x = THREE.MathUtils.lerp(rig.rightKnee.rotation.x, 1.35, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -0.95, dampFactor);
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -0.95, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.45, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.45, dampFactor);
    rig.spine.rotation.x = THREE.MathUtils.lerp(rig.spine.rotation.x, -0.1, dampFactor);
    return;
  }

  const moving = speed > 0.25;
  const sprintBlend = THREE.MathUtils.clamp((speed - 4.2) / 5.5, 0, 1);
  const walkBlend = THREE.MathUtils.clamp(speed / 3.8, 0, 1);
  const freq = moving ? THREE.MathUtils.lerp(6.8, 11.2, sprintBlend) : 1.6;
  const phase = time * freq + phaseOffset;

  // Pelvis vertical bounce & natural hip sway
  const bob = moving && grounded ? Math.abs(Math.sin(phase)) * (0.035 + sprintBlend * 0.03) : Math.sin(time * 2.0) * 0.008;
  rig.hips.position.y = THREE.MathUtils.lerp(rig.hips.position.y, 0.92 + bob, dampFactor);
  rig.hips.rotation.y = THREE.MathUtils.lerp(rig.hips.rotation.y, moving ? Math.sin(phase) * 0.09 : 0, dampFactor);

  // Spine forward lean during sprint or backward stagger on bullet/punch flinch
  const targetLean = (moving ? 0.06 + sprintBlend * 0.2 : 0.02) - hitFlinch * 0.65;
  rig.spine.rotation.x = THREE.MathUtils.lerp(rig.spine.rotation.x, targetLean, dampFactor);
  rig.chest.rotation.y = THREE.MathUtils.lerp(rig.chest.rotation.y, moving ? -Math.sin(phase) * 0.08 : 0, dampFactor);

  // Natural leg stride with asymmetric knee flexion
  const strideAmp = walkBlend * (0.48 + sprintBlend * 0.36);
  const rHipTarget = moving ? Math.sin(phase) * strideAmp : 0;
  const lHipTarget = moving ? -Math.sin(phase) * strideAmp : 0;
  const rKneeTarget = moving ? Math.max(0, -Math.cos(phase)) * (0.65 + sprintBlend * 0.55) : 0.04;
  const lKneeTarget = moving ? Math.max(0, Math.cos(phase)) * (0.65 + sprintBlend * 0.55) : 0.04;

  rig.rightHip.rotation.x = THREE.MathUtils.lerp(rig.rightHip.rotation.x, grounded ? -rHipTarget : -0.45, dampFactor);
  rig.leftHip.rotation.x = THREE.MathUtils.lerp(rig.leftHip.rotation.x, grounded ? -lHipTarget : 0.2, dampFactor);
  rig.rightKnee.rotation.x = THREE.MathUtils.lerp(rig.rightKnee.rotation.x, grounded ? rKneeTarget : 0.7, dampFactor);
  rig.leftKnee.rotation.x = THREE.MathUtils.lerp(rig.leftKnee.rotation.x, grounded ? lKneeTarget : 0.35, dampFactor);

  // Arm counter-swing, panic arms-up sprint, combat aim with recoil, or melee swing
  const armSwing = walkBlend * (0.42 + sprintBlend * 0.38);
  if (meleeSwing > 0) {
    rig.rightShoulder.rotation.x = -1.7 + Math.sin(meleeSwing * Math.PI) * 1.55;
    rig.rightElbow.rotation.x = -0.3;
    rig.leftShoulder.rotation.x = -0.6;
  } else if (panic) {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -2.2 + Math.sin(phase) * 0.35, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -2.2 - Math.sin(phase) * 0.35, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.8, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.8, dampFactor);
  } else if (aiming) {
    const recoilPitch = weaponRecoil * 0.28;
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -1.42 - recoilPitch, dampFactor * 1.6);
    rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0.15, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.22 - recoilPitch * 0.5, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -1.28 - recoilPitch * 0.7, dampFactor * 1.6);
    rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, -0.42, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.65, dampFactor);
  } else {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(
      rig.rightShoulder.rotation.x,
      moving ? Math.sin(phase) * armSwing : 0.04,
      dampFactor
    );
    rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(
      rig.rightElbow.rotation.x,
      moving ? -0.35 - Math.max(0, -Math.sin(phase)) * 0.45 : -0.18,
      dampFactor
    );

    const talkGesture = talking ? -0.45 + Math.sin(time * 5.2) * 0.25 : 0;
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(
      rig.leftShoulder.rotation.x,
      talking ? talkGesture : moving ? -Math.sin(phase) * armSwing : 0.04,
      dampFactor
    );
    rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, 0, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(
      rig.leftElbow.rotation.x,
      talking ? -0.75 : moving ? -0.35 - Math.max(0, Math.sin(phase)) * 0.45 : -0.18,
      dampFactor
    );
  }

  // Head stabilization & facial talking jaw motion
  rig.head.rotation.y = THREE.MathUtils.lerp(
    rig.head.rotation.y,
    talking ? Math.sin(time * 2.1) * 0.14 : Math.sin(time * 0.7 + phaseOffset) * 0.05,
    dampFactor
  );
  rig.head.rotation.x = THREE.MathUtils.lerp(
    rig.head.rotation.x,
    talking ? Math.sin(time * 3.8) * 0.06 : 0,
    dampFactor
  );
  rig.jaw.position.y = talking ? 0.045 - Math.abs(Math.sin(time * 13)) * 0.009 : 0.045;
}
