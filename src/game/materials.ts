import * as THREE from 'three';

export interface MaterialLibrary {
  asphaltMap: THREE.CanvasTexture;
  asphaltRoughnessMap: THREE.CanvasTexture;
  asphaltMaterial: THREE.MeshStandardMaterial;
  sidewalkMaterial: THREE.MeshStandardMaterial;
  skyScraperMats: THREE.MeshStandardMaterial[];
  residentialMats: THREE.MeshStandardMaterial[];
  storefrontMat: THREE.MeshStandardMaterial;
  nexorumSignMat: THREE.MeshStandardMaterial;
  billboardMat: THREE.MeshStandardMaterial;
  carbonFiberMat: THREE.MeshPhysicalMaterial;
  titaniumCyberMat: THREE.MeshPhysicalMaterial;
  goldCyberMat: THREE.MeshPhysicalMaterial;
  cyberGlowCyanMat: THREE.MeshStandardMaterial;
  verticalNeonMats: THREE.MeshStandardMaterial[];
  leatherJacketMat: THREE.MeshStandardMaterial;
  gordJacketBackMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshPhysicalMaterial;
  skinFaceMat: THREE.MeshPhysicalMaterial;
  tireMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshPhysicalMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  waterMat: THREE.MeshPhysicalMaterial;
  bloodDropMat: THREE.MeshPhysicalMaterial;
  bloodPoolMat: THREE.MeshPhysicalMaterial;
  sparkMat: THREE.MeshBasicMaterial;
  shellMat: THREE.MeshStandardMaterial;
  smokeMat: THREE.MeshStandardMaterial;
  setRainWetness: (wetness: number) => void;
  setNightEmissive: (nightFactor: number) => void;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function configTex(tex: THREE.CanvasTexture, srgb: boolean, maxAniso: number, repeatX = 1, repeatY = 1) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterialLibrary(renderer: THREE.WebGLRenderer, isSoftwareGl: boolean): MaterialLibrary {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  // 1. High-res Asphalt + Puddle Roughness Map
  const [aspCanvas, aspCtx] = makeCanvas(1024, 1024);
  aspCtx.fillStyle = '#1b1e24';
  aspCtx.fillRect(0, 0, 1024, 1024);
  // Micro aggregate noise
  for (let i = 0; i < 42000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const v = 22 + Math.floor(Math.random() * 28);
    aspCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    aspCtx.fillRect(x, y, 2, 2);
  }
  // Subtle tire wear tracks
  aspCtx.fillStyle = 'rgba(10, 12, 16, 0.25)';
  aspCtx.fillRect(160, 0, 120, 1024);
  aspCtx.fillRect(744, 0, 120, 1024);

  const asphaltMap = configTex(new THREE.CanvasTexture(aspCanvas), true, maxAniso, 36, 36);
  textures.push(asphaltMap);

  const [roughCanvas, roughCtx] = makeCanvas(512, 512);
  roughCtx.fillStyle = '#b8b8b8';
  roughCtx.fillRect(0, 0, 512, 512);
  // Organic puddle patches (darker = glossier reflection)
  for (let i = 0; i < 28; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const rx = 30 + Math.random() * 85;
    const ry = 20 + Math.random() * 65;
    const grad = roughCtx.createRadialGradient(px, py, 2, px, py, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(18, 18, 18, 0.92)');
    grad.addColorStop(0.65, 'rgba(55, 55, 55, 0.65)');
    grad.addColorStop(1, 'rgba(180, 180, 180, 0)');
    roughCtx.fillStyle = grad;
    roughCtx.beginPath();
    roughCtx.ellipse(px, py, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    roughCtx.fill();
  }
  const asphaltRoughnessMap = configTex(new THREE.CanvasTexture(roughCanvas), false, maxAniso, 22, 22);
  textures.push(asphaltRoughnessMap);

  const asphaltMaterial = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    bumpMap: asphaltMap,
    bumpScale: 0.045,
    roughnessMap: asphaltRoughnessMap,
    roughness: 0.72,
    metalness: 0.14,
    envMapIntensity: 1.45,
  });
  materials.push(asphaltMaterial);

  // 2. Sidewalk Concrete Pavers
  const [swCanvas, swCtx] = makeCanvas(512, 512);
  swCtx.fillStyle = '#535861';
  swCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const v = 72 + Math.floor(Math.random() * 34);
    swCtx.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    swCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  swCtx.strokeStyle = 'rgba(28, 32, 38, 0.55)';
  swCtx.lineWidth = 3;
  for (let x = 0; x <= 512; x += 64) {
    swCtx.beginPath();
    swCtx.moveTo(x, 0);
    swCtx.lineTo(x, 512);
    swCtx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(512, y);
    swCtx.stroke();
  }
  const swTex = configTex(new THREE.CanvasTexture(swCanvas), true, maxAniso, 4, 4);
  textures.push(swTex);

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    map: swTex,
    bumpMap: swTex,
    bumpScale: 0.055,
    roughness: 0.85,
    metalness: 0.06,
  });
  materials.push(sidewalkMaterial);

  // 3. Skyscraper Curtain Wall Facades (4 architectural styles)
  const skyScraperMats: THREE.MeshStandardMaterial[] = [];
  const facadeThemes = [
    { frame: '#161b24', glass: '#1f3348', glowWarm: '#ffd28a', glowCool: '#7dd3fc' },
    { frame: '#232730', glass: '#263847', glowWarm: '#fde68a', glowCool: '#a5f3fc' },
    { frame: '#13161d', glass: '#1a2736', glowWarm: '#fbbf24', glowCool: '#60a5fa' },
    { frame: '#2e2b29', glass: '#2f3d47', glowWarm: '#fed7aa', glowCool: '#bae6fd' },
  ];

  for (const theme of facadeThemes) {
    const [colC, colCtx] = makeCanvas(512, 1024);
    const [emC, emCtx] = makeCanvas(512, 1024);

    colCtx.fillStyle = theme.frame;
    colCtx.fillRect(0, 0, 512, 1024);
    emCtx.fillStyle = '#000000';
    emCtx.fillRect(0, 0, 512, 1024);

    const cols = 8;
    const rows = 20;
    const padX = 8;
    const padY = 10;
    const cellW = 512 / cols;
    const cellH = 1024 / rows;

    for (let r = 0; r < rows; r++) {
      const floorLit = Math.random() > 0.22;
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + padX * 0.5;
        const y = r * cellH + padY * 0.5;
        const w = cellW - padX;
        const h = cellH - padY;

        // Subtle interior gradient per pane
        const g = colCtx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, theme.glass);
        g.addColorStop(1, '#0e1722');
        colCtx.fillStyle = g;
        colCtx.fillRect(x, y, w, h);

        // Specular reflection streak on glass
        colCtx.fillStyle = 'rgba(255,255,255,0.06)';
        colCtx.fillRect(x + 2, y + 2, w * 0.3, h - 4);

        const isLit = floorLit && Math.random() > 0.35;
        if (isLit) {
          const glowCol = Math.random() > 0.35 ? theme.glowWarm : theme.glowCool;
          emCtx.fillStyle = glowCol;
          emCtx.fillRect(x + 2, y + 3, w - 4, h - 6);
          // Blinds/office detail inside lit window
          emCtx.fillStyle = 'rgba(0,0,0,0.32)';
          emCtx.fillRect(x + 2, y + h * 0.65, w - 4, h * 0.3);
        }
      }
    }

    const colTex = configTex(new THREE.CanvasTexture(colC), true, maxAniso, 1, 1);
    const emTex = configTex(new THREE.CanvasTexture(emC), true, maxAniso, 1, 1);
    textures.push(colTex, emTex);

    const mat = new THREE.MeshStandardMaterial({
      map: colTex,
      bumpMap: colTex,
      bumpScale: 0.08,
      emissiveMap: emTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.72,
      envMapIntensity: 1.55,
    });
    materials.push(mat);
    skyScraperMats.push(mat);
  }

  // 4. Classical Limestone & Brick Facades (Matrix Awakens / European Avenue look)
  const residentialMats: THREE.MeshStandardMaterial[] = [];
  const resColors = ['#7c756b', '#5e3d34', '#8b8378', '#3d4551'];
  for (const baseCol of resColors) {
    const [rc, rctx] = makeCanvas(512, 512);
    const [ec, ectx] = makeCanvas(512, 512);
    rctx.fillStyle = baseCol;
    rctx.fillRect(0, 0, 512, 512);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, 512, 512);

    for (let y = 24; y < 512; y += 84) {
      for (let x = 22; x < 512; x += 72) {
        rctx.fillStyle = '#18202c';
        rctx.fillRect(x, y, 42, 56);
        rctx.strokeStyle = '#cbd5e1';
        rctx.lineWidth = 2;
        rctx.strokeRect(x, y, 42, 56);
        if (Math.random() > 0.42) {
          ectx.fillStyle = '#fde0a0';
          ectx.fillRect(x + 3, y + 3, 36, 50);
        }
      }
    }
    const rTex = configTex(new THREE.CanvasTexture(rc), true, maxAniso, 1, 2);
    const eTex = configTex(new THREE.CanvasTexture(ec), true, maxAniso, 1, 2);
    textures.push(rTex, eTex);

    const mat = new THREE.MeshStandardMaterial({
      map: rTex,
      bumpMap: rTex,
      bumpScale: 0.1,
      emissiveMap: eTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.6,
      roughness: 0.76,
      metalness: 0.14,
    });
    materials.push(mat);
    residentialMats.push(mat);
  }

  // 5. Storefront Glass & Café Base
  const [sfC, sfCtx] = makeCanvas(512, 256);
  sfCtx.fillStyle = '#11161f';
  sfCtx.fillRect(0, 0, 512, 256);
  for (let x = 16; x < 512; x += 120) {
    const g = sfCtx.createLinearGradient(x, 40, x, 230);
    g.addColorStop(0, '#f59e0b');
    g.addColorStop(0.5, '#78350f');
    g.addColorStop(1, '#1e293b');
    sfCtx.fillStyle = g;
    sfCtx.fillRect(x, 44, 96, 188);
  }
  const sfTex = configTex(new THREE.CanvasTexture(sfC), true, maxAniso, 2, 1);
  textures.push(sfTex);
  const storefrontMat = new THREE.MeshStandardMaterial({
    map: sfTex,
    emissiveMap: sfTex,
    emissive: new THREE.Color(0xffdfa8),
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.4,
  });
  materials.push(storefrontMat);

  // 6. NEXORUM Tower Sign
  const [signC, signCtx] = makeCanvas(512, 256);
  signCtx.fillStyle = '#070b14';
  signCtx.fillRect(0, 0, 512, 256);
  signCtx.strokeStyle = '#38bdf8';
  signCtx.lineWidth = 6;
  signCtx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = 256 + Math.cos(a) * 54;
    const py = 92 + Math.sin(a) * 54;
    if (i === 0) signCtx.moveTo(px, py);
    else signCtx.lineTo(px, py);
  }
  signCtx.closePath();
  signCtx.stroke();
  signCtx.fillStyle = '#e2e8f0';
  signCtx.font = 'bold 54px Oxanium, sans-serif';
  signCtx.textAlign = 'center';
  signCtx.fillText('NEXORUM', 256, 206);
  const signTex = configTex(new THREE.CanvasTexture(signC), true, maxAniso);
  textures.push(signTex);
  const nexorumSignMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissiveMap: signTex,
    emissive: new THREE.Color(0x93c5fd),
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.5,
  });
  materials.push(nexorumSignMat);

  // 7. Billboard ("NEXORUM — THE FUTURE IS NOW")
  const [bbC, bbCtx] = makeCanvas(1024, 512);
  const bbGrad = bbCtx.createLinearGradient(0, 0, 1024, 512);
  bbGrad.addColorStop(0, '#07111f');
  bbGrad.addColorStop(0.55, '#11253d');
  bbGrad.addColorStop(1, '#1e1b2e');
  bbCtx.fillStyle = bbGrad;
  bbCtx.fillRect(0, 0, 1024, 512);
  // Subtle geometric silhouette of cyber-hero on right
  bbCtx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  bbCtx.beginPath();
  bbCtx.arc(760, 260, 180, 0, Math.PI * 2);
  bbCtx.fill();
  bbCtx.fillStyle = '#f8fafc';
  bbCtx.font = 'bold 92px Oxanium, sans-serif';
  bbCtx.fillText('NEXORUM', 74, 240);
  bbCtx.fillStyle = '#38bdf8';
  bbCtx.font = '600 34px Plus Jakarta Sans, sans-serif';
  bbCtx.fillText('THE FUTURE IS NOW', 78, 305);
  bbCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  bbCtx.lineWidth = 4;
  bbCtx.strokeRect(20, 20, 984, 472);
  const bbTex = configTex(new THREE.CanvasTexture(bbC), true, maxAniso);
  textures.push(bbTex);
  const billboardMat = new THREE.MeshStandardMaterial({
    map: bbTex,
    emissiveMap: bbTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.15,
    roughness: 0.3,
  });
  materials.push(billboardMat);

  // 8. Carbon Fiber & Titanium Cyber Materials
  const [cfC, cfCtx] = makeCanvas(256, 256);
  cfCtx.fillStyle = '#12151c';
  cfCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      cfCtx.fillStyle = (x + y) % 16 === 0 ? '#1e2430' : '#0b0d12';
      cfCtx.fillRect(x, y, 4, 4);
    }
  }
  const cfTex = configTex(new THREE.CanvasTexture(cfC), true, maxAniso, 4, 4);
  textures.push(cfTex);

  const carbonFiberMat = new THREE.MeshPhysicalMaterial({
    map: cfTex,
    roughness: 0.32,
    metalness: 0.45,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const titaniumCyberMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa4b2,
    metalness: 0.92,
    roughness: 0.22,
    anisotropy: 0.75,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });

  const goldCyberMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8c38c,
    metalness: 0.96,
    roughness: 0.17,
    anisotropy: 0.85,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
  });

  const cyberGlowCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const verticalNeonMats: THREE.MeshStandardMaterial[] = [];
  const neonConfigs = [
    { bg: '#081b2e', fg: '#38bdf8', text: 'NEXORUM' },
    { bg: '#2c0b16', fg: '#fb7185', text: 'CLUB 24' },
    { bg: '#0b291e', fg: '#34d399', text: 'CYBER MED' },
    { bg: '#2b1b09', fg: '#fbbf24', text: 'MOTORS' },
  ];
  for (const nc of neonConfigs) {
    const [nC, nCtx] = makeCanvas(128, 384);
    nCtx.fillStyle = nc.bg;
    nCtx.fillRect(0, 0, 128, 384);
    nCtx.strokeStyle = nc.fg;
    nCtx.lineWidth = 6;
    nCtx.strokeRect(8, 8, 112, 368);
    nCtx.fillStyle = nc.fg;
    nCtx.font = 'bold 26px Oxanium, sans-serif';
    nCtx.textAlign = 'center';
    for (let i = 0; i < nc.text.length; i++) {
      nCtx.fillText(nc.text[i], 64, 58 + i * 38);
    }
    const nTex = configTex(new THREE.CanvasTexture(nC), true, maxAniso);
    textures.push(nTex);
    const nMat = new THREE.MeshStandardMaterial({
      map: nTex,
      emissiveMap: nTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.4,
      roughness: 0.25,
    });
    materials.push(nMat);
    verticalNeonMats.push(nMat);
  }

  // 9. Gord Leather Jacket (Back with NEXORUM emblem)
  const [jkC, jkCtx] = makeCanvas(512, 512);
  jkCtx.fillStyle = '#16181e';
  jkCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const v = 18 + Math.floor(Math.random() * 14);
    jkCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    jkCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Jacket seams
  jkCtx.strokeStyle = '#2b303c';
  jkCtx.lineWidth = 4;
  jkCtx.strokeRect(40, 20, 432, 472);
  const jkTex = configTex(new THREE.CanvasTexture(jkC), true, maxAniso);
  textures.push(jkTex);

  const leatherJacketMat = new THREE.MeshStandardMaterial({
    map: jkTex,
    bumpMap: jkTex,
    bumpScale: 0.028,
    roughness: 0.52,
    metalness: 0.14,
  });

  const [jkBackC, jkBackCtx] = makeCanvas(512, 512);
  jkBackCtx.drawImage(jkC, 0, 0);
  // NEXORUM logo on Gord's back
  jkBackCtx.strokeStyle = '#cbd5e1';
  jkBackCtx.lineWidth = 6;
  jkBackCtx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = 256 + Math.cos(a) * 42;
    const py = 180 + Math.sin(a) * 42;
    if (i === 0) jkBackCtx.moveTo(px, py);
    else jkBackCtx.lineTo(px, py);
  }
  jkBackCtx.closePath();
  jkBackCtx.stroke();
  jkBackCtx.fillStyle = '#e2e8f0';
  jkBackCtx.font = 'bold 42px Oxanium, sans-serif';
  jkBackCtx.textAlign = 'center';
  jkBackCtx.fillText('NEXORUM', 256, 274);
  const jkBackTex = configTex(new THREE.CanvasTexture(jkBackC), true, maxAniso);
  textures.push(jkBackTex);

  const gordJacketBackMat = new THREE.MeshStandardMaterial({
    map: jkBackTex,
    bumpMap: jkBackTex,
    bumpScale: 0.024,
    roughness: 0.48,
    metalness: 0.16,
  });

  // 10. Realistic Human Skin & Face Texture
  const [skC, skCtx] = makeCanvas(256, 256);
  skCtx.fillStyle = '#d4a383';
  skCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    skCtx.fillStyle = Math.random() > 0.5 ? 'rgba(180,115,85,0.08)' : 'rgba(245,205,180,0.08)';
    skCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const skTex = configTex(new THREE.CanvasTexture(skC), true, maxAniso);
  textures.push(skTex);

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skTex,
    bumpMap: skTex,
    bumpScale: 0.008,
    roughness: 0.54,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.62,
    sheen: 0.24,
    sheenColor: new THREE.Color(0xffb899),
  });

  // Face texture with subtle stubble, eyebrows, natural lips shading
  const [fcC, fcCtx] = makeCanvas(512, 512);
  fcCtx.fillStyle = '#d4a383';
  fcCtx.fillRect(0, 0, 512, 512);
  // Subtle cheek blush & nose bridge shading
  const cheekG = fcCtx.createRadialGradient(256, 270, 30, 256, 270, 220);
  cheekG.addColorStop(0, 'rgba(218, 152, 122, 0.3)');
  cheekG.addColorStop(1, 'rgba(150, 96, 72, 0.18)');
  fcCtx.fillStyle = cheekG;
  fcCtx.fillRect(0, 0, 512, 512);
  // Beard stubble on lower jaw
  const stubbleG = fcCtx.createLinearGradient(0, 300, 0, 480);
  stubbleG.addColorStop(0, 'rgba(40, 32, 28, 0)');
  stubbleG.addColorStop(0.4, 'rgba(40, 32, 28, 0.22)');
  stubbleG.addColorStop(1, 'rgba(40, 32, 28, 0.34)');
  fcCtx.fillStyle = stubbleG;
  fcCtx.fillRect(140, 300, 232, 180);
  const fcTex = configTex(new THREE.CanvasTexture(fcC), true, maxAniso);
  textures.push(fcTex);

  const skinFaceMat = new THREE.MeshPhysicalMaterial({
    map: fcTex,
    bumpMap: skTex,
    bumpScale: 0.008,
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.58,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xffb899),
  });

  // 11. Tire, Chrome, Glass, Water
  const [trC, trCtx] = makeCanvas(256, 256);
  trCtx.fillStyle = '#15171c';
  trCtx.fillRect(0, 0, 256, 256);
  trCtx.fillStyle = '#0b0c0f';
  for (let y = 0; y < 256; y += 16) {
    trCtx.fillRect(0, y, 256, 6);
  }
  const trTex = configTex(new THREE.CanvasTexture(trC), true, maxAniso, 2, 8);
  textures.push(trTex);
  const tireMat = new THREE.MeshStandardMaterial({
    map: trTex,
    roughness: 0.86,
    metalness: 0.08,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.12,
    clearcoat: 0.6,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.15,
    roughness: 0.06,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.9,
    ior: 1.52,
    thickness: 0.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  // Animated Harbor Water with onBeforeCompile wave vertex displacement
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c2d42,
    roughness: 0.14,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.92,
  });
  const waterUniforms = { uTime: { value: 0 } };
  waterMat.userData = waterUniforms;
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float w1 = sin(position.x * 0.09 + uTime * 1.4) * cos(position.y * 0.08 + uTime * 1.1) * 0.35;
      float w2 = sin(position.x * 0.22 - uTime * 2.1 + position.y * 0.17) * 0.14;
      transformed.z += w1 + w2;
      `
    );
  };

  // 12. Pooled Realistic Blood, Crash Sparks, Shell Casings & Smoke FX Materials
  const bloodDropMat = new THREE.MeshPhysicalMaterial({
    color: 0x8b0a10,
    roughness: 0.14,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const bloodPoolMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c0509,
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.22 });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.95,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  materials.push(
    carbonFiberMat,
    titaniumCyberMat,
    goldCyberMat,
    cyberGlowCyanMat,
    leatherJacketMat,
    gordJacketBackMat,
    skinMat,
    skinFaceMat,
    tireMat,
    chromeMat,
    glassMat,
    waterMat,
    bloodDropMat,
    bloodPoolMat,
    sparkMat,
    shellMat,
    smokeMat
  );

  return {
    asphaltMap,
    asphaltRoughnessMap,
    asphaltMaterial,
    sidewalkMaterial,
    skyScraperMats,
    residentialMats,
    storefrontMat,
    nexorumSignMat,
    billboardMat,
    carbonFiberMat,
    titaniumCyberMat,
    goldCyberMat,
    cyberGlowCyanMat,
    verticalNeonMats,
    leatherJacketMat,
    gordJacketBackMat,
    skinMat,
    skinFaceMat,
    tireMat,
    chromeMat,
    glassMat,
    waterMat,
    bloodDropMat,
    bloodPoolMat,
    sparkMat,
    shellMat,
    smokeMat,
    setRainWetness: (wetness: number) => {
      asphaltMaterial.roughness = THREE.MathUtils.lerp(0.76, 0.2, wetness);
      asphaltMaterial.metalness = THREE.MathUtils.lerp(0.1, 0.42, wetness);
      asphaltMaterial.envMapIntensity = THREE.MathUtils.lerp(1.1, 2.2, wetness);
      sidewalkMaterial.roughness = THREE.MathUtils.lerp(0.86, 0.35, wetness);
    },
    setNightEmissive: (nightFactor: number) => {
      const buildingGlow = THREE.MathUtils.lerp(0.28, 1.35, nightFactor);
      for (const m of skyScraperMats) m.emissiveIntensity = buildingGlow;
      for (const m of residentialMats) m.emissiveIntensity = buildingGlow * 0.75;
      storefrontMat.emissiveIntensity = THREE.MathUtils.lerp(0.35, 1.15, nightFactor);
    },
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
