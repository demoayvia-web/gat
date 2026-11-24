import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { CyberStage } from './types';

export type WorkPose = 'none' | 'phone' | 'clipboard' | 'inspect';
export type FacialExpression = 'neutral' | 'happy' | 'curious' | 'talking' | 'angry' | 'panic' | 'focused' | 'annoyed';
export type CharacterGesture = 'none' | 'explain' | 'emphasize' | 'shrug' | 'wave' | 'hands_up' | 'point' | 'nod';
export type CharacterGender = 'male' | 'female';

export interface ClothFlaps {
  front: THREE.Mesh;
  back: THREE.Mesh;
  left: THREE.Mesh;
  right: THREE.Mesh;
  scarf?: THREE.Mesh;
  baseFrontY: number;
  baseBackY: number;
  isLongCoat: boolean;
}

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  upperLip: THREE.Mesh;
  lowerLip: THREE.Mesh;
  mouthCornerL: THREE.Mesh;
  mouthCornerR: THREE.Mesh;
  eyebrowL: THREE.Mesh;
  eyebrowR: THREE.Mesh;
  eyelidL: THREE.Mesh;
  eyelidR: THREE.Mesh;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  leftFoot: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  rightFoot: THREE.Group;
  weaponMount: THREE.Group;
  muzzleFlash: THREE.Mesh;
  clothHem?: ClothFlaps;
  // Gord cybernetic stage layers, active weapon & NPC work prop switcher
  setCyberStage?: (stage: CyberStage) => void;
  setActiveWeapon?: (slot: number) => void;
  setWorkProp?: (pose: WorkPose) => void;
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
  const geo = new THREE.LatheGeometry(pts.reverse().map((p) => new THREE.Vector2(p.x, p.y)), segs);
  geo.computeVertexNormals();
  return geo;
}

function createTorsoLathe(buildScale: number, gender: CharacterGender = 'male'): THREE.LatheGeometry {
  const s = buildScale;
  const pts =
    gender === 'female'
      ? [
          new THREE.Vector2(0.001, 0.0),
          new THREE.Vector2(0.146 * s, 0.03),
          new THREE.Vector2(0.118 * s, 0.16),
          new THREE.Vector2(0.152 * s, 0.31),
          new THREE.Vector2(0.164 * s, 0.42),
          new THREE.Vector2(0.156 * s, 0.49),
          new THREE.Vector2(0.072, 0.54),
          new THREE.Vector2(0.001, 0.55),
        ]
      : [
          new THREE.Vector2(0.001, 0.0),
          new THREE.Vector2(0.155 * s, 0.03),
          new THREE.Vector2(0.145 * s, 0.14),
          new THREE.Vector2(0.165 * s, 0.28),
          new THREE.Vector2(0.195 * s, 0.42),
          new THREE.Vector2(0.185 * s, 0.50),
          new THREE.Vector2(0.082, 0.55),
          new THREE.Vector2(0.001, 0.56),
        ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(gender === 'female' ? 1.12 : 1.18, 1.0, gender === 'female' ? 0.69 : 0.72);
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

function buildClothHem(
  clothMat: THREE.Material,
  hips: THREE.Group,
  isLongCoat: boolean,
  withScarf: boolean,
  scarfColor: number,
  mats: MaterialLibrary
): ClothFlaps {
  const len = isLongCoat ? 0.34 : 0.16;
  const halfLen = len * 0.5;

  const frontGeo = new THREE.BoxGeometry(0.32, len, 0.022);
  frontGeo.translate(0, -halfLen, 0);
  const front = new THREE.Mesh(frontGeo, clothMat);
  front.position.set(0, 0.01, 0.115);
  front.castShadow = true;

  const backGeo = new THREE.BoxGeometry(0.35, len * 1.08, 0.024);
  backGeo.translate(0, -halfLen * 1.08, 0);
  const back = new THREE.Mesh(backGeo, clothMat);
  back.position.set(0, 0.015, -0.118);
  back.castShadow = true;

  const sideGeo = new THREE.BoxGeometry(0.022, len * 0.96, 0.21);
  sideGeo.translate(0, -halfLen * 0.96, 0);
  const left = new THREE.Mesh(sideGeo, clothMat);
  left.position.set(0.185, 0.01, 0);
  const right = new THREE.Mesh(sideGeo, clothMat);
  right.position.set(-0.185, 0.01, 0);

  hips.add(front, back, left, right);

  let scarf: THREE.Mesh | undefined;
  if (withScarf) {
    const scarfMat = new THREE.MeshPhysicalMaterial({
      color: scarfColor,
      bumpMap: mats.fabricWeaveBumpMap,
      bumpScale: 0.018,
      roughness: 0.85,
      sheen: 0.45,
    });
    const scarfGeo = new THREE.BoxGeometry(0.085, 0.28, 0.018);
    scarfGeo.translate(0, -0.14, 0);
    scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.position.set(0.06, 0.51, 0.12);
    scarf.castShadow = true;
  }

  return {
    front,
    back,
    left,
    right,
    scarf,
    baseFrontY: 0.01,
    baseBackY: 0.015,
    isLongCoat,
  };
}

function buildRealisticHead(
  skinMat: THREE.Material,
  mats: MaterialLibrary,
  hairColor: number,
  irisColor: number,
  facialHair: 'none' | 'stubble' | 'mustache' | 'beard' = 'none',
  hairStyle = 0,
  withGlasses = false,
  gender: CharacterGender = 'male',
  lipColorHex?: number
): {
  headGroup: THREE.Group;
  jawMesh: THREE.Mesh;
  upperLip: THREE.Mesh;
  lowerLip: THREE.Mesh;
  mouthCornerL: THREE.Mesh;
  mouthCornerR: THREE.Mesh;
  eyebrowL: THREE.Mesh;
  eyebrowR: THREE.Mesh;
  eyelidL: THREE.Mesh;
  eyelidR: THREE.Mesh;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  cyberEyeGroup: THREE.Group;
} {
  const headGroup = new THREE.Group();
  const isFemale = gender === 'female';

  // Cranium with pore-mapped physical skin
  const craniumGeo = new THREE.SphereGeometry(0.104, 24, 20);
  craniumGeo.scale(isFemale ? 0.84 : 0.89, 1.05, 0.97);
  const cranium = new THREE.Mesh(craniumGeo, skinMat);
  cranium.position.set(0, 0.125, -0.005);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Sculpted cheekbones & zygomatic arch (higher & softly contoured for women)
  const cheekGeo = new THREE.SphereGeometry(isFemale ? 0.084 : 0.088, 20, 16);
  cheekGeo.scale(isFemale ? 0.9 : 0.94, isFemale ? 0.76 : 0.71, 0.86);
  const cheeks = new THREE.Mesh(cheekGeo, skinMat);
  cheeks.position.set(0, isFemale ? 0.098 : 0.094, 0.02);
  headGroup.add(cheeks);

  // Subtle warm facial blush tint on cheekbones for lifelike skin depth
  const blushMat = new THREE.MeshBasicMaterial({
    color: isFemale ? 0xd97373 : 0xc97b68,
    transparent: true,
    opacity: isFemale ? 0.16 : 0.08,
    depthWrite: false,
  });
  const blushGeo = new THREE.SphereGeometry(0.024, 10, 8);
  blushGeo.scale(1.15, 0.65, 0.35);
  const blushL = new THREE.Mesh(blushGeo, blushMat);
  blushL.position.set(0.044, 0.088, 0.082);
  blushL.rotation.y = 0.42;
  const blushR = new THREE.Mesh(blushGeo, blushMat);
  blushR.position.set(-0.044, 0.088, 0.082);
  blushR.rotation.y = -0.42;
  headGroup.add(blushL, blushR);

  // Sculpted Jaw / Chin (tapered soft oval for female, stronger square jaw for male)
  const jawGeo = new THREE.CylinderGeometry(
    isFemale ? 0.062 : 0.074,
    isFemale ? 0.034 : 0.049,
    0.074,
    18
  );
  jawGeo.scale(isFemale ? 0.89 : 0.98, 1, 1.04);
  const jawMesh = new THREE.Mesh(jawGeo, skinMat);
  jawMesh.position.set(0, 0.046, 0.025);
  jawMesh.rotation.x = isFemale ? 0.2 : 0.17;
  jawMesh.castShadow = true;
  headGroup.add(jawMesh);

  // Male facial hair variants
  if (!isFemale && facialHair !== 'none') {
    const hairMatFacial = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
    if (facialHair === 'beard') {
      const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.049, 0.064, 14), hairMatFacial);
      beard.scale.set(0.98, 1, 1.08);
      beard.position.set(0, -0.004, 0.005);
      jawMesh.add(beard);
    } else if (facialHair === 'stubble') {
      const stubbleMat = new THREE.MeshStandardMaterial({
        color: hairColor,
        roughness: 0.95,
        transparent: true,
        opacity: 0.32,
      });
      const stubble = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.048, 0.056, 14), stubbleMat);
      stubble.scale.set(0.99, 1, 1.06);
      stubble.position.set(0, -0.002, 0.004);
      jawMesh.add(stubble);
    } else if (facialHair === 'mustache') {
      const stache = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.0085, 0.015), hairMatFacial);
      stache.position.set(0, 0.076, 0.088);
      headGroup.add(stache);
    }
  }

  // Brow ridge & supraorbital contour (subtle for women, stronger for men)
  if (!isFemale) {
    const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.015, 0.032), skinMat);
    browRidge.position.set(0, 0.136, 0.084);
    headGroup.add(browRidge);
  }

  // Nose bridge, tip & subtle nostrils (refined slimmer nose for women)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(isFemale ? 0.011 : 0.014, 0.045, 12), skinMat);
  nose.position.set(0, 0.105, 0.101);
  nose.rotation.x = isFemale ? 0.31 : 0.36;
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(isFemale ? 0.0092 : 0.0118, 10, 8), skinMat);
  noseTip.position.set(0, 0.088, 0.105);
  headGroup.add(nose, noseTip);

  // Ears (left & right)
  const earGeo = new THREE.SphereGeometry(0.021, 12, 10);
  earGeo.scale(0.42, 1.12, 0.68);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(isFemale ? -0.084 : -0.09, 0.105, 0.0);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(isFemale ? 0.084 : 0.09, 0.105, 0.0);
  headGroup.add(earL, earR);

  // Realistic Multi-Layer Eyes (sclera + radial iris + pupil + glossy cornea + eyelids + female upper lash rim)
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.18,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: irisColor,
    map: mats.irisMap,
    roughness: 0.2,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.08 });
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.24,
  });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.6 });

  const eyeGeo = new THREE.SphereGeometry(0.0135, 14, 12);
  const irisGeo = new THREE.SphereGeometry(0.0084, 12, 10);
  const pupilGeo = new THREE.SphereGeometry(0.0042, 10, 8);
  const corneaGeo = new THREE.SphereGeometry(0.0095, 12, 10);
  const eyelidGeo = new THREE.SphereGeometry(0.0155, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);

  const makeEye = (sideX: number) => {
    const socket = new THREE.Group();
    socket.position.set(sideX, 0.119, 0.086);

    const eyeball = new THREE.Group();
    const sclera = new THREE.Mesh(eyeGeo, scleraMat);
    sclera.scale.set(isFemale ? 1.08 : 1.04, isFemale ? 0.92 : 0.85, 0.82);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, 0, 0.0072);
    iris.scale.set(1, 1, 0.45);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, 0.0102);
    const cornea = new THREE.Mesh(corneaGeo, corneaMat);
    cornea.position.set(0, 0, 0.0078);
    eyeball.add(sclera, iris, pupil, cornea);

    const eyelid = new THREE.Mesh(eyelidGeo, skinMat);
    eyelid.scale.set(1.12, 0.35, 0.96);
    eyelid.position.set(0, 0.004, 0.001);
    eyelid.rotation.x = -0.35;

    if (isFemale) {
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0028, 0.006), lashMat);
      lash.position.set(0, 0.0082, 0.0095);
      lash.rotation.z = sideX > 0 ? -0.09 : 0.09;
      socket.add(lash);
    }

    socket.add(eyeball, eyelid);
    return { socket, eyeball, eyelid };
  };

  const leftEyeParts = makeEye(0.033);
  const rightEyeParts = makeEye(-0.033);
  headGroup.add(leftEyeParts.socket, rightEyeParts.socket);

  // Expressive Eyebrows (slimmer arched brows for female, fuller for male)
  const eyebrowMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });
  const ebGeo = new THREE.BoxGeometry(isFemale ? 0.031 : 0.034, isFemale ? 0.0045 : 0.0068, 0.012);
  const eyebrowR = new THREE.Mesh(ebGeo, eyebrowMat);
  eyebrowR.position.set(-0.034, isFemale ? 0.141 : 0.139, 0.094);
  eyebrowR.rotation.z = isFemale ? 0.11 : 0.06;
  const eyebrowL = new THREE.Mesh(ebGeo, eyebrowMat);
  eyebrowL.position.set(0.034, isFemale ? 0.141 : 0.139, 0.094);
  eyebrowL.rotation.z = isFemale ? -0.11 : -0.06;
  headGroup.add(eyebrowR, eyebrowL);

  // Dual Articulated Lips + Smile/Frown Corners for rich emotional expressions & lip-sync
  const lipColor = lipColorHex ?? (isFemale ? 0xb85a62 : 0xa35f54);
  const lipMat = new THREE.MeshPhysicalMaterial({ color: lipColor, roughness: isFemale ? 0.34 : 0.48, clearcoat: isFemale ? 0.45 : 0.22 });
  const upperLip = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.033 : 0.036, isFemale ? 0.0065 : 0.0055, 0.014), lipMat);
  upperLip.position.set(0, 0.069, 0.088);
  const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.031 : 0.033, isFemale ? 0.0072 : 0.006, 0.014), lipMat);
  lowerLip.position.set(0, 0.063, 0.087);

  const cornerGeo = new THREE.BoxGeometry(0.0085, 0.0042, 0.011);
  const mouthCornerL = new THREE.Mesh(cornerGeo, lipMat);
  mouthCornerL.position.set(0.0175, 0.066, 0.085);
  const mouthCornerR = new THREE.Mesh(cornerGeo, lipMat);
  mouthCornerR.position.set(-0.0175, 0.066, 0.085);
  headGroup.add(upperLip, lowerLip, mouthCornerL, mouthCornerR);

  // Sculpted Hairstyles: 6 Female styles + 6 Male styles
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: isFemale ? 0.58 : 0.72, metalness: 0.08 });
  const style = hairStyle % 6;

  if (isFemale) {
    // Base sculpted crown cap
    const crownCapGeo = new THREE.SphereGeometry(0.109, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    crownCapGeo.scale(0.87, 1.05, 1.01);
    const crownCap = new THREE.Mesh(crownCapGeo, hairMat);
    crownCap.position.set(0, 0.133, -0.012);
    crownCap.rotation.x = -0.22;
    crownCap.castShadow = true;
    headGroup.add(crownCap);

    if (style === 0) {
      // Long flowing layered hair draping past shoulders + side framing locks
      const backDrape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.118, 0.29, 16, 1, false, Math.PI * 0.55, Math.PI * 0.9),
        hairMat
      );
      backDrape.position.set(0, 0.04, -0.036);
      backDrape.castShadow = true;
      const sideLockGeo = new THREE.BoxGeometry(0.034, 0.24, 0.055);
      const lockL = new THREE.Mesh(sideLockGeo, hairMat);
      lockL.position.set(0.084, 0.055, 0.028);
      lockL.rotation.z = -0.08;
      const lockR = new THREE.Mesh(sideLockGeo, hairMat);
      lockR.position.set(-0.084, 0.055, 0.028);
      lockR.rotation.z = 0.08;
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.028, 0.045), hairMat);
      bangs.position.set(0.018, 0.195, 0.068);
      bangs.rotation.z = -0.14;
      headGroup.add(backDrape, lockL, lockR, bangs);
    } else if (style === 1) {
      // Sleek chin-length bob cut
      const bobSideGeo = new THREE.BoxGeometry(0.032, 0.155, 0.11);
      const bobL = new THREE.Mesh(bobSideGeo, hairMat);
      bobL.position.set(0.082, 0.095, -0.004);
      bobL.rotation.z = -0.08;
      const bobR = new THREE.Mesh(bobSideGeo, hairMat);
      bobR.position.set(-0.082, 0.095, -0.004);
      bobR.rotation.z = 0.08;
      const bobBack = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.145, 0.045), hairMat);
      bobBack.position.set(0, 0.098, -0.088);
      headGroup.add(bobL, bobR, bobBack);
    } else if (style === 2) {
      // High ponytail with hair tie & cascading tail
      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(0.024, 0.007, 8, 12),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      tie.position.set(0, 0.185, -0.098);
      tie.rotation.x = 0.55;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.24, 12), hairMat);
      tail.position.set(0, 0.095, -0.135);
      tail.rotation.x = Math.PI + 0.28;
      tail.castShadow = true;
      headGroup.add(tie, tail);
    } else if (style === 3) {
      // High top-knot bun + wispy side strands
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), hairMat);
      bun.position.set(0, 0.242, -0.032);
      bun.castShadow = true;
      const wispGeo = new THREE.BoxGeometry(0.016, 0.095, 0.022);
      const wispL = new THREE.Mesh(wispGeo, hairMat);
      wispL.position.set(0.076, 0.115, 0.042);
      const wispR = new THREE.Mesh(wispGeo, hairMat);
      wispR.position.set(-0.076, 0.115, 0.042);
      headGroup.add(bun, wispL, wispR);
    } else if (style === 4) {
      // Voluminous wavy shoulder curls
      const curlOffsets: Array<[number, number, number, number]> = [
        [0, 0.195, -0.04, 0.085],
        [0.082, 0.12, -0.01, 0.058],
        [-0.082, 0.12, -0.01, 0.058],
        [0.068, 0.06, -0.05, 0.056],
        [-0.068, 0.06, -0.05, 0.056],
        [0, 0.075, -0.095, 0.078],
      ];
      for (const [cx, cy, cz, cr] of curlOffsets) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(cr, 12, 10), hairMat);
        c.position.set(cx, cy, cz);
        c.castShadow = true;
        headGroup.add(c);
      }
    } else {
      // Asymmetric sleek pixie / side-swept crop
      const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.036, 0.135), hairMat);
      sweep.position.set(0.02, 0.205, 0.025);
      sweep.rotation.z = -0.22;
      sweep.rotation.y = 0.18;
      headGroup.add(sweep);
    }
  } else {
    if (style !== 4) {
      const hairCapGeo = new THREE.SphereGeometry(0.111, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.61);
      hairCapGeo.scale(0.9, 1.05, 1.02);
      const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
      hairCap.position.set(0, 0.132, -0.012);
      hairCap.rotation.x = -0.22;
      hairCap.castShadow = true;
      headGroup.add(hairCap);
    }

    if (style === 0) {
      // Textured side-part pompadour
      const frontHairGeo = new THREE.SphereGeometry(0.062, 14, 12);
      frontHairGeo.scale(1.32, 0.46, 0.9);
      const frontHair = new THREE.Mesh(frontHairGeo, hairMat);
      frontHair.position.set(0.01, 0.214, 0.032);
      frontHair.rotation.x = 0.18;
      frontHair.rotation.z = -0.08;
      headGroup.add(frontHair);
    } else if (style === 1) {
      // Classic short cropped fade / crew cut
      const topCrop = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.032, 0.135), hairMat);
      topCrop.position.set(0, 0.216, 0.008);
      headGroup.add(topCrop);
    } else if (style === 2) {
      // Layered medium tousled hair
      const backHair = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.106, 0.13, 14, 1, true, Math.PI * 0.65, Math.PI * 0.7),
        hairMat
      );
      backHair.position.set(0, 0.115, -0.024);
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.048), hairMat);
      fringe.position.set(-0.012, 0.194, 0.068);
      fringe.rotation.z = 0.14;
      headGroup.add(backHair, fringe);
    } else if (style === 3) {
      // Curly top fade
      const curls = new THREE.Mesh(new THREE.SphereGeometry(0.116, 16, 14), hairMat);
      curls.scale.set(0.92, 0.68, 0.95);
      curls.position.set(0, 0.188, -0.004);
      headGroup.add(curls);
    } else if (style === 4) {
      // Clean military buzz cut
      const buzzGeo = new THREE.SphereGeometry(0.107, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
      buzzGeo.scale(0.89, 1.05, 0.99);
      const buzz = new THREE.Mesh(buzzGeo, hairMat);
      buzz.position.set(0, 0.128, -0.008);
      buzz.rotation.x = -0.18;
      headGroup.add(buzz);
    } else {
      // Swept-back undercut with top-knot
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), hairMat);
      bun.position.set(0, 0.215, -0.088);
      headGroup.add(bun);
    }
  }

  // Optional stylish glasses / cyber-shades for NPC variety
  if (withGlasses) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: isFemale ? 0x312e81 : 0x1e293b,
      roughness: 0.08,
      metalness: 0.3,
      transparent: true,
      opacity: 0.68,
      clearcoat: 1.0,
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0045, 0.006), frameMat);
    bridge.position.set(0, 0.121, 0.104);
    const lLens = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.017, 0.006), lensMat);
    lLens.position.set(0.033, 0.119, 0.103);
    const rLens = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.017, 0.006), lensMat);
    rLens.position.set(-0.033, 0.119, 0.103);
    headGroup.add(bridge, lLens, rLens);
  }

  // Cybernetic Eye & Cranial Interface (hidden unless stage >= 2)
  const cyberEyeGroup = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.038, 0.038), mats.titaniumCyberMat);
  plate.position.set(-0.074, 0.125, 0.048);
  plate.rotation.y = -0.35;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), mats.titaniumCyberMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-0.034, 0.119, 0.095);
  const optic = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), mats.cyberGlowCyanMat);
  optic.position.set(-0.034, 0.119, 0.098);
  cyberEyeGroup.add(plate, lens, optic);
  cyberEyeGroup.visible = false;
  headGroup.add(cyberEyeGroup);

  return {
    headGroup,
    jawMesh,
    upperLip,
    lowerLip,
    mouthCornerL,
    mouthCornerR,
    eyebrowL,
    eyebrowR,
    eyelidL: leftEyeParts.eyelid,
    eyelidR: rightEyeParts.eyelid,
    eyeL: leftEyeParts.eyeball,
    eyeR: rightEyeParts.eyeball,
    cyberEyeGroup,
  };
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

  const torsoGeo = createTorsoLathe(1.08);
  const humanTorso = new THREE.Mesh(torsoGeo, mats.leatherJacketMat);
  humanTorso.castShadow = true;
  humanTorso.receiveShadow = true;
  chest.add(humanTorso);

  const backEmblem = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.28), mats.gordJacketBackMat);
  backEmblem.position.set(0, 0.31, -0.145);
  backEmblem.rotation.y = Math.PI;
  chest.add(backEmblem);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.085, 16, 1, true), mats.leatherJacketMat);
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

  // Pelvis & Dynamic Leather Jacket Cloth Hem
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    bumpMap: mats.fabricWeaveBumpMap,
    bumpScale: 0.015,
    roughness: 0.76,
    metalness: 0.08,
  });
  const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.155, 0.16, 16);
  pelvisGeo.scale(1.16, 1, 0.72);
  const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
  pelvis.position.set(0, -0.04, 0);
  pelvis.castShadow = true;
  hips.add(pelvis);

  const clothHem = buildClothHem(mats.leatherJacketMat, hips, false, false, 0x1f2937, mats);

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

  const neck = new THREE.Group();
  neck.position.set(0, 0.54, 0);
  chest.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.09, 14), mats.skinMat);
  neckMesh.position.set(0, 0.035, 0);
  neck.add(neckMesh);

  const headParts = buildRealisticHead(mats.skinFaceMat, mats, 0x3b281c, 0x3b6e8c, 'stubble', 0, false, 'male');
  headParts.headGroup.position.set(0, 0.075, 0);
  neck.add(headParts.headGroup);

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

  const rightArm = makeArm(-1);
  const leftArm = makeArm(1);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.31, 0.05);
  rightArm.elbow.add(weaponMount);

  const gunMetal = new THREE.MeshPhysicalMaterial({ color: 0x1b2029, metalness: 0.88, roughness: 0.28 });

  // Slot 1: NX-47 Assault Rifle
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

  // Slot 2: P90 Sidearm
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

  // Slot 3: Frag Grenade
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

  // Slot 4: Cyber-Blade
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

  // Slot 5: Medkit
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

  // Legs + Articulated Ankles/Boots
  const thighGeo = createLimbLathe(0.092, 0.078, 0.062, 0.44);
  const shinGeo = createLimbLathe(0.062, 0.056, 0.038, 0.41);
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

    const foot = new THREE.Group();
    foot.position.set(0, -0.41, 0);
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.078, 0.19), bootMat);
    bootUpper.position.set(0, -0.025, 0.042);
    bootUpper.castShadow = true;
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.024, 0.205), mats.tireMat);
    bootSole.position.set(0, -0.068, 0.044);
    foot.add(bootUpper, bootSole);

    knee.add(kneeJoint, shinHuman, shinCyber, calfPiston, foot);

    return {
      hip,
      knee,
      foot,
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
    headParts.cyberEyeGroup.visible = stage >= 2;
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
    head: headParts.headGroup,
    jaw: headParts.jawMesh,
    upperLip: headParts.upperLip,
    lowerLip: headParts.lowerLip,
    mouthCornerL: headParts.mouthCornerL,
    mouthCornerR: headParts.mouthCornerR,
    eyebrowL: headParts.eyebrowL,
    eyebrowR: headParts.eyebrowR,
    eyelidL: headParts.eyelidL,
    eyelidR: headParts.eyelidR,
    eyeL: headParts.eyeL,
    eyeR: headParts.eyeR,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    leftFoot: leftLeg.foot,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    rightFoot: rightLeg.foot,
    weaponMount,
    muzzleFlash,
    clothHem,
    setCyberStage,
    setActiveWeapon,
  };
}

export type NpcRole = 'civilian' | 'police' | 'gangster' | 'boss';

export function buildHumanNpc(
  mats: MaterialLibrary,
  role: NpcRole,
  seed: number,
  forcedGender?: CharacterGender
): CharacterRig {
  const root = new THREE.Group();
  const gender: CharacterGender = forcedGender ?? (role === 'civilian' && seed % 2 === 1 ? 'female' : 'male');
  const isFemale = gender === 'female';

  const skinTones = [0xdba98a, 0xc68e6b, 0xebbfa3, 0x9b644a, 0xe3b193, 0x734733];
  const hairColors = [0x1c1714, 0x3b281d, 0x6b4b32, 0x111216, 0x8a6d4b, 0xa86b3e, 0x7c2d12, 0x64748b];
  const irisColors = [0x3b6e8c, 0x4d6b3b, 0x5c3e26, 0x2f4f4f, 0x64748b];
  const maleShirtColors = [0x2a3b4c, 0x4b5563, 0x7c2d12, 0x3f4e3c, 0x1e3a5f, 0xd1d5db, 0x312e81, 0x6d4c3d];
  const femaleShirtColors = [0x9d174d, 0xbe123c, 0x0f766e, 0xe2e8f0, 0x4338ca, 0x7c2d12, 0x334155, 0xa16207];
  const pantsColors = [0x1e242e, 0x18181b, 0x292524, 0x2b3648, 0x374151];
  const scarfColors = [0x991b1b, 0x1d4ed8, 0xb45309, 0x0f766e, 0xbe185d];
  const femaleLipColors = [0xb85a62, 0x9f3f4e, 0xc9736b, 0x883249];

  const outfitStyle = seed % 6;
  let shirtColor = (isFemale ? femaleShirtColors : maleShirtColors)[seed % 8];
  let pantsColor = pantsColors[(seed * 3) % pantsColors.length];
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

  // Unique height & body build variation per resident
  const heightScale = role === 'boss' ? 1.05 : isFemale ? 0.91 + ((seed * 17) % 10) * 0.009 : 0.96 + ((seed * 17) % 12) * 0.01;
  const buildScale = role !== 'civilian' ? 1.04 : isFemale ? 0.88 + ((seed * 11) % 10) * 0.008 : 0.94 + ((seed * 11) % 13) * 0.011;
  root.scale.set(0.95 + (buildScale - 0.95) * 0.45, heightScale, 1.0);

  // Pore-textured physical skin for every NPC
  const npcSkinMat = new THREE.MeshPhysicalMaterial({
    color: skinTones[seed % skinTones.length],
    bumpMap: mats.skinPoreBumpMap,
    bumpScale: 0.012,
    roughness: isFemale ? 0.48 : 0.54,
    metalness: 0.0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.58,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xffb494),
  });

  // Woven textile materials for realistic clothing & dynamic cloth flaps
  const shirtMat = new THREE.MeshPhysicalMaterial({
    color: shirtColor,
    bumpMap: mats.fabricWeaveBumpMap,
    bumpScale: 0.016,
    roughness: outfitStyle === 2 ? 0.45 : 0.74, // sleeker sheen for leather moto jackets
    metalness: outfitStyle === 2 ? 0.12 : 0.05,
    sheen: 0.34,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    bumpMap: mats.fabricWeaveBumpMap,
    bumpScale: 0.015,
    roughness: 0.8,
    metalness: 0.05,
  });

  const hips = new THREE.Group();
  hips.position.set(0, 0.91, 0);
  root.add(hips);

  const spine = new THREE.Group();
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.set(0, 0.04, 0);
  spine.add(chest);

  const torso = new THREE.Mesh(createTorsoLathe(buildScale, gender), shirtMat);
  torso.castShadow = true;
  chest.add(torso);

  const wearsSkirt = role === 'civilian' && isFemale && (outfitStyle === 1 || outfitStyle === 4);
  const isLongCoat = role === 'boss' || (role === 'civilian' && ((isFemale && outfitStyle === 0) || (!isFemale && outfitStyle === 3)));
  const withScarf = role === 'civilian' && ((isFemale && (outfitStyle === 0 || outfitStyle === 3)) || (!isFemale && outfitStyle === 3));
  const withBackpack = role === 'civilian' && ((isFemale && outfitStyle === 4) || (!isFemale && outfitStyle === 5));
  const withHoodie = role === 'civilian' && ((isFemale && outfitStyle === 5) || (!isFemale && outfitStyle === 2));
  const withJacketLapels = role === 'civilian' && ((isFemale && (outfitStyle === 1 || outfitStyle === 2)) || (!isFemale && (outfitStyle === 0 || outfitStyle === 1)));
  const withWorkVest = role === 'civilian' && !isFemale && outfitStyle === 4;
  const shortSleeves = role === 'civilian' && ((isFemale && outfitStyle === 4) || (!isFemale && (outfitStyle === 4 || outfitStyle === 5)));

  if (role === 'police') {
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.25, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
    );
    vest.position.set(0, 0.34, 0);
    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.015, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 })
    );
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.07, 0.39, 0.125);
    chest.add(vest, badge);
  } else if (role === 'boss' || (!isFemale && outfitStyle === 1)) {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.23, 0.02),
      new THREE.MeshStandardMaterial({ color: role === 'boss' ? 0x991b1b : 0x1e3a8a, roughness: 0.4 })
    );
    tie.position.set(0, 0.34, 0.125);
    chest.add(tie);
  } else if (withWorkVest) {
    const hiVis = new THREE.Mesh(
      new THREE.BoxGeometry(0.31, 0.26, 0.23),
      new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.65 })
    );
    hiVis.position.set(0, 0.32, 0);
    chest.add(hiVis);
  }

  if (withJacketLapels) {
    const lapelMat = new THREE.MeshStandardMaterial({
      color: isFemale && outfitStyle === 1 ? 0x1e293b : shirtColor,
      roughness: 0.55,
    });
    const lapelGeo = new THREE.BoxGeometry(0.044, 0.16, 0.02);
    const lapelL = new THREE.Mesh(lapelGeo, lapelMat);
    lapelL.position.set(0.068, 0.41, 0.112);
    lapelL.rotation.z = -0.22;
    const lapelR = lapelL.clone();
    lapelR.position.x = -0.068;
    lapelR.rotation.z = 0.22;
    chest.add(lapelL, lapelR);
  }

  if (withHoodie) {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.032, 8, 14), shirtMat);
    hood.position.set(0, 0.525, -0.025);
    hood.rotation.x = Math.PI / 2 + 0.28;
    chest.add(hood);
  }

  if (isFemale && outfitStyle === 3) {
    // Turtleneck knit collar
    const turtle = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.068, 14), shirtMat);
    turtle.position.set(0, 0.545, 0);
    chest.add(turtle);
  }

  if (withBackpack) {
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(isFemale ? 0.2 : 0.24, 0.28, 0.11),
      new THREE.MeshStandardMaterial({ color: isFemale ? 0x78350f : 0x1f2937, roughness: 0.72 })
    );
    pack.position.set(0, 0.31, -0.155);
    pack.castShadow = true;
    chest.add(pack);
  }

  // Waist belt & pelvis
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148 * buildScale, 0.148 * buildScale, 0.032, 14),
    new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4 })
  );
  belt.scale.set(1.14, 1, 0.71);
  belt.position.set(0, 0.02, 0);
  hips.add(belt);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.146, 0.15, 14), wearsSkirt ? shirtMat : pantsMat);
  pelvis.scale.set(isFemale ? 1.16 : 1.14, 1, 0.7);
  pelvis.position.set(0, -0.04, 0);
  hips.add(pelvis);

  const skirtMat = wearsSkirt
    ? new THREE.MeshPhysicalMaterial({
        color: outfitStyle === 1 ? 0x1e293b : 0x334155,
        bumpMap: mats.fabricWeaveBumpMap,
        bumpScale: 0.015,
        roughness: 0.7,
        sheen: 0.35,
      })
    : shirtMat;

  const clothHem = buildClothHem(
    skirtMat,
    hips,
    isLongCoat || wearsSkirt,
    withScarf,
    scarfColors[seed % scarfColors.length],
    mats
  );
  if (clothHem.scarf) {
    chest.add(clothHem.scarf);
  }

  const neck = new THREE.Group();
  neck.position.set(0, 0.54, 0);
  chest.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(isFemale ? 0.043 : 0.05, isFemale ? 0.05 : 0.058, 0.085, 12), npcSkinMat);
  neckMesh.position.set(0, 0.035, 0);
  neck.add(neckMesh);

  const facialHair: 'none' | 'stubble' | 'mustache' | 'beard' =
    isFemale ? 'none' : seed % 6 === 0 ? 'beard' : seed % 4 === 0 ? 'mustache' : seed % 3 === 0 ? 'stubble' : 'none';
  const headParts = buildRealisticHead(
    npcSkinMat,
    mats,
    hairColors[seed % hairColors.length],
    irisColors[seed % irisColors.length],
    facialHair,
    Math.floor(seed / 2) + outfitStyle,
    role === 'boss' || (role === 'civilian' && seed % 5 === 3),
    gender,
    isFemale ? femaleLipColors[seed % femaleLipColors.length] : undefined
  );
  headParts.headGroup.position.set(0, 0.072, 0);
  neck.add(headParts.headGroup);

  if (role === 'police') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.112, 0.06, 16), shirtMat);
    cap.position.set(0, 0.21, 0);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.012, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2 })
    );
    visor.position.set(0, 0.185, 0.095);
    visor.rotation.x = 0.22;
    headParts.headGroup.add(cap, visor);
  }

  const upperArmGeo = createLimbLathe(isFemale ? 0.047 : 0.056, isFemale ? 0.041 : 0.05, isFemale ? 0.036 : 0.044, 0.28);
  const forearmGeo = createLimbLathe(isFemale ? 0.037 : 0.045, isFemale ? 0.032 : 0.039, isFemale ? 0.026 : 0.031, 0.26);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (isFemale ? 0.195 : 0.23), 0.45, 0);
    chest.add(shoulder);
    const up = new THREE.Mesh(upperArmGeo, shirtMat);
    up.castShadow = true;
    shoulder.add(up);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);
    const fore = new THREE.Mesh(forearmGeo, shortSleeves ? npcSkinMat : shirtMat);
    fore.castShadow = true;
    const hand = buildDetailedHand(npcSkinMat, side);
    hand.position.set(0, -0.275, 0.01);
    elbow.add(fore, hand);
    return { shoulder, elbow };
  };

  const rightArm = makeArm(-1);
  const leftArm = makeArm(1);

  // Left-hand work props (Smartphone / Clipboard) for working NPCs
  const workPropGroup = new THREE.Group();
  workPropGroup.position.set(0, -0.28, 0.045);
  leftArm.elbow.add(workPropGroup);

  const phoneMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.012, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 1.2 })
  );
  phoneMesh.visible = false;
  const clipboardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.014, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 })
  );
  clipboardMesh.visible = false;
  workPropGroup.add(phoneMesh, clipboardMesh);

  const setWorkProp = (pose: WorkPose) => {
    phoneMesh.visible = pose === 'phone';
    clipboardMesh.visible = pose === 'clipboard';
  };

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

  const thighGeo = createLimbLathe(isFemale ? 0.08 : 0.086, isFemale ? 0.066 : 0.072, isFemale ? 0.052 : 0.058, 0.43);
  const shinGeo = createLimbLathe(isFemale ? 0.052 : 0.058, isFemale ? 0.046 : 0.052, isFemale ? 0.032 : 0.036, 0.4);
  const shoeColors = [0x111318, 0x3f2e21, 0xe2e8f0, 0x1e293b];
  const shoeMat = new THREE.MeshStandardMaterial({
    color: role === 'civilian' ? shoeColors[seed % shoeColors.length] : 0x111318,
    roughness: 0.48,
  });

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * (isFemale ? 0.086 : 0.098), -0.06, 0);
    hips.add(hip);
    const thigh = new THREE.Mesh(thighGeo, wearsSkirt ? npcSkinMat : pantsMat);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.43, 0);
    hip.add(knee);
    const shin = new THREE.Mesh(shinGeo, wearsSkirt ? npcSkinMat : pantsMat);
    shin.castShadow = true;

    const foot = new THREE.Group();
    foot.position.set(0, -0.4, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(isFemale ? 0.074 : 0.085, 0.06, isFemale ? 0.165 : 0.18), shoeMat);
    shoe.position.set(0, -0.028, 0.036);
    foot.add(shoe);

    knee.add(shin, foot);
    return { hip, knee, foot };
  };

  const rightLeg = makeLeg(-1);
  const leftLeg = makeLeg(1);

  return {
    root,
    hips,
    spine,
    chest,
    neck,
    head: headParts.headGroup,
    jaw: headParts.jawMesh,
    upperLip: headParts.upperLip,
    lowerLip: headParts.lowerLip,
    mouthCornerL: headParts.mouthCornerL,
    mouthCornerR: headParts.mouthCornerR,
    eyebrowL: headParts.eyebrowL,
    eyebrowR: headParts.eyebrowR,
    eyelidL: headParts.eyelidL,
    eyelidR: headParts.eyelidR,
    eyeL: headParts.eyeL,
    eyeR: headParts.eyeR,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    leftFoot: leftLeg.foot,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    rightFoot: rightLeg.foot,
    weaponMount,
    muzzleFlash,
    clothHem,
    setWorkProp,
  };
}

// Natural biomechanical gait, cloth physics, blinking, gaze, emotions, gestures & speech lip-sync
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
    expression?: FacialExpression;
    gesture?: CharacterGesture;
    gender?: CharacterGender;
    speechEnvelope?: number;
    blink?: boolean;
    gazeYaw?: number;
    workPose?: WorkPose;
    windStrength?: number;
  },
  phaseOffset = 0
) {
  const {
    speed,
    time,
    dt,
    aiming,
    talking,
    seated,
    meleeSwing,
    grounded,
    panic = false,
    hitFlinch = 0,
    weaponRecoil = 0,
    expression,
    gesture = 'none',
    gender = 'male',
    speechEnvelope,
    blink = false,
    gazeYaw = 0,
    workPose = 'none',
    windStrength = 0.25,
  } = state;
  const dampFactor = Math.min(1, dt * 12);
  const isFemale = gender === 'female';

  // Facial animation runs even while seated or working
  const activeExpr: FacialExpression =
    expression ?? (panic ? 'panic' : aiming ? 'focused' : talking ? 'talking' : 'neutral');

  // 1. Natural blinking & emotional eyelid aperture
  const autoBlink = Math.sin(time * 0.9 + phaseOffset * 3.1) > 0.985;
  const isBlinking = blink || autoBlink;
  let targetLidScale = isBlinking ? 1.85 : 0.32;
  if (!isBlinking) {
    if (activeExpr === 'panic') targetLidScale = 0.1;
    else if (activeExpr === 'curious') targetLidScale = 0.2;
    else if (activeExpr === 'happy') targetLidScale = 0.44; // warm smile squint
    else if (activeExpr === 'angry' || activeExpr === 'annoyed' || activeExpr === 'focused') targetLidScale = 0.58;
  }
  rig.eyelidL.scale.y = THREE.MathUtils.lerp(rig.eyelidL.scale.y, targetLidScale, Math.min(1, dt * 24));
  rig.eyelidR.scale.y = THREE.MathUtils.lerp(rig.eyelidR.scale.y, targetLidScale, Math.min(1, dt * 24));

  // 2. Eye saccades / gaze tracking
  const eyeYaw = THREE.MathUtils.clamp(gazeYaw, -0.35, 0.35) + (talking ? Math.sin(time * 1.9 + phaseOffset) * 0.06 : 0);
  rig.eyeL.rotation.y = THREE.MathUtils.lerp(rig.eyeL.rotation.y, eyeYaw, dampFactor);
  rig.eyeR.rotation.y = THREE.MathUtils.lerp(rig.eyeR.rotation.y, eyeYaw, dampFactor);

  // 3. Eyebrow expressiveness (including asymmetrical curiosity & anger furrow)
  let browYR = isFemale ? 0.141 : 0.139;
  let browYL = browYR;
  let browTiltR = isFemale ? 0.11 : 0.06;
  let browTiltL = -browTiltR;
  if (activeExpr === 'angry') {
    browYR = browYL = 0.132;
    browTiltR = -0.25;
    browTiltL = 0.25;
  } else if (activeExpr === 'annoyed') {
    browYR = browYL = 0.135;
    browTiltR = -0.15;
    browTiltL = 0.15;
  } else if (activeExpr === 'panic') {
    browYR = browYL = 0.148;
    browTiltR = 0.24;
    browTiltL = -0.24;
  } else if (activeExpr === 'curious') {
    browYL = browYR + 0.006; // raised left brow of curiosity
    browTiltR = 0.08;
    browTiltL = -0.18;
  } else if (activeExpr === 'happy') {
    browYR = browYL = browYR + 0.003;
    browTiltR = 0.14;
    browTiltL = -0.14;
  } else if (activeExpr === 'talking') {
    const bounce = Math.sin(time * 4.5 + phaseOffset) * 0.003;
    browYR = browYL = browYR + 0.002 + bounce;
    browTiltR = 0.11;
    browTiltL = -0.11;
  } else if (activeExpr === 'focused') {
    browYR = browYL = 0.136;
    browTiltR = -0.09;
    browTiltL = 0.09;
  }
  rig.eyebrowR.position.y = THREE.MathUtils.lerp(rig.eyebrowR.position.y, browYR, dampFactor);
  rig.eyebrowL.position.y = THREE.MathUtils.lerp(rig.eyebrowL.position.y, browYL, dampFactor);
  rig.eyebrowR.rotation.z = THREE.MathUtils.lerp(rig.eyebrowR.rotation.z, browTiltR, dampFactor);
  rig.eyebrowL.rotation.z = THREE.MathUtils.lerp(rig.eyebrowL.rotation.z, browTiltL, dampFactor);

  // 4. Multi-harmonic speech lip-sync & emotional mouth corners (smile / frown / O-mouth)
  const syllableEnv =
    speechEnvelope !== undefined
      ? speechEnvelope
      : talking
      ? Math.max(
          0,
          Math.abs(Math.sin(time * 11.5 + phaseOffset)) * 0.65 +
            Math.sin(time * 19.2 + phaseOffset * 2) * 0.35
        )
      : 0;
  const mouthOpen =
    activeExpr === 'panic'
      ? 0.015
      : activeExpr === 'curious'
      ? 0.0045
      : talking
      ? THREE.MathUtils.clamp(syllableEnv, 0, 1) * 0.013
      : 0;
  const lipSpread = talking ? 1.0 - mouthOpen * 12 : activeExpr === 'happy' ? 1.14 : 1.0;
  rig.jaw.position.y = THREE.MathUtils.lerp(rig.jaw.position.y, 0.046 - mouthOpen, Math.min(1, dt * 22));
  rig.lowerLip.position.y = THREE.MathUtils.lerp(rig.lowerLip.position.y, 0.063 - mouthOpen * 0.9, Math.min(1, dt * 22));
  rig.upperLip.position.y = THREE.MathUtils.lerp(rig.upperLip.position.y, 0.069 + mouthOpen * 0.25, Math.min(1, dt * 22));
  rig.lowerLip.scale.x = THREE.MathUtils.lerp(rig.lowerLip.scale.x, lipSpread, Math.min(1, dt * 18));

  let cornerY = 0.066 - mouthOpen * 0.35;
  let cornerRot = 0;
  if (activeExpr === 'happy') {
    cornerY += 0.0038;
    cornerRot = 0.42;
  } else if (activeExpr === 'angry' || activeExpr === 'annoyed') {
    cornerY -= 0.0032;
    cornerRot = -0.36;
  }
  rig.mouthCornerL.position.y = THREE.MathUtils.lerp(rig.mouthCornerL.position.y, cornerY, dampFactor);
  rig.mouthCornerR.position.y = THREE.MathUtils.lerp(rig.mouthCornerR.position.y, cornerY, dampFactor);
  rig.mouthCornerL.rotation.z = THREE.MathUtils.lerp(rig.mouthCornerL.rotation.z, cornerRot, dampFactor);
  rig.mouthCornerR.rotation.z = THREE.MathUtils.lerp(rig.mouthCornerR.rotation.z, -cornerRot, dampFactor);

  if (seated) {
    rig.hips.position.y = THREE.MathUtils.lerp(rig.hips.position.y, 0.52, dampFactor);
    rig.hips.position.x = THREE.MathUtils.lerp(rig.hips.position.x, 0, dampFactor);
    rig.hips.rotation.z = THREE.MathUtils.lerp(rig.hips.rotation.z, 0, dampFactor);
    rig.leftHip.rotation.x = THREE.MathUtils.lerp(rig.leftHip.rotation.x, -1.35, dampFactor);
    rig.rightHip.rotation.x = THREE.MathUtils.lerp(rig.rightHip.rotation.x, -1.35, dampFactor);
    rig.leftKnee.rotation.x = THREE.MathUtils.lerp(rig.leftKnee.rotation.x, 1.35, dampFactor);
    rig.rightKnee.rotation.x = THREE.MathUtils.lerp(rig.rightKnee.rotation.x, 1.35, dampFactor);
    rig.leftFoot.rotation.x = THREE.MathUtils.lerp(rig.leftFoot.rotation.x, 0.15, dampFactor);
    rig.rightFoot.rotation.x = THREE.MathUtils.lerp(rig.rightFoot.rotation.x, 0.15, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -0.95, dampFactor);
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -0.95, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.45, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.45, dampFactor);
    rig.spine.rotation.x = THREE.MathUtils.lerp(rig.spine.rotation.x, -0.1, dampFactor);
    if (rig.clothHem) {
      rig.clothHem.front.rotation.x = THREE.MathUtils.lerp(rig.clothHem.front.rotation.x, -1.05, dampFactor);
      rig.clothHem.back.rotation.x = THREE.MathUtils.lerp(rig.clothHem.back.rotation.x, 0.18, dampFactor);
      if (rig.clothHem.scarf) {
        rig.clothHem.scarf.rotation.x = 0.25 + Math.sin(time * 9 + phaseOffset) * 0.18 * windStrength;
      }
    }
    return;
  }

  const moving = speed > 0.25;
  const sprintBlend = THREE.MathUtils.clamp((speed - 4.2) / 5.5, 0, 1);
  const walkBlend = THREE.MathUtils.clamp(speed / 3.8, 0, 1);
  const freq = moving ? THREE.MathUtils.lerp(isFemale ? 6.8 : 6.2, 11.0, sprintBlend) : 1.6;
  const phase = time * freq + phaseOffset;

  // 5. Biomechanical Pelvis & Spine Weight-Shift + Gender Gait Nuances
  const strideSin = Math.sin(phase);
  const strideCos = Math.cos(phase);
  const bob = moving && grounded ? Math.abs(strideSin) * (0.036 + sprintBlend * 0.032) : Math.sin(time * 2.1 + phaseOffset) * 0.008;
  const hipSwayAmp = isFemale ? 0.068 : 0.042;
  const hipLatAmp = isFemale ? 0.028 : 0.021;
  rig.hips.position.y = THREE.MathUtils.lerp(rig.hips.position.y, 0.92 + bob, dampFactor);
  rig.hips.position.x = THREE.MathUtils.lerp(rig.hips.position.x, moving ? strideSin * hipLatAmp : Math.sin(time * 0.8 + phaseOffset) * 0.012, dampFactor);
  rig.hips.rotation.y = THREE.MathUtils.lerp(rig.hips.rotation.y, moving ? strideSin * (isFemale ? 0.115 : 0.09) : 0, dampFactor);
  rig.hips.rotation.z = THREE.MathUtils.lerp(rig.hips.rotation.z, moving ? -strideSin * hipSwayAmp : Math.sin(time * 0.8 + phaseOffset) * 0.018, dampFactor);

  // Spine forward lean + breathing chest scale + shoulder counter-twist
  const workLean = workPose === 'inspect' ? 0.24 : workPose === 'phone' || workPose === 'clipboard' ? 0.09 : 0;
  const targetLean = (moving ? 0.055 + sprintBlend * 0.2 : 0.018 + workLean) - hitFlinch * 0.65;
  rig.spine.rotation.x = THREE.MathUtils.lerp(rig.spine.rotation.x, targetLean, dampFactor);
  rig.chest.rotation.y = THREE.MathUtils.lerp(rig.chest.rotation.y, moving ? -strideSin * (isFemale ? 0.075 : 0.105) : 0, dampFactor);
  const breath = 1.0 + Math.sin(time * 2.4 + phaseOffset) * (moving ? 0.022 : 0.014);
  rig.chest.scale.set(1.0, 1.0, breath);

  // 6. Natural Leg Stride + Heel-Strike & Toe-Off Ankle Pitch
  const strideAmp = walkBlend * ((isFemale ? 0.44 : 0.49) + sprintBlend * 0.36);
  const rHipTarget = moving ? strideSin * strideAmp : 0;
  const lHipTarget = moving ? -strideSin * strideAmp : 0;
  const rKneeTarget = moving ? Math.max(0, -strideCos) * (0.68 + sprintBlend * 0.55) : 0.04;
  const lKneeTarget = moving ? Math.max(0, strideCos) * (0.68 + sprintBlend * 0.55) : 0.04;
  const rFootTarget = moving ? strideCos * 0.28 * walkBlend : 0;
  const lFootTarget = moving ? -strideCos * 0.28 * walkBlend : 0;

  rig.rightHip.rotation.x = THREE.MathUtils.lerp(rig.rightHip.rotation.x, grounded ? -rHipTarget : -0.45, dampFactor);
  rig.leftHip.rotation.x = THREE.MathUtils.lerp(rig.leftHip.rotation.x, grounded ? -lHipTarget : 0.2, dampFactor);
  rig.rightKnee.rotation.x = THREE.MathUtils.lerp(rig.rightKnee.rotation.x, grounded ? rKneeTarget : 0.7, dampFactor);
  rig.leftKnee.rotation.x = THREE.MathUtils.lerp(rig.leftKnee.rotation.x, grounded ? lKneeTarget : 0.35, dampFactor);
  rig.rightFoot.rotation.x = THREE.MathUtils.lerp(rig.rightFoot.rotation.x, grounded ? rFootTarget : 0.35, dampFactor);
  rig.leftFoot.rotation.x = THREE.MathUtils.lerp(rig.leftFoot.rotation.x, grounded ? lFootTarget : 0.25, dampFactor);

  // 7. Arm Swing, Work Poses, Panic, Aiming & Expressive Social/Reaction Gestures
  const armSwing = walkBlend * ((isFemale ? 0.36 : 0.43) + sprintBlend * 0.38);
  let rShZ = isFemale ? -0.04 : -0.06;
  let lShZ = isFemale ? 0.04 : 0.06;

  if (meleeSwing > 0) {
    rig.rightShoulder.rotation.x = -1.7 + Math.sin(meleeSwing * Math.PI) * 1.55;
    rig.rightElbow.rotation.x = -0.3;
    rig.leftShoulder.rotation.x = -0.6;
  } else if (gesture === 'hands_up') {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -1.75 + Math.sin(time * 7 + phaseOffset) * 0.08, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -1.75 - Math.sin(time * 7 + phaseOffset) * 0.08, dampFactor);
    rShZ = -0.38;
    lShZ = 0.38;
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -1.12, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -1.12, dampFactor);
  } else if (panic) {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -2.15 + strideSin * 0.35, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -2.15 - strideSin * 0.35, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.82, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.82, dampFactor);
  } else if (aiming) {
    const recoilPitch = weaponRecoil * 0.28;
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -1.42 - recoilPitch, dampFactor * 1.6);
    rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0.15, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.22 - recoilPitch * 0.5, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -1.28 - recoilPitch * 0.7, dampFactor * 1.6);
    rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, -0.42, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.65, dampFactor);
  } else if (workPose !== 'none' && !moving) {
    if (workPose === 'phone' || workPose === 'clipboard') {
      rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -0.65, dampFactor);
      rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, -0.28, dampFactor);
      rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -1.15, dampFactor);
      const tap = Math.sin(time * 5.2 + phaseOffset) * 0.08;
      rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -0.58 + tap, dampFactor);
      rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0.34, dampFactor);
      rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -1.05, dampFactor);
    } else {
      const reach = Math.sin(time * 2.8 + phaseOffset) * 0.18;
      rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -0.75 + reach, dampFactor);
      rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.45, dampFactor);
      rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -0.42, dampFactor);
      rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.35, dampFactor);
    }
  } else if (gesture === 'wave' && !moving) {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -2.2, dampFactor);
    rShZ = -0.35 + Math.sin(time * 9.5 + phaseOffset) * 0.3;
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.72, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, 0.05, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.22, dampFactor);
  } else if (gesture === 'point') {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -1.42, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.14, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, moving ? -strideSin * armSwing : 0.06, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.25, dampFactor);
  } else if (gesture === 'shrug' && !moving) {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, -0.45, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, -0.45, dampFactor);
    rShZ = -0.38;
    lShZ = 0.38;
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -1.18, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -1.18, dampFactor);
  } else if ((talking || gesture === 'explain' || gesture === 'emphasize') && !moving) {
    const emph = gesture === 'emphasize' ? 1.35 : 1.0;
    const rBeat = -0.48 + Math.sin(time * 4.2 + phaseOffset) * 0.22 * emph;
    const lBeat = -0.52 + Math.cos(time * 3.7 + phaseOffset) * 0.22 * emph;
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, rBeat, dampFactor);
    rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0.14, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(rig.rightElbow.rotation.x, -0.92 + Math.sin(time * 5.0) * 0.16, dampFactor);
    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, lBeat, dampFactor);
    rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, -0.14, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(rig.leftElbow.rotation.x, -0.88 + Math.cos(time * 4.3) * 0.16, dampFactor);
  } else {
    rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(
      rig.rightShoulder.rotation.x,
      moving ? strideSin * armSwing : 0.04,
      dampFactor
    );
    rig.rightShoulder.rotation.y = THREE.MathUtils.lerp(rig.rightShoulder.rotation.y, 0, dampFactor);
    rig.rightElbow.rotation.x = THREE.MathUtils.lerp(
      rig.rightElbow.rotation.x,
      moving ? -0.35 - Math.max(0, -strideSin) * 0.45 : -0.18,
      dampFactor
    );

    rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(
      rig.leftShoulder.rotation.x,
      moving ? -strideSin * armSwing : 0.04,
      dampFactor
    );
    rig.leftShoulder.rotation.y = THREE.MathUtils.lerp(rig.leftShoulder.rotation.y, 0, dampFactor);
    rig.leftElbow.rotation.x = THREE.MathUtils.lerp(
      rig.leftElbow.rotation.x,
      moving ? -0.35 - Math.max(0, strideSin) * 0.45 : -0.18,
      dampFactor
    );
  }
  rig.rightShoulder.rotation.z = THREE.MathUtils.lerp(rig.rightShoulder.rotation.z, rShZ, dampFactor);
  rig.leftShoulder.rotation.z = THREE.MathUtils.lerp(rig.leftShoulder.rotation.z, lShZ, dampFactor);

  // 8. Dynamic Cloth Simulation (coat tails, skirts, jacket hem & scarf flutter)
  if (rig.clothHem) {
    const legForwardMax = Math.max(0, -rig.leftHip.rotation.x, -rig.rightHip.rotation.x);
    const legBackMax = Math.max(0, rig.leftHip.rotation.x, rig.rightHip.rotation.x);
    const windFlutter = Math.sin(time * (4.5 + speed * 0.9) + phaseOffset) * (0.045 + windStrength * 0.09 + sprintBlend * 0.12);
    const windCross = Math.cos(time * (3.7 + speed * 0.6) + phaseOffset) * (0.03 + windStrength * 0.06);

    const frontTarget = -legForwardMax * 0.65 - 0.04 + windFlutter * 0.35;
    const backTarget = legBackMax * 0.55 + walkBlend * (0.18 + sprintBlend * 0.32) + Math.abs(windFlutter);
    rig.clothHem.front.rotation.x = THREE.MathUtils.lerp(rig.clothHem.front.rotation.x, frontTarget, dampFactor * 1.3);
    rig.clothHem.back.rotation.x = THREE.MathUtils.lerp(rig.clothHem.back.rotation.x, backTarget, dampFactor * 1.3);
    rig.clothHem.left.rotation.z = THREE.MathUtils.lerp(
      rig.clothHem.left.rotation.z,
      0.06 + Math.abs(strideSin) * 0.1 * walkBlend + windCross,
      dampFactor
    );
    rig.clothHem.right.rotation.z = THREE.MathUtils.lerp(
      rig.clothHem.right.rotation.z,
      -0.06 - Math.abs(strideSin) * 0.1 * walkBlend + windCross,
      dampFactor
    );
    if (rig.clothHem.scarf) {
      rig.clothHem.scarf.rotation.x = THREE.MathUtils.lerp(
        rig.clothHem.scarf.rotation.x,
        0.08 + walkBlend * (0.28 + sprintBlend * 0.48) + windFlutter * 1.6,
        dampFactor * 1.4
      );
      rig.clothHem.scarf.rotation.z = THREE.MathUtils.lerp(
        rig.clothHem.scarf.rotation.z,
        windCross * 1.8 - strideSin * 0.09 * walkBlend,
        dampFactor
      );
    }
  }

  // 9. Head Motion, Listening Nods, Curiosity Tilts & Speech Emphasis
  const workHeadPitch = workPose === 'phone' || workPose === 'clipboard' ? 0.28 : workPose === 'inspect' ? 0.15 : 0;
  const targetHeadYaw = talking
    ? Math.sin(time * 2.1 + phaseOffset) * 0.16
    : Math.abs(gazeYaw) > 0.05
    ? gazeYaw * 0.55
    : Math.sin(time * 0.7 + phaseOffset) * 0.08;
  const targetHeadPitch =
    gesture === 'nod'
      ? Math.sin(time * 6.5 + phaseOffset) * 0.12
      : talking
      ? Math.sin(time * 3.8 + phaseOffset) * 0.07
      : workHeadPitch;
  const targetHeadRoll =
    activeExpr === 'curious' || gesture === 'shrug'
      ? 0.13
      : talking
      ? Math.sin(time * 1.7 + phaseOffset) * 0.06
      : 0;

  rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, targetHeadYaw, dampFactor);
  rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, targetHeadPitch, dampFactor);
  rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, targetHeadRoll, dampFactor);
}
