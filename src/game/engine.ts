import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createMaterialLibrary, MaterialLibrary } from './materials';
import { buildCity, BuildingCollider, getIntersectionSignal, PhysicsProp, ROAD_CENTERS, TrafficSignalSet } from './city';
import { animateCharacterRig, buildGordCharacter, buildHumanNpc, CharacterRig, NpcRole } from './characters';
import { buildVehicle, deformVehicleBody, VehicleInstance } from './vehicles';
import { SoundEngine } from './audio';
import {
  CITY_POIS,
  INITIAL_PROPERTIES,
  INITIAL_UPGRADES,
  INITIAL_VEHICLES_CATALOG,
  INITIAL_WEAPONS,
  NPC_DIALOGUES,
  STORY_MISSIONS,
} from './data';
import {
  CameraMode,
  CyberStage,
  CyberUpgrade,
  GraphicsQuality,
  HudSnapshot,
  MissionStep,
  PropertyItem,
  TimeOfDay,
  VehicleCatalogItem,
  VehicleKind,
  WeatherType,
  WeaponSlot,
} from './types';

// Zero-GC reusable math objects
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();

interface NpcActor {
  id: string;
  role: NpcRole;
  rig: CharacterRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  fireCooldown: number;
  talkingTimer: number;
  patrolAngle: number;
  missionTag?: string;
  phase: number;
  hitFlinchTimer?: number;
  panicTimer?: number;
  knockVx?: number;
  knockVz?: number;
}

interface BulletTracer {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  fromPlayer: boolean;
  damage: number;
}

interface GrenadeProj {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

interface ExplosionFx {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface FxParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  kind: 'blood' | 'spark' | 'shell' | 'smoke';
}

interface BloodPool {
  mesh: THREE.Mesh;
  targetScale: number;
  currentScale: number;
}

export class NexorumEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private mats: MaterialLibrary;
  private audio = new SoundEngine();

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private weatherPoints: THREE.Points;
  private weatherVelY = 0;

  private colliders: BuildingCollider[] = [];
  private physicsProps: PhysicsProp[] = [];
  private trafficSignals: TrafficSignalSet[] = [];
  private gordRig: CharacterRig;
  private vehicles: VehicleInstance[] = [];
  private npcs: NpcActor[] = [];
  private bullets: BulletTracer[] = [];
  private grenades: GrenadeProj[] = [];
  private explosions: ExplosionFx[] = [];
  private fxParticles: FxParticle[] = [];
  private bloodPools: BloodPool[] = [];
  private missionMarker: THREE.Group;
  private muzzleLight: THREE.PointLight;

  // Player state
  private px = -4;
  private py = 0.16;
  private pz = 12;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private pYaw = Math.PI; // Facing downtown skyline (-Z) initially!
  private grounded = true;
  private currentVehicle: VehicleInstance | null = null;
  private meleeSwingTimer = 0;
  private fireCooldown = 0;
  private reloadTimer = 0;
  private muzzleTimer = 0;
  private weaponRecoil = 0;
  private damageFlash = 0;
  private cameraShake = 0;
  private wantedCooldown = 0;
  private incomeTimer = 0;

  // Camera state
  private cameraMode: CameraMode = 'third_close';
  private camYaw = Math.PI;
  private camPitch = 0.24;
  private camDist = 6.2;
  private isDraggingLook = false;
  private pointerLocked = false;
  private aiming = false;

  // Progression & RPG State
  private health = 100;
  private maxHealth = 100;
  private armor = 60;
  private maxArmor = 100;
  private stamina = 100;
  private maxStamina = 100;
  private cyberEnergy = 100;
  private maxCyberEnergy = 100;
  private money = 15000;
  private xp = 450;
  private xpNext = 1000;
  private level = 1;
  private wantedStars = 0;
  private cyberStage: CyberStage = 0;
  private cyberOverdriveActive = false;
  private cyberTransformBannerTimer = 0;
  private activeSlot = 1;
  private weapons: WeaponSlot[] = structuredClone(INITIAL_WEAPONS);
  private upgrades: CyberUpgrade[] = structuredClone(INITIAL_UPGRADES);
  private properties: PropertyItem[] = structuredClone(INITIAL_PROPERTIES);
  private vehicleCatalog: VehicleCatalogItem[] = structuredClone(INITIAL_VEHICLES_CATALOG);
  private missions: MissionStep[] = structuredClone(STORY_MISSIONS);
  private missionIndex = 0;

  private activeDialogue: { speaker: string; role: string; text: string } | null = null;
  private dialogueTimer = 0;
  private activeJob: { title: string; targetX: number; targetZ: number; reward: number; timeLeft: number } | null = null;
  private notification: string | null = null;
  private notificationTimer = 0;

  private timeOfDay: TimeOfDay = 'sunset';
  private weather: WeatherType = 'clear';
  private graphicsQuality: GraphicsQuality = 'high';
  private bloomEnabled = true;
  private fogScale = 1.0;
  private paused = true;

  // Input flags
  private keys = new Set<string>();
  private mouseDownLeft = false;

  // Loop management
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudEmitAccum = 0;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onMenuShortcut: (key: string) => void;

  // Shared geometries for projectiles & realistic FX
  private bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
  private bulletMatPlayer = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  private bulletMatEnemy = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private explosionGeo = new THREE.SphereGeometry(1, 14, 12);
  private bloodDropGeo = new THREE.SphereGeometry(0.055, 6, 6);
  private bloodPoolGeo = new THREE.CircleGeometry(0.55, 16);
  private sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.16);
  private shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6);
  private smokeGeo = new THREE.SphereGeometry(0.32, 8, 6);

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onMenuShortcut: (key: string) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onMenuShortcut = onMenuShortcut;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Scene & Studio Environment Map (RoomEnvironment)
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1f2233, 0.0028);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Camera
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 950);

    // 5. Procedural HDRP Sky Dome with Volumetric Clouds
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x1a223b) },
        uMidColor: { value: new THREE.Color(0x7c486b) },
        uHorizonColor: { value: new THREE.Color(0xe89365) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.22, -0.88).normalize() },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.05;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
          col = mix(col, uTopColor, smoothstep(0.25, 0.85, h));
          float sunDot = max(dot(dir, uSunDir), 0.0);
          col += vec3(1.0, 0.72, 0.45) * pow(sunDot, 28.0) * 0.65;
          col += vec3(1.0, 0.9, 0.75) * pow(sunDot, 220.0) * 1.1;

          // Volumetric horizon & high-altitude cloud layer
          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.35 + vec2(uTime * 0.008, uTime * 0.004);
            float n = fbm(cloudUv);
            float cloudMask = smoothstep(0.48, 0.78, n) * smoothstep(0.02, 0.25, dir.y);
            vec3 cloudCol = mix(uHorizonColor * 1.15, vec3(1.0, 0.92, 0.82), pow(sunDot, 3.0) * 0.65 + 0.2);
            col = mix(col, cloudCol, cloudMask * 0.52);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(780, 24, 16), this.skyMat);
    this.scene.add(skyDome);

    // 6. Lighting Rig (HDRP Warm Key + Cool Hemisphere Fill + Dynamic Combat PointLight)
    this.hemiLight = new THREE.HemisphereLight(0x8aa8d6, 0x2a2430, 0.8);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffcb99, 2.35);
    this.sunLight.position.set(60, 75, -120);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 260;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.muzzleLight = new THREE.PointLight(0xffae42, 0, 18, 1.8);
    this.scene.add(this.muzzleLight);

    // 7. Materials & City
    this.mats = createMaterialLibrary(this.renderer, this.isSoftwareGl);
    const city = buildCity(this.mats);
    this.scene.add(city.group);
    this.colliders = city.colliders;
    this.physicsProps = city.physicsProps;
    this.trafficSignals = city.trafficSignals;

    // 8. Hero Gord
    this.gordRig = buildGordCharacter(this.mats);
    this.gordRig.root.position.set(this.px, this.py, this.pz);
    this.gordRig.root.rotation.y = this.pYaw;
    this.scene.add(this.gordRig.root);

    // 9. Mission Objective Marker
    this.missionMarker = new THREE.Group();
    const mRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    mRing.rotation.x = -Math.PI / 2;
    const mBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.8, 18, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    );
    mBeam.position.y = 9;
    this.missionMarker.add(mRing, mBeam);
    this.scene.add(this.missionMarker);

    // 10. Weather Particle System (Rain / Snow)
    const pCount = 1800;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 90;
      pPos[i * 3 + 1] = Math.random() * 45;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.22, transparent: true, opacity: 0.65 });
    this.weatherPoints = new THREE.Points(pGeo, pMat);
    this.weatherPoints.visible = false;
    this.weatherPoints.frustumCulled = false;
    this.scene.add(this.weatherPoints);

    // 11. Spawn Hero Supercar, Motorcycle, Helicopter, Jet & Living Traffic/Pedestrians
    this.populateWorld();

    // 12. Post-processing on GPU
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight),
        0.32,
        0.45,
        0.88
      );
      this.composer.addPass(this.bloomPass);
    }

    this.graphicsQuality = this.isSoftwareGl ? 'medium' : 'high';
    this.applyGraphicsQuality();
    this.applyAtmosphere();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.tick();
  }

  private populateWorld() {
    // Player's Signature Black Supercar right beside Gord
    const heroCar = buildVehicle('hero_supercar', 'supercar', 'Nexorum V12 Phantom', '#0d1016', this.mats, { maxSpeedKmh: 315 });
    heroCar.x = 6.5;
    heroCar.z = 6;
    heroCar.yaw = Math.PI - 0.25;
    heroCar.root.position.set(heroCar.x, 0, heroCar.z);
    heroCar.root.rotation.y = heroCar.yaw;
    this.scene.add(heroCar.root);
    this.vehicles.push(heroCar);

    // Crimson Red Supercar (inspired by Matrix/GTA reference shots)
    const redSupercar = buildVehicle('red_supercar', 'supercar', 'Solaris GT Rosso', '#991b1b', this.mats, { maxSpeedKmh: 305 });
    redSupercar.x = -18;
    redSupercar.z = -30;
    redSupercar.yaw = Math.PI / 2;
    redSupercar.root.position.set(redSupercar.x, 0, redSupercar.z);
    redSupercar.root.rotation.y = redSupercar.yaw;
    this.scene.add(redSupercar.root);
    this.vehicles.push(redSupercar);

    // Sport Motorcycle across the plaza
    const heroMoto = buildVehicle('hero_moto', 'motorcycle', 'Valkyrie R-1000', '#991b1b', this.mats, { maxSpeedKmh: 265 });
    heroMoto.x = -9.5;
    heroMoto.z = 5;
    heroMoto.yaw = Math.PI + 0.3;
    heroMoto.root.position.set(heroMoto.x, 0, heroMoto.z);
    heroMoto.root.rotation.y = heroMoto.yaw;
    this.scene.add(heroMoto.root);
    this.vehicles.push(heroMoto);

    // Armored SUV near Police HQ
    const suv = buildVehicle('city_suv', 'suv', 'Kodiak Armored 4x4', '#334155', this.mats, { maxSpeedKmh: 190 });
    suv.x = 85;
    suv.z = -15;
    suv.yaw = -Math.PI / 2;
    suv.root.position.set(suv.x, 0, suv.z);
    suv.root.rotation.y = suv.yaw;
    this.scene.add(suv.root);
    this.vehicles.push(suv);

    // Helicopter at Port Helipad
    const heli = buildVehicle('port_heli', 'helicopter', 'Bellator UH-88', '#111827', this.mats, { maxSpeedKmh: 245 });
    heli.x = 55;
    heli.y = 0.25;
    heli.z = 265;
    heli.yaw = Math.PI;
    heli.root.position.set(heli.x, heli.y, heli.z);
    heli.root.rotation.y = heli.yaw;
    this.scene.add(heli.root);
    this.vehicles.push(heli);

    // Fighter Jet on Port Runway
    const jet = buildVehicle('port_jet', 'jet', 'NX-22 Peregrine', '#3f4756', this.mats, { maxSpeedKmh: 620 });
    jet.x = 120;
    jet.y = 0.22;
    jet.z = 265;
    jet.yaw = Math.PI / 2;
    jet.root.position.set(jet.x, jet.y, jet.z);
    jet.root.rotation.y = jet.yaw;
    this.scene.add(jet.root);
    this.vehicles.push(jet);

    // AI City Traffic Cars & Dedicated NCPD Patrol Cruisers
    const trafficColors = ['#1e293b', '#374151', '#7f1d1d', '#1e3a8a', '#cbd5e1', '#0f766e'];
    const patrolRoadGrid = [-150, -90, -30, 30, 90, 150];
    for (let i = 0; i < 18; i++) {
      const isCop = i % 3 === 0; // 6 active NCPD patrol cruisers roaming the city
      const kind: VehicleKind = isCop ? 'police' : i % 4 === 1 ? 'suv' : 'sedan';
      const car = buildVehicle(
        `traffic_${i}`,
        kind,
        isCop ? 'NCPD Patrol Cruiser' : 'Городской трафик',
        isCop ? '#0f172a' : trafficColors[i % trafficColors.length],
        this.mats,
        { isTraffic: true, isPolice: isCop, maxSpeedKmh: isCop ? 230 : 165 }
      );
      const roadIdx = i % patrolRoadGrid.length;
      const alongX = i % 2 === 0;
      const dirSign = i % 4 < 2 ? 1 : -1;
      if (alongX) {
        car.yaw = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        const laneOffset = dirSign > 0 ? 3.8 : -3.8;
        car.x = -165 + ((i * 47) % 330);
        car.z = patrolRoadGrid[roadIdx] + laneOffset;
        car.trafficDirX = dirSign;
        car.trafficDirZ = 0;
      } else {
        car.yaw = dirSign > 0 ? 0 : Math.PI;
        const laneOffset = dirSign > 0 ? -3.8 : 3.8;
        car.x = patrolRoadGrid[roadIdx] + laneOffset;
        car.z = -165 + ((i * 53) % 300);
        car.trafficDirX = 0;
        car.trafficDirZ = dirSign;
      }
      car.patrolTargetYaw = car.yaw;
      car.patrolTurnCooldown = 1.0 + (i % 3) * 0.7;
      car.root.position.set(car.x, 0, car.z);
      car.root.rotation.y = car.yaw;
      this.scene.add(car.root);
      this.vehicles.push(car);
    }

    // Living City Pedestrians (Walking, Talking, Police)
    for (let i = 0; i < 22; i++) {
      const role: NpcRole = i < 3 ? 'police' : 'civilian';
      const rig = buildHumanNpc(this.mats, role, i);
      const bx = ((i * 60) % 240) - 120;
      const bz = ((Math.floor(i / 4) * 60) % 240) - 120;
      const sx = bx + (i % 2 === 0 ? 22 : -22);
      const sz = bz + ((i * 13) % 32) - 16;
      rig.root.position.set(sx, 0.16, sz);
      this.scene.add(rig.root);
      this.npcs.push({
        id: `npc_${i}`,
        role,
        rig,
        x: sx,
        y: 0.16,
        z: sz,
        yaw: Math.random() * Math.PI * 2,
        vx: 0,
        vz: 0,
        speed: 1.35 + Math.random() * 0.6,
        health: role === 'police' ? 95 : 55,
        maxHealth: role === 'police' ? 95 : 55,
        alive: true,
        fireCooldown: 0,
        talkingTimer: i % 5 === 0 ? 999 : 0,
        patrolAngle: Math.random() * Math.PI * 2,
        phase: Math.random() * 6,
      });
    }

    // Mission 2 Gangsters at Trade Plaza (120, -120)
    for (let i = 0; i < 4; i++) {
      this.spawnEnemy('gangster', 108 + i * 8, -104, 'm2_gang');
    }

    // Mission 4 Mafia Boss + Guards at Port (0, 255)
    this.spawnEnemy('boss', 0, 260, 'm4_mafia_port');
    for (let i = 0; i < 4; i++) {
      this.spawnEnemy('gangster', -14 + i * 9, 248, 'm4_mafia_port');
    }
  }

  private spawnEnemy(role: NpcRole, x: number, z: number, missionTag?: string) {
    const rig = buildHumanNpc(this.mats, role, Math.floor(Math.random() * 100));
    rig.root.position.set(x, 0.16, z);
    this.scene.add(rig.root);
    this.npcs.push({
      id: `enemy_${Math.random().toString(36).slice(2, 8)}`,
      role,
      rig,
      x,
      y: 0.16,
      z,
      yaw: 0,
      vx: 0,
      vz: 0,
      speed: 2.2,
      health: role === 'boss' ? 240 : 100,
      maxHealth: role === 'boss' ? 240 : 100,
      alive: true,
      fireCooldown: 0.8 + Math.random(),
      talkingTimer: 0,
      patrolAngle: Math.random() * Math.PI * 2,
      missionTag,
      phase: Math.random() * 6,
    });
  }

  // Public Controls from React UI
  public setPaused(p: boolean) {
    this.paused = p;
    if (p && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  public setTimeOfDay(tod: TimeOfDay) {
    this.timeOfDay = tod;
    this.applyAtmosphere();
    this.emitHud();
  }

  public setWeather(w: WeatherType) {
    this.weather = w;
    this.applyAtmosphere();
    this.emitHud();
  }

  public setGraphicsQuality(q: GraphicsQuality) {
    this.graphicsQuality = q;
    this.applyGraphicsQuality();
    this.applyAtmosphere();
    const labels: Record<GraphicsQuality, string> = {
      low: 'Графика: Low (Макс. производительность)',
      medium: 'Графика: Medium (Баланс)',
      high: 'Графика: High (AAA качество)',
      ultra: 'Графика: Ultra (Максимум HDRP)',
    };
    this.showNotification(labels[q]);
    this.emitHud();
  }

  private applyGraphicsQuality() {
    const q = this.graphicsQuality;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    let pixelRatio = 1;
    let shadowsOn = !this.isSoftwareGl;
    let shadowSize = 2048;
    let shadowRange = 55;
    let farDist = 920;
    let bloomOn = !this.isSoftwareGl;
    let bloomStrength = 0.28;
    let bloomRadius = 0.42;
    let bloomThreshold = 0.88;
    let exposure = 1.15;
    let envInt = 1.45;
    let particleRatio = 1.0;
    this.fogScale = 1.0;

    if (q === 'low') {
      pixelRatio = 0.75;
      shadowsOn = false;
      shadowSize = 512;
      shadowRange = 35;
      farDist = 440;
      bloomOn = false;
      exposure = 1.08;
      envInt = 0.65;
      particleRatio = 0.35;
      this.fogScale = 1.35;
    } else if (q === 'medium') {
      pixelRatio = 1.0;
      shadowsOn = !this.isSoftwareGl;
      shadowSize = 1024;
      shadowRange = 45;
      farDist = 680;
      bloomOn = false;
      exposure = 1.12;
      envInt = 1.05;
      particleRatio = 0.65;
      this.fogScale = 1.12;
    } else if (q === 'high') {
      pixelRatio = this.isSoftwareGl ? 1.0 : Math.min(dpr, 1.5);
      shadowsOn = !this.isSoftwareGl;
      shadowSize = this.isSoftwareGl ? 1024 : 2048;
      shadowRange = 60;
      farDist = 920;
      bloomOn = !this.isSoftwareGl;
      bloomStrength = 0.28;
      bloomRadius = 0.42;
      bloomThreshold = 0.88;
      exposure = 1.15;
      envInt = 1.45;
      particleRatio = 1.0;
      this.fogScale = 1.0;
    } else {
      // ultra
      pixelRatio = this.isSoftwareGl ? 1.15 : Math.min(dpr, 2.0);
      shadowsOn = true;
      shadowSize = this.isSoftwareGl ? 1024 : 4096;
      shadowRange = 85;
      farDist = 1200;
      bloomOn = !this.isSoftwareGl;
      bloomStrength = 0.36;
      bloomRadius = 0.52;
      bloomThreshold = 0.84;
      exposure = 1.2;
      envInt = 1.75;
      particleRatio = 1.0;
      this.fogScale = 0.88;
    }

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.toneMappingExposure = exposure;
    this.renderer.shadowMap.enabled = shadowsOn;
    this.sunLight.castShadow = shadowsOn;

    if (this.sunLight.shadow.mapSize.x !== shadowSize) {
      this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.sunLight.shadow.camera.left = -shadowRange;
    this.sunLight.shadow.camera.right = shadowRange;
    this.sunLight.shadow.camera.top = shadowRange;
    this.sunLight.shadow.camera.bottom = -shadowRange;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;

    this.camera.far = farDist;
    this.camera.updateProjectionMatrix();

    this.bloomEnabled = bloomOn;
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.strength = bloomStrength;
      this.bloomPass.radius = bloomRadius;
      this.bloomPass.threshold = bloomThreshold;
      this.bloomPass.resolution.set(w, h);
    }

    this.mats.asphaltMaterial.envMapIntensity = envInt;
    this.weatherPoints.geometry.setDrawRange(0, Math.floor(1800 * particleRatio));
  }

  public setAudioMuted(m: boolean) {
    this.audio.setMuted(m);
  }

  public isAudioMuted(): boolean {
    return this.audio.isMuted();
  }

  private applyAtmosphere() {
    if (this.timeOfDay === 'day') {
      this.skyMat.uniforms.uTopColor.value.setHex(0x2563eb);
      this.skyMat.uniforms.uMidColor.value.setHex(0x60a5fa);
      this.skyMat.uniforms.uHorizonColor.value.setHex(0xdbeafe);
      this.skyMat.uniforms.uSunDir.value.set(0.45, 0.72, -0.52).normalize();
      this.sunLight.color.setHex(0xfff7ed);
      this.sunLight.intensity = 2.6;
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 0.95;
      this.mats.setNightEmissive(0.15);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x93b5d8);
    } else if (this.timeOfDay === 'sunset') {
      this.skyMat.uniforms.uTopColor.value.setHex(0x1b223d);
      this.skyMat.uniforms.uMidColor.value.setHex(0x7c486b);
      this.skyMat.uniforms.uHorizonColor.value.setHex(0xe89365);
      this.skyMat.uniforms.uSunDir.value.set(0.35, 0.18, -0.92).normalize();
      this.sunLight.color.setHex(0xffbe88);
      this.sunLight.intensity = 2.15;
      this.hemiLight.color.setHex(0x93a8d6);
      this.hemiLight.groundColor.setHex(0x2d2430);
      this.hemiLight.intensity = 0.78;
      this.mats.setNightEmissive(0.68);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x4b3d52);
    } else {
      this.skyMat.uniforms.uTopColor.value.setHex(0x030712);
      this.skyMat.uniforms.uMidColor.value.setHex(0x0f172a);
      this.skyMat.uniforms.uHorizonColor.value.setHex(0x1e293b);
      this.skyMat.uniforms.uSunDir.value.set(-0.4, 0.5, -0.7).normalize();
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.85;
      this.hemiLight.color.setHex(0x334155);
      this.hemiLight.groundColor.setHex(0x090d16);
      this.hemiLight.intensity = 0.55;
      this.mats.setNightEmissive(1.0);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x0d1322);
    }

    const pMat = this.weatherPoints.material as THREE.PointsMaterial;
    if (this.weather === 'rain') {
      this.weatherPoints.visible = true;
      this.weatherVelY = -36;
      pMat.color.setHex(0x93c5fd);
      pMat.size = 0.18;
      this.mats.setRainWetness(1.0);
      (this.scene.fog as THREE.FogExp2).density = 0.0042 * this.fogScale;
    } else if (this.weather === 'snow') {
      this.weatherPoints.visible = true;
      this.weatherVelY = -5.5;
      pMat.color.setHex(0xf8fafc);
      pMat.size = 0.28;
      this.mats.setRainWetness(0.35);
      (this.scene.fog as THREE.FogExp2).density = 0.0052 * this.fogScale;
    } else if (this.weather === 'fog') {
      this.weatherPoints.visible = false;
      this.mats.setRainWetness(0.45);
      (this.scene.fog as THREE.FogExp2).density = 0.011 * this.fogScale;
    } else {
      this.weatherPoints.visible = false;
      this.mats.setRainWetness(this.timeOfDay === 'sunset' ? 0.55 : 0.15);
      (this.scene.fog as THREE.FogExp2).density = 0.0024 * this.fogScale;
    }
  }

  // Gameplay Actions invoked from UI Menus
  public selectWeaponSlot(slot: number) {
    this.activeSlot = slot;
    this.gordRig.setActiveWeapon?.(slot);
    this.audio.playUiConfirm();
    this.emitHud();
  }

  public installUpgrade(upgradeId: string): boolean {
    const upg = this.upgrades.find((u) => u.id === upgradeId);
    if (!upg || upg.installed || this.money < upg.cost) return false;
    if (upg.stageRequired > this.cyberStage + 1) {
      this.showNotification(`Сначала установите предыдущий кибер-имплант`);
      return false;
    }
    this.money -= upg.cost;
    upg.installed = true;
    this.cyberStage = upg.stageRequired;
    this.gordRig.setCyberStage?.(this.cyberStage);
    this.cyberTransformBannerTimer = 4.2;
    this.cyberEnergy = this.maxCyberEnergy;
    if (this.cyberStage === 4) {
      this.maxHealth = 180;
      this.maxArmor = 200;
      this.health = this.maxHealth;
      this.armor = this.maxArmor;
    } else {
      this.maxHealth += 15;
      this.health = Math.min(this.maxHealth, this.health + 30);
    }
    this.audio.playUiConfirm();
    this.showNotification(`Кибер-трансформация: ${upg.name}`);
    this.emitHud();
    return true;
  }

  public toggleCyberOverdrive() {
    if (this.cyberStage === 0) {
      this.showNotification('Установите минимум 1 кибер-имплант (меню [K] или миссии)');
      return;
    }
    if (this.cyberOverdriveActive) {
      this.cyberOverdriveActive = false;
      this.mats.cyberGlowCyanMat.emissiveIntensity = 2.0;
      this.showNotification('Кибер-овердрайв отключён');
      this.emitHud();
      return;
    }
    if (this.cyberEnergy < 20) {
      this.showNotification('Недостаточно кибер-энергии (нужно 20%)');
      return;
    }
    this.cyberOverdriveActive = true;
    this.cyberTransformBannerTimer = 2.8;
    this.mats.cyberGlowCyanMat.emissiveIntensity = 4.0;
    this.audio.playUiConfirm();
    this.showNotification('Кибер-трансформация: ОВЕРДРАЙВ АКТИВЕН!');
    this.emitHud();
  }

  public buyProperty(propId: string): boolean {
    const p = this.properties.find((x) => x.id === propId);
    if (!p || p.owned || this.money < p.price) return false;
    this.money -= p.price;
    p.owned = true;
    this.audio.playUiConfirm();
    this.showNotification(`Недвижимость приобретена: ${p.name}`);
    this.emitHud();
    return true;
  }

  public teleportToProperty(propId: string) {
    const p = this.properties.find((x) => x.id === propId && x.owned);
    if (!p) return;
    if (this.currentVehicle) this.exitVehicle();
    this.px = p.x + 22;
    this.pz = p.z + 22;
    this.py = 0.16;
    this.wantedStars = 0;
    this.health = this.maxHealth;
    this.showNotification(`Вы дома (${p.name}). Розыск снят, здоровье восстановлено.`);
    this.emitHud();
  }

  public buyOrSpawnVehicle(catalogId: string): boolean {
    const item = this.vehicleCatalog.find((v) => v.id === catalogId);
    if (!item) return false;
    if (!item.owned) {
      if (this.money < item.price) return false;
      this.money -= item.price;
      item.owned = true;
      this.audio.playUiConfirm();
      this.showNotification(`Куплен транспорт: ${item.name}`);
    }
    // Spawn near player
    if (this.currentVehicle) this.exitVehicle();
    const spawnDist = item.kind === 'jet' || item.kind === 'helicopter' ? 12 : 6.5;
    const sx = this.px + Math.sin(this.pYaw + Math.PI / 2) * spawnDist;
    const sz = this.pz + Math.cos(this.pYaw + Math.PI / 2) * spawnDist;
    const veh = buildVehicle(`owned_${item.id}_${Date.now()}`, item.kind, item.name, item.color, this.mats, {
      maxSpeedKmh: item.topSpeedKmh,
    });
    veh.x = sx;
    veh.z = sz;
    veh.y = 0.1;
    veh.yaw = this.pYaw;
    veh.root.position.set(veh.x, veh.y, veh.z);
    veh.root.rotation.y = veh.yaw;
    this.scene.add(veh.root);
    this.vehicles.push(veh);
    this.showNotification(`${item.name} доставлен рядом с вами!`);
    this.emitHud();
    return true;
  }

  public buyShopItem(kind: 'ammo' | 'armor' | 'medkit' | 'grenade') {
    const prices = { ammo: 400, armor: 800, medkit: 350, grenade: 450 };
    const cost = prices[kind];
    if (this.money < cost) {
      this.showNotification('Недостаточно средств!');
      return;
    }
    this.money -= cost;
    if (kind === 'ammo') {
      this.weapons[0].ammo = this.weapons[0].maxAmmo;
      this.weapons[1].ammo = this.weapons[1].maxAmmo;
    } else if (kind === 'armor') {
      this.armor = this.maxArmor;
    } else if (kind === 'medkit') {
      this.weapons[4].ammo = Math.min(this.weapons[4].maxAmmo, this.weapons[4].ammo + 1);
    } else if (kind === 'grenade') {
      this.weapons[2].ammo = Math.min(this.weapons[2].maxAmmo, this.weapons[2].ammo + 2);
    }
    this.audio.playUiConfirm();
    this.showNotification('Покупка успешно оформлена');
    this.emitHud();
  }

  public startQuickJob(kind: 'courier' | 'taxi' | 'bounty') {
    const dests = [
      { x: 150, z: -150, title: 'Доставка экспресс-груза' },
      { x: -150, z: 90, title: 'VIP-такси по городу' },
      { x: 90, z: 150, title: 'Охранный контракт NEXORUM' },
    ];
    const d = dests[kind === 'courier' ? 0 : kind === 'taxi' ? 1 : 2];
    this.activeJob = {
      title: d.title,
      targetX: d.x,
      targetZ: d.z,
      reward: kind === 'bounty' ? 3500 : 2200,
      timeLeft: 75,
    };
    this.audio.playUiConfirm();
    this.showNotification(`Контракт принят: ${d.title} (+$${this.activeJob.reward})`);
    this.emitHud();
  }

  public setWaypointTo(x: number, z: number) {
    if (this.currentVehicle) this.exitVehicle();
    this.px = x;
    this.pz = z + 14;
    this.py = 0.16;
    this.showNotification('Быстрое перемещение выполнено');
    this.emitHud();
  }

  public getStateLists() {
    return {
      upgrades: this.upgrades,
      properties: this.properties,
      vehicleCatalog: this.vehicleCatalog,
      missions: this.missions,
      pois: CITY_POIS,
    };
  }

  private showNotification(msg: string) {
    this.notification = msg;
    this.notificationTimer = 4.0;
  }

  private addXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.round(this.xpNext * 1.28);
      this.showNotification(`Уровень повышен: ${this.level}!`);
    }
  }

  // Event Binding
  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    this.keys.add(code);

    if (code === 'Escape') {
      this.onMenuShortcut('settings');
      return;
    }
    if (code === 'Tab') {
      e.preventDefault();
      this.onMenuShortcut('inventory');
      return;
    }

    const menuMap: Record<string, string> = {
      KeyM: 'map',
      KeyI: 'inventory',
      KeyJ: 'missions',
      KeyK: 'skills',
      KeyB: 'shop',
      KeyH: 'home',
      KeyT: 'vehicles',
    };
    if (menuMap[code]) {
      this.onMenuShortcut(menuMap[code]);
      return;
    }

    if (this.paused) return;

    if (code === 'Digit1') this.selectWeaponSlot(1);
    else if (code === 'Digit2') this.selectWeaponSlot(2);
    else if (code === 'Digit3') this.selectWeaponSlot(3);
    else if (code === 'Digit4') this.selectWeaponSlot(4);
    else if (code === 'Digit5') {
      this.selectWeaponSlot(5);
      this.useMedkit();
    } else if (code === 'KeyF') {
      this.toggleVehicle();
    } else if (code === 'KeyE') {
      this.interactNearby();
    } else if (code === 'KeyV') {
      this.cycleCameraMode();
    } else if (code === 'KeyR') {
      this.startReload();
    } else if (code === 'KeyQ') {
      this.triggerWeapon();
    } else if (code === 'KeyX') {
      this.toggleCyberOverdrive();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.paused) return;
    if (e.target !== this.renderer.domElement) return;
    if (e.button === 0) {
      this.mouseDownLeft = true;
      this.isDraggingLook = true;
      this.triggerWeapon();
      if (!this.pointerLocked && document.pointerLockElement !== this.renderer.domElement) {
        try {
          this.renderer.domElement.requestPointerLock?.();
        } catch {
          // fallback to drag look
        }
      }
    } else if (e.button === 2) {
      this.aiming = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      this.isDraggingLook = false;
    } else if (e.button === 2) {
      this.aiming = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.paused) return;
    if (this.pointerLocked || this.isDraggingLook) {
      this.camYaw -= e.movementX * 0.0028;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0024, -0.15, 1.05);
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.paused) return;
    this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.004, 3.2, 16);
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  private useMedkit() {
    const kit = this.weapons[4];
    if (kit.ammo <= 0 || this.health >= this.maxHealth) return;
    kit.ammo -= 1;
    this.health = Math.min(this.maxHealth, this.health + 55);
    this.audio.playUiConfirm();
    this.showNotification('Аптечка использована (+55 HP)');
    this.emitHud();
  }

  private toggleVehicle() {
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }
    let best: VehicleInstance | null = null;
    let bestD = 5.6;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.px, v.z - this.pz);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best) {
      this.currentVehicle = best;
      best.driverOccupied = true;
      if (best.isPolice) {
        this.addWanted(2, true);
      } else if (best.isTraffic) {
        this.addWanted(1);
      }
      best.isTraffic = false;
      best.doorOpenProgress = 1.0;
      this.gordRig.root.visible = best.kind === 'motorcycle';
      this.audio.playUiConfirm();
      this.showNotification(`Вы сели в ${best.name}`);
      this.emitHud();
    }
  }

  private exitVehicle() {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    v.driverOccupied = false;
    v.doorOpenProgress = 1.0;
    this.px = v.x - Math.cos(v.yaw) * 2.4;
    this.pz = v.z + Math.sin(v.yaw) * 2.4;
    this.py = Math.max(0.16, v.y);
    this.pvy = 0;
    this.currentVehicle = null;
    this.gordRig.root.visible = true;
    this.audio.updateEngine(false, 0, false);
    this.emitHud();
  }

  private interactNearby() {
    // 1. Check nearby POIs
    for (const poi of CITY_POIS) {
      if (Math.hypot(poi.x - this.px, poi.z - this.pz) < 6.5) {
        if (poi.kind === 'hospital') {
          this.health = this.maxHealth;
          this.wantedStars = 0;
          this.showNotification('Лечение в больнице завершено. Здоровье 100%.');
        } else if (poi.kind === 'clinic') {
          this.onMenuShortcut('skills');
        } else if (poi.kind === 'shop') {
          this.onMenuShortcut('shop');
        } else if (poi.kind === 'dealership') {
          this.onMenuShortcut('vehicles');
        } else if (poi.kind === 'job') {
          this.startQuickJob('taxi');
        } else if (poi.kind === 'police') {
          if (this.wantedStars > 0 && this.money >= 1500) {
            this.money -= 1500;
            this.wantedStars = 0;
            this.showNotification('Штраф оплачен ($1 500). Розыск снят.');
          } else {
            this.startQuickJob('bounty');
          }
        }
        return;
      }
    }

    // 2. Talk to nearest civilian NPC
    for (const npc of this.npcs) {
      if (!npc.alive || npc.role !== 'civilian') continue;
      if (Math.hypot(npc.x - this.px, npc.z - this.pz) < 4.2) {
        const line = NPC_DIALOGUES[Math.floor(Math.random() * NPC_DIALOGUES.length)];
        this.activeDialogue = line;
        this.dialogueTimer = 6.0;
        npc.talkingTimer = 6.0;
        npc.yaw = Math.atan2(this.px - npc.x, this.pz - npc.z);
        this.audio.playUiConfirm();
        this.emitHud();
        return;
      }
    }
  }

  private addWanted(stars: number, escalate = false) {
    const prev = this.wantedStars;
    let next = Math.max(this.wantedStars, stars);
    if (escalate && this.wantedStars > 0 && stars >= this.wantedStars && this.wantedCooldown < 19.5) {
      next = Math.min(5, this.wantedStars + 1);
    }
    this.wantedStars = Math.min(5, next);
    this.wantedCooldown = 22;
    if (this.wantedStars > prev) {
      const tierMsg =
        this.wantedStars >= 4
          ? `Розыск ${this.wantedStars} зв.: Перехватчики и блокады!`
          : this.wantedStars === 3
          ? `Розыск 3 зв.: Полиция ставит заграждения!`
          : `Розыск полиции: ${this.wantedStars} зв.`;
      this.showNotification(tierMsg);
      // Spawn pursuing police officer near action on 2+ stars
      const angle = Math.random() * Math.PI * 2;
      const sx = THREE.MathUtils.clamp(this.px + Math.cos(angle) * 44, -210, 210);
      const sz = THREE.MathUtils.clamp(this.pz + Math.sin(angle) * 44, -210, 210);
      if (!this.collidersWithCheck(sx, sz, 1.0, 0.5)) {
        this.spawnEnemy('police', sx, sz);
      }
      this.dispatchPoliceVehiclesNow();
    }
  }

  private findRoadSpawnNear(targetX: number, targetZ: number, minDist = 48, maxDist = 88): { x: number; z: number; yaw: number } {
    for (let attempt = 0; attempt < 18; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = minDist + Math.random() * (maxDist - minDist);
      let sx = THREE.MathUtils.clamp(targetX + Math.cos(angle) * r, -205, 205);
      let sz = THREE.MathUtils.clamp(targetZ + Math.sin(angle) * r, -205, 195);
      // Snap one axis to nearest city road center
      let bestRoad = ROAD_CENTERS[0];
      let bestD = Infinity;
      for (const rc of ROAD_CENTERS) {
        const d = attempt % 2 === 0 ? Math.abs(sz - rc) : Math.abs(sx - rc);
        if (d < bestD) {
          bestD = d;
          bestRoad = rc;
        }
      }
      let yaw = 0;
      if (attempt % 2 === 0) {
        sz = bestRoad + (Math.random() < 0.5 ? 3.8 : -3.8);
        yaw = sx < targetX ? Math.PI / 2 : -Math.PI / 2;
      } else {
        sx = bestRoad + (Math.random() < 0.5 ? 3.8 : -3.8);
        yaw = sz < targetZ ? 0 : Math.PI;
      }
      if (!this.collidersWithCheck(sx, sz, 2.2, 0.5)) {
        return { x: sx, z: sz, yaw };
      }
    }
    return { x: ROAD_CENTERS[2], z: ROAD_CENTERS[1], yaw: 0 };
  }

  private spawnPoliceCruiser(role: 'pursuit' | 'interceptor' | 'roadblock', offsetSide = 0) {
    const gvx = this.currentVehicle ? this.currentVehicle.vx : this.pvx;
    const gvz = this.currentVehicle ? this.currentVehicle.vz : this.pvz;
    const gSpeed = Math.hypot(gvx, gvz);

    let spawnX = 0;
    let spawnZ = 0;
    let spawnYaw = 0;

    if (role === 'roadblock' && gSpeed > 4.5) {
      const fwdX = gvx / gSpeed;
      const fwdZ = gvz / gSpeed;
      const rightX = -fwdZ;
      const rightZ = fwdX;
      const aheadX = THREE.MathUtils.clamp(this.px + fwdX * 72 + rightX * offsetSide, -200, 200);
      const aheadZ = THREE.MathUtils.clamp(this.pz + fwdZ * 72 + rightZ * offsetSide, -200, 165);
      const spot = this.findRoadSpawnNear(aheadX, aheadZ, 3, 20);
      spawnX = spot.x;
      spawnZ = spot.z;
      // Orient perpendicular across player's approach vector to physically block the road
      const approachYaw = Math.atan2(fwdX, fwdZ);
      spawnYaw = approachYaw + (offsetSide >= 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      const spot = this.findRoadSpawnNear(this.px, this.pz, 50, 86);
      spawnX = spot.x;
      spawnZ = spot.z;
      spawnYaw = Math.atan2(this.px - spawnX, this.pz - spawnZ);
    }

    const isFast = this.wantedStars >= 4 || role === 'interceptor';
    const cruiser = buildVehicle(
      `police_chase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      'police',
      isFast ? 'NCPD Interceptor Turbo' : role === 'roadblock' ? 'NCPD Heavy Barricade' : 'NCPD Interceptor',
      '#0f172a',
      this.mats,
      { isTraffic: true, isPolice: true, maxSpeedKmh: isFast ? 260 : 230 }
    );
    cruiser.x = spawnX;
    cruiser.z = spawnZ;
    cruiser.yaw = spawnYaw;
    cruiser.policeRole = role;
    cruiser.aiBlockAngle = spawnYaw;
    cruiser.aiSpawnedForChase = true;
    cruiser.root.position.set(spawnX, 0, spawnZ);
    cruiser.root.rotation.y = spawnYaw;
    this.scene.add(cruiser.root);
    this.vehicles.push(cruiser);
  }

  private dispatchPoliceVehiclesNow() {
    if (this.wantedStars <= 0) return;
    const desiredTotal = [0, 2, 4, 5, 7, 9][this.wantedStars] ?? 5;
    const activePolice = this.vehicles.filter(
      (v) => v.isPolice && !v.driverOccupied && v.health > 0 && Math.hypot(v.x - this.px, v.z - this.pz) < 165
    );
    let needed = Math.min(desiredTotal - activePolice.length, 3);
    while (needed > 0) {
      const role: 'pursuit' | 'interceptor' | 'roadblock' =
        this.wantedStars >= 3 && needed === 1
          ? 'roadblock'
          : this.wantedStars >= 2 && needed % 2 === 0
          ? 'interceptor'
          : 'pursuit';
      if (role === 'roadblock' && this.wantedStars >= 4) {
        // Double-cruiser wide street blockade at 4-5 stars
        this.spawnPoliceCruiser('roadblock', -3.6);
        this.spawnPoliceCruiser('roadblock', 3.6);
        needed = Math.max(0, needed - 2);
      } else {
        this.spawnPoliceCruiser(role, 0);
        needed--;
      }
    }
  }

  private managePoliceResponse(dt: number) {
    // Cleanup excess chase-spawned cars & snap roaming patrols back to city road grid
    if (this.wantedStars === 0) {
      for (let i = this.vehicles.length - 1; i >= 0; i--) {
        const v = this.vehicles[i];
        if (v.isPolice && !v.driverOccupied) {
          if (v.policeRole !== 'patrol') {
            v.policeRole = 'patrol';
            // Align to nearest cardinal road direction to resume seamless patrol
            const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
            let bestYaw = 0;
            let bestDiff = Infinity;
            for (const c of cardinals) {
              let d = Math.abs(v.yaw - c);
              while (d > Math.PI) d = Math.abs(d - Math.PI * 2);
              if (d < bestDiff) {
                bestDiff = d;
                bestYaw = c;
              }
            }
            v.patrolTargetYaw = bestYaw;
            v.patrolTurnCooldown = 1.5;
          }
          if (v.aiSpawnedForChase && Math.hypot(v.x - this.px, v.z - this.pz) > 135) {
            this.scene.remove(v.root);
            this.vehicles.splice(i, 1);
          }
        }
      }
      return;
    }

    // Check closest police unit distance for realistic GTA evasion cooldown
    let minPoliceDist = Infinity;
    const nearbyPolice: VehicleInstance[] = [];
    for (const v of this.vehicles) {
      if (!v.isPolice || v.driverOccupied || v.health <= 0) continue;
      v.isTraffic = true;
      const d = Math.hypot(v.x - this.px, v.z - this.pz);
      if (d < minPoliceDist) minPoliceDist = d;
      if (d < 185) nearbyPolice.push(v);
    }
    for (const npc of this.npcs) {
      if (!npc.alive || npc.role !== 'police') continue;
      const d = Math.hypot(npc.x - this.px, npc.z - this.pz);
      if (d < minPoliceDist) minPoliceDist = d;
    }

    // Spawn backup cruisers up to star-level quota
    const desiredTotal = [0, 2, 4, 5, 7, 9][this.wantedStars] ?? 5;
    if (nearbyPolice.length < desiredTotal) {
      const spawnProb = dt * (0.5 + this.wantedStars * 0.28);
      if (Math.random() < spawnProb) {
        const gSpeed = this.currentVehicle ? Math.abs(this.currentVehicle.speed) : Math.hypot(this.pvx, this.pvz);
        const roadblocksCount = nearbyPolice.filter((v) => v.policeRole === 'roadblock').length;
        const maxRoadblocks = this.wantedStars >= 4 ? 3 : this.wantedStars >= 3 ? 1 : 0;
        const wantRoadblock = this.wantedStars >= 3 && gSpeed > 6.5 && roadblocksCount < maxRoadblocks;
        if (wantRoadblock && this.wantedStars >= 4 && roadblocksCount === 0) {
          this.spawnPoliceCruiser('roadblock', -3.5);
          this.spawnPoliceCruiser('roadblock', 3.5);
        } else {
          const role: 'pursuit' | 'interceptor' | 'roadblock' = wantRoadblock
            ? 'roadblock'
            : this.wantedStars >= 2 && nearbyPolice.length % 2 === 1
            ? 'interceptor'
            : 'pursuit';
          this.spawnPoliceCruiser(role, 0);
        }
      }
    }

    // Assign dynamic roles sorted by distance to player
    nearbyPolice.sort((a, b) => Math.hypot(a.x - this.px, a.z - this.pz) - Math.hypot(b.x - this.px, b.z - this.pz));
    const gvx = this.currentVehicle ? this.currentVehicle.vx : this.pvx;
    const gvz = this.currentVehicle ? this.currentVehicle.vz : this.pvz;
    const gSpd = Math.hypot(gvx, gvz);

    for (let i = 0; i < nearbyPolice.length; i++) {
      const cop = nearbyPolice[i];
      if (cop.policeRole === 'roadblock') {
        const dx = cop.x - this.px;
        const dz = cop.z - this.pz;
        const dist = Math.hypot(dx, dz);
        const dotAhead = gSpd > 3 ? (dx * gvx + dz * gvz) / gSpd : 0;
        // If player bypassed the roadblock, convert roadblock cruiser into active pursuit!
        if (dist > 32 && dotAhead < -14) {
          cop.policeRole = 'pursuit';
        }
        continue;
      }

      if (this.wantedStars >= 2 && i % 2 === 1) {
        cop.policeRole = 'interceptor';
      } else {
        cop.policeRole = 'pursuit';
      }
    }

    // Cooldown slows heavily while actively spotted (< 44m), ticks down normally when evading
    const decayRate = minPoliceDist < 44 ? 0.12 : minPoliceDist < 75 ? 0.65 : 1.15;
    this.wantedCooldown -= dt * decayRate;
    this.audio.updatePoliceSiren(this.wantedStars, dt);
    if (this.wantedCooldown <= 0) {
      this.wantedStars = Math.max(0, this.wantedStars - 1);
      this.wantedCooldown = 18;
      if (this.wantedStars === 0) {
        this.showNotification('Вы скрылись от полиции. Розыск снят.');
      }
    }
  }

  public cycleCameraMode() {
    const order: CameraMode[] = ['third_close', 'third_far', 'first_person'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    const labels: Record<CameraMode, string> = {
      third_close: 'Камера: От 3-го лица (Близкая)',
      third_far: 'Камера: От 3-го лица (Дальняя)',
      first_person: 'Камера: От 1-го лица',
    };
    this.showNotification(labels[this.cameraMode]);
    this.emitHud();
  }

  private startReload() {
    if (this.reloadTimer > 0) return;
    const w = this.weapons[this.activeSlot - 1];
    if (!w || (w.id !== 'rifle' && w.id !== 'pistol')) return;
    if (w.clip >= w.clipSize || w.ammo <= w.clip) return;
    this.reloadTimer = 1.05;
    this.audio.playReload();
    this.emitHud();
  }

  private spawnBloodBurst(x: number, y: number, z: number, dirX = 0, dirZ = 0, count = 8, createPool = false) {
    for (let i = 0; i < count; i++) {
      if (this.fxParticles.length > 160) break;
      const m = new THREE.Mesh(this.bloodDropGeo, this.mats.bloodDropMat);
      m.position.set(x, y, z);
      const s = 0.6 + Math.random() * 0.9;
      m.scale.setScalar(s);
      this.scene.add(m);
      this.fxParticles.push({
        mesh: m,
        vx: dirX * (2.5 + Math.random() * 4) + (Math.random() - 0.5) * 4.2,
        vy: 1.4 + Math.random() * 3.8,
        vz: dirZ * (2.5 + Math.random() * 4) + (Math.random() - 0.5) * 4.2,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity: 16,
        kind: 'blood',
      });
    }
    if (createPool) {
      if (this.bloodPools.length >= 35) {
        const old = this.bloodPools.shift();
        if (old) this.scene.remove(old.mesh);
      }
      const pool = new THREE.Mesh(this.bloodPoolGeo, this.mats.bloodPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x + (Math.random() - 0.5) * 0.4, 0.175, z + (Math.random() - 0.5) * 0.4);
      pool.scale.setScalar(0.25);
      this.scene.add(pool);
      this.bloodPools.push({
        mesh: pool,
        targetScale: 0.9 + Math.random() * 0.65,
        currentScale: 0.25,
      });
    }
  }

  private spawnSparks(x: number, y: number, z: number, count = 8, spread = 8) {
    for (let i = 0; i < count; i++) {
      if (this.fxParticles.length > 160) break;
      const m = new THREE.Mesh(this.sparkGeo, this.mats.sparkMat);
      m.position.set(x, y, z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      this.fxParticles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * spread,
        vy: 2 + Math.random() * (spread * 0.7),
        vz: (Math.random() - 0.5) * spread,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        gravity: 20,
        kind: 'spark',
      });
    }
  }

  private spawnShellCasing(x: number, y: number, z: number, yaw: number) {
    if (this.fxParticles.length > 160) return;
    const m = new THREE.Mesh(this.shellGeo, this.mats.shellMat);
    m.position.set(x, y, z);
    this.scene.add(m);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    this.fxParticles.push({
      mesh: m,
      vx: -rightX * (2.2 + Math.random() * 1.4),
      vy: 2.8 + Math.random() * 1.2,
      vz: -rightZ * (2.2 + Math.random() * 1.4),
      life: 0.7,
      maxLife: 0.7,
      gravity: 18,
      kind: 'shell',
    });
  }

  private spawnEngineSmoke(x: number, y: number, z: number) {
    if (this.fxParticles.length > 160) return;
    const m = new THREE.Mesh(this.smokeGeo, this.mats.smokeMat);
    m.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
    m.scale.setScalar(0.55);
    this.scene.add(m);
    this.fxParticles.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 1.1,
      vy: 2.4 + Math.random() * 1.6,
      vz: (Math.random() - 0.5) * 1.1,
      life: 1.1,
      maxLife: 1.1,
      gravity: -0.6,
      kind: 'smoke',
    });
  }

  private triggerCrowdPanic(x: number, z: number, radius = 38) {
    for (const npc of this.npcs) {
      if (!npc.alive || npc.role !== 'civilian') continue;
      const d = Math.hypot(npc.x - x, npc.z - z);
      if (d < radius) {
        npc.panicTimer = 6.5 + Math.random() * 3.5;
        npc.yaw = Math.atan2(npc.x - x, npc.z - z) + (Math.random() - 0.5) * 0.6;
      }
    }
    for (const veh of this.vehicles) {
      if (veh.isTraffic && !veh.isPolice && !veh.driverOccupied) {
        if (Math.hypot(veh.x - x, veh.z - z) < radius) {
          veh.aiPanicTimer = 5.5;
        }
      }
    }
  }

  private triggerWeapon() {
    if (this.currentVehicle || this.fireCooldown > 0 || this.reloadTimer > 0) return;
    const w = this.weapons[this.activeSlot - 1];
    if (!w) return;

    if (w.id === 'medkit') {
      this.useMedkit();
      return;
    }

    if (w.id === 'blade') {
      this.fireCooldown = w.fireRate * (this.cyberOverdriveActive ? 0.72 : 1.0);
      this.meleeSwingTimer = 0.34;
      this.weaponRecoil = 0.6;
      this.audio.playImpact(0.65);
      const dmg = w.damage * (this.cyberStage >= 1 ? 1.45 : 1.0) * (this.cyberOverdriveActive ? 1.4 : 1.0);
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        const dx = npc.x - this.px;
        const dz = npc.z - this.pz;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.8) {
          this.damageNpc(npc, dmg, dx / Math.max(0.1, dist), dz / Math.max(0.1, dist));
        }
      }
      return;
    }

    if (w.id === 'grenade') {
      if (w.ammo <= 0) return;
      w.ammo -= 1;
      this.fireCooldown = w.fireRate;
      const gMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x3f6212, metalness: 0.6, roughness: 0.4 })
      );
      const dirX = Math.sin(this.camYaw);
      const dirZ = Math.cos(this.camYaw);
      gMesh.position.set(this.px + dirX * 0.8, this.py + 1.4, this.pz + dirZ * 0.8);
      this.scene.add(gMesh);
      this.grenades.push({
        mesh: gMesh,
        vx: dirX * 18,
        vy: 6.5,
        vz: dirZ * 18,
        fuse: 1.6,
      });
      this.emitHud();
      return;
    }

    // Firearm (Rifle / Pistol) with real clip + reload + shell casings + muzzle light
    if (w.ammo <= 0) {
      this.showNotification('Закончились патроны! Купите боеприпасы в Магазине (B).');
      return;
    }
    if (w.clip <= 0) {
      this.startReload();
      return;
    }
    w.clip -= 1;
    w.ammo -= 1;
    if (w.clip === 0 && w.ammo > 0) {
      this.startReload();
    }
    this.fireCooldown = w.fireRate * (this.cyberOverdriveActive ? 0.72 : 1.0);
    this.muzzleTimer = 0.065;
    this.weaponRecoil = w.id === 'rifle' ? 0.85 : 0.65;
    this.cameraShake = Math.max(this.cameraShake, 0.06);
    this.gordRig.muzzleFlash.visible = true;
    this.audio.playGunshot(w.id === 'rifle');

    // Align Gord toward camera aim direction
    this.pYaw = this.camYaw;
    const dirX = Math.sin(this.camYaw) * Math.cos(this.camPitch * 0.4);
    const dirY = -Math.sin(this.camPitch * 0.55) + 0.02;
    const dirZ = Math.cos(this.camYaw) * Math.cos(this.camPitch * 0.4);

    this.muzzleLight.position.set(this.px + dirX * 1.1, this.py + 1.45, this.pz + dirZ * 1.1);
    this.muzzleLight.color.setHex(0xffae42);
    this.muzzleLight.intensity = 6.5;

    this.spawnShellCasing(this.px + dirX * 0.45, this.py + 1.38, this.pz + dirZ * 0.45, this.pYaw);
    this.triggerCrowdPanic(this.px, this.pz, 34);

    // Patrolling police cruisers witness nearby gunfire immediately
    if (this.wantedStars === 0) {
      for (const cop of this.vehicles) {
        if (cop.isPolice && !cop.driverOccupied && cop.health > 0 && Math.hypot(cop.x - this.px, cop.z - this.pz) < 46) {
          this.addWanted(1, false);
          this.showNotification('Патруль заметил стрельбу!');
          break;
        }
      }
    }

    const tracer = new THREE.Mesh(this.bulletGeo, this.bulletMatPlayer);
    tracer.position.set(this.px + dirX * 0.9, this.py + 1.38, this.pz + dirZ * 0.9);
    this.scene.add(tracer);

    const dmgBonus = (this.cyberStage >= 2 ? 1.25 : 1.0) * (this.cyberOverdriveActive ? 1.35 : 1.0);
    this.bullets.push({
      mesh: tracer,
      vx: dirX * 95,
      vy: dirY * 95,
      vz: dirZ * 95,
      life: 1.1,
      fromPlayer: true,
      damage: w.damage * dmgBonus,
    });
  }

  private damageNpc(npc: NpcActor, dmg: number, hitDirX = 0, hitDirZ = 0) {
    npc.health -= dmg;
    npc.hitFlinchTimer = 0.28;
    const nLen = Math.hypot(hitDirX, hitDirZ);
    const kx = nLen > 0.01 ? hitDirX / nLen : Math.sin(this.pYaw);
    const kz = nLen > 0.01 ? hitDirZ / nLen : Math.cos(this.pYaw);
    npc.knockVx = kx * Math.min(8, 2.5 + dmg * 0.08);
    npc.knockVz = kz * Math.min(8, 2.5 + dmg * 0.08);

    this.audio.playImpact(0.45);
    this.spawnBloodBurst(npc.x, npc.y + 1.18, npc.z, kx, kz, dmg > 45 ? 12 : 7, npc.health <= 0);

    if (npc.role === 'civilian' || npc.role === 'police') {
      this.addWanted(npc.role === 'police' ? 2 : 1, npc.role === 'police');
    }
    if (npc.health <= 0 && npc.alive) {
      npc.alive = false;
      npc.rig.root.rotation.x = Math.PI / 2;
      npc.rig.root.position.y = 0.22;
      this.money += npc.role === 'boss' ? 4000 : npc.role === 'gangster' ? 650 : 120;
      this.addXp(npc.role === 'boss' ? 900 : 180);
    }
  }

  private spawnExplosion(x: number, y: number, z: number, radius = 9) {
    this.audio.playExplosion();
    this.cameraShake = Math.max(this.cameraShake, 0.42);
    this.muzzleLight.position.set(x, y + 1.2, z);
    this.muzzleLight.color.setHex(0xff6b2b);
    this.muzzleLight.intensity = 16;
    this.muzzleTimer = 0.18;

    this.spawnSparks(x, y + 0.5, z, 18, 16);
    this.triggerCrowdPanic(x, z, 46);

    const exp = new THREE.Mesh(
      this.explosionGeo,
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
    );
    exp.position.set(x, y, z);
    this.scene.add(exp);
    this.explosions.push({ mesh: exp, life: 0, maxLife: 0.55 });

    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dx = npc.x - x;
      const dz = npc.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        this.damageNpc(npc, 150 * (1 - dist / radius), dx, dz);
      }
    }
    for (const veh of this.vehicles) {
      const dx = veh.x - x;
      const dz = veh.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05 && dist < radius * 1.45) {
        const blastFactor = 1 - dist / (radius * 1.45);
        deformVehicleBody(veh, dx / dist, dz / dist, 14 + blastFactor * 16, x, z);
        veh.health = Math.max(8, veh.health - blastFactor * 55);
      }
    }
    this.addWanted(2, true);
  }

  private collidesWithBuildings(x: number, z: number, radius: number, y = 0): boolean {
    for (const b of this.colliders) {
      if (y > b.maxY) continue;
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
        return true;
      }
    }
    return false;
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (!this.paused) {
      this.elapsed += dt;
      this.updateSimulation(dt);
    }

    // Update animated water shader uniform
    if (this.mats.waterMat.userData?.uTime) {
      this.mats.waterMat.userData.uTime.value = this.elapsed;
    }

    this.renderScene();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private renderScene() {
    if (this.composer && this.bloomEnabled && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateTrafficSignals() {
    for (let waveIdx = 0; waveIdx < this.trafficSignals.length; waveIdx++) {
      const sig = this.trafficSignals[waveIdx];
      const cycle = 18.0;
      const t = (this.elapsed + waveIdx * 9.0) % cycle;
      const nsState = t < 7.0 ? 'green' : t < 9.0 ? 'yellow' : 'red';
      const ewState = t < 9.0 ? 'red' : t < 16.0 ? 'green' : 'yellow';

      sig.nsRed.color.setHex(nsState === 'red' ? 0xef4444 : 0x3b0b0b);
      sig.nsYellow.color.setHex(nsState === 'yellow' ? 0xfacc15 : 0x3b2f0b);
      sig.nsGreen.color.setHex(nsState === 'green' ? 0x22c55e : 0x0b3b1e);

      sig.ewRed.color.setHex(ewState === 'red' ? 0xef4444 : 0x3b0b0b);
      sig.ewYellow.color.setHex(ewState === 'yellow' ? 0xfacc15 : 0x3b2f0b);
      sig.ewGreen.color.setHex(ewState === 'green' ? 0x22c55e : 0x0b3b1e);
    }
  }

  private updateSimulation(dt: number) {
    this.skyMat.uniforms.uTime.value = this.elapsed;
    this.updateTrafficSignals();
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.meleeSwingTimer > 0) this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
    if (this.weaponRecoil > 0) this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 6);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.gordRig.muzzleFlash.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.activeDialogue = null;
    }
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.notification = null;
    }

    // Passive property income every 15s
    this.incomeTimer += dt;
    if (this.incomeTimer >= 15) {
      this.incomeTimer = 0;
      const totalInc = this.properties.reduce((acc, p) => (p.owned ? acc + Math.round(p.incomePerMin / 4) : acc), 0);
      if (totalInc > 0) {
        this.money += totalInc;
      }
    }

    if (this.cyberTransformBannerTimer > 0) {
      this.cyberTransformBannerTimer = Math.max(0, this.cyberTransformBannerTimer - dt);
    }

    // Cyber-Overdrive energy management & passive reactor regeneration
    if (this.cyberOverdriveActive) {
      this.cyberEnergy = Math.max(0, this.cyberEnergy - dt * 13.5);
      this.mats.cyberGlowCyanMat.emissiveIntensity = 3.6 + Math.sin(this.elapsed * 12) * 0.9;
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + dt * 4.0);
      }
      if (this.cyberEnergy <= 0) {
        this.cyberOverdriveActive = false;
        this.mats.cyberGlowCyanMat.emissiveIntensity = 2.0;
        this.showNotification('Кибер-энергия исчерпана — овердрайв отключён');
      }
    } else {
      this.cyberEnergy = Math.min(
        this.maxCyberEnergy,
        this.cyberEnergy + dt * (this.cyberStage >= 4 ? 11.0 : 7.5)
      );
    }

    // Stage 4 Cyber Core Regeneration
    if (this.cyberStage >= 4 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + dt * 2.5);
    }

    // Continuous auto-fire for rifle
    if (this.mouseDownLeft && this.activeSlot === 1 && !this.currentVehicle) {
      this.triggerWeapon();
    }

    // 1. Update Gord or Driven Vehicle
    if (this.currentVehicle) {
      this.updateDrivenVehicle(this.currentVehicle, dt);
    } else {
      this.updatePlayerOnFoot(dt);
    }

    // Keep shadow frustum centered around player
    const anchorX = this.currentVehicle ? this.currentVehicle.x : this.px;
    const anchorZ = this.currentVehicle ? this.currentVehicle.z : this.pz;
    this.sunLight.position.set(anchorX + 55, 85, anchorZ - 95);
    this.sunLight.target.position.set(anchorX, 0, anchorZ);

    // 2. Update AI Traffic & Parked Vehicles
    this.updateVehicles(dt);

    // 3. Update NPCs (Civilians, Police, Gangsters, Boss)
    this.updateNpcs(dt);

    // 4. Update Bullets, Grenades & Explosions
    this.updateProjectiles(dt);

    // 5. Update Weather Particles around camera
    if (this.weatherPoints.visible) {
      const posAttr = this.weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += this.weatherVelY * dt;
        if (this.weather === 'snow') {
          arr[i] += Math.sin(this.elapsed + i) * dt * 1.4;
        }
        if (arr[i + 1] < 0) {
          arr[i] = anchorX + (Math.random() - 0.5) * 85;
          arr[i + 1] = 38 + Math.random() * 10;
          arr[i + 2] = anchorZ + (Math.random() - 0.5) * 85;
        }
      }
      posAttr.needsUpdate = true;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        const w = this.weapons[this.activeSlot - 1];
        if (w && (w.id === 'rifle' || w.id === 'pistol')) {
          w.clip = Math.min(w.clipSize, w.ammo);
        }
      }
    }

    // 6. Police response, star-level dispatch & wanted cooldown
    this.managePoliceResponse(dt);

    // 7. Chaos Physics Prop Simulation & Vehicle Collisions
    this.updateChaosPhysics(dt);

    // 8. Missions & Active Job Check
    this.updateMissionsAndJobs(dt);

    // 9. Smooth Third-Person / First-Person Camera
    this.updateCamera(dt);

    // 10. Emit React HUD Snapshot at ~15Hz
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateChaosPhysics(dt: number) {
    // Full Mass-Weighted Vehicle-to-Vehicle Crash, Roadblock Bracing & PIT Collision Physics
    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      if (a.y > 1.5) continue;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        if (b.y > 1.5) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 3.45) {
          const overlap = 3.45 - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const aIsPlayer = a === this.currentVehicle;
          const bIsPlayer = b === this.currentVehicle;

          // Braced police blockers/roadblocks anchor hard into the asphalt so player cannot push through easily
          const aBracedBlock =
            a.isPolice && !a.driverOccupied && (a.policeRole === 'roadblock' || (a.policeRole === 'interceptor' && Math.abs(a.speed) < 4.5));
          const bBracedBlock =
            b.isPolice && !b.driverOccupied && (b.policeRole === 'roadblock' || (b.policeRole === 'interceptor' && Math.abs(b.speed) < 4.5));

          const effMassA = (a.mass || 1600) * (aBracedBlock ? 2.15 : a.isPolice && !a.driverOccupied ? 1.25 : 1.0);
          const effMassB = (b.mass || 1600) * (bBracedBlock ? 2.15 : b.isPolice && !b.driverOccupied ? 1.25 : 1.0);
          const invMA = 1 / effMassA;
          const invMB = 1 / effMassB;
          const invSum = invMA + invMB;

          a.x -= nx * overlap * (invMA / invSum);
          a.z -= nz * overlap * (invMA / invSum);
          b.x += nx * overlap * (invMB / invSum);
          b.z += nz * overlap * (invMB / invSum);

          const avx = Math.sin(a.yaw) * a.speed;
          const avz = Math.cos(a.yaw) * a.speed;
          const bvx = Math.sin(b.yaw) * b.speed;
          const bvz = Math.cos(b.yaw) * b.speed;

          const relVx = bvx - avx;
          const relVz = bvz - avz;
          const closingVn = relVx * nx + relVz * nz; // negative when colliding toward each other
          const impactSpd = Math.max(-closingVn, Math.hypot(relVx, relVz) * 0.72);

          if (impactSpd > 3.5 || closingVn < -2.0) {
            // Rigid-body impulse transfer along contact normal (arrests Gord against roadblocks/interceptors!)
            const restitution = 0.26;
            const impulseMag = (-(1 + restitution) * Math.min(closingVn, -impactSpd * 0.65)) / invSum;
            const postAvx = avx - impulseMag * invMA * nx;
            const postAvz = avz - impulseMag * invMA * nz;
            const postBvx = bvx + impulseMag * invMB * nx;
            const postBvz = bvz + impulseMag * invMB * nz;

            const fwdAx = Math.sin(a.yaw);
            const fwdAz = Math.cos(a.yaw);
            const fwdBx = Math.sin(b.yaw);
            const fwdBz = Math.cos(b.yaw);

            a.speed = postAvx * fwdAx + postAvz * fwdAz;
            b.speed = postBvx * fwdBx + postBvz * fwdBz;

            // Lateral torque / PIT spin deflection based on cross-product with vehicle heading
            const latA = postAvx * fwdAz - postAvz * fwdAx;
            const latB = postBvx * fwdBz - postBvz * fwdBx;
            const aPitMult = b.isPolice && !b.driverOccupied && this.wantedStars >= 3 ? 1.55 : 1.0;
            const bPitMult = a.isPolice && !a.driverOccupied && this.wantedStars >= 3 ? 1.55 : 1.0;

            a.yaw -= THREE.MathUtils.clamp(latA * 0.022 * aPitMult, -0.32, 0.32);
            b.yaw -= THREE.MathUtils.clamp(latB * 0.022 * bPitMult, -0.32, 0.32);
          }

          if (impactSpd > 6.0) {
            const contactX = (a.x + b.x) * 0.5;
            const contactZ = (a.z + b.z) * 0.5;
            const nearPlayer = Math.hypot(a.x - this.px, a.z - this.pz) < 65;
            if (nearPlayer) {
              this.audio.playImpact(Math.min(1, impactSpd / 26));
              this.spawnSparks(contactX, 0.65, contactZ, Math.min(16, Math.floor(impactSpd * 0.55)), 12);
            }
            a.crashJolt = Math.min(0.24, impactSpd * 0.013);
            b.crashJolt = Math.min(0.24, impactSpd * 0.013);

            // Real-time directional chassis mesh deformation scaled by mass ratio & impact speed
            const aImpulseSpd = impactSpd * (invMA / invSum) * 1.9;
            const bImpulseSpd = impactSpd * (invMB / invSum) * 1.9;
            deformVehicleBody(a, -nx, -nz, aImpulseSpd, contactX, contactZ);
            deformVehicleBody(b, nx, nz, bImpulseSpd, contactX, contactZ);

            const crashDmg = Math.min(38, impactSpd * 0.8);
            a.health = Math.max(8, a.health - crashDmg * (invMA / invSum) * 1.6);
            b.health = Math.max(8, b.health - crashDmg * (invMB / invSum) * 1.6);

            if (aIsPlayer || bIsPlayer) {
              const other = aIsPlayer ? b : a;
              const pv = aIsPlayer ? a : b;
              this.cameraShake = Math.max(this.cameraShake, Math.min(0.5, impactSpd * 0.017));
              if (impactSpd > 13) {
                this.damageFlash = Math.max(this.damageFlash, 0.45);
                this.triggerCrowdPanic(pv.x, pv.z, 34);
              }
              if (other.isPolice && impactSpd > 6.5) {
                this.addWanted(2, impactSpd > 15);
              } else if (other.isTraffic && impactSpd > 12) {
                // Witness check: nearby patrol sees hit-and-run
                let witnessed = false;
                for (const cop of this.vehicles) {
                  if (cop.isPolice && !cop.driverOccupied && Math.hypot(cop.x - pv.x, cop.z - pv.z) < 42) {
                    witnessed = true;
                    break;
                  }
                }
                this.addWanted(witnessed ? 2 : 1, witnessed);
              }
            }
          }
        }
      }
    }

    // Hitting NPCs with player's vehicle
    if (this.currentVehicle && this.currentVehicle.y < 1.5) {
      const pv = this.currentVehicle;
      const vehSpd = Math.abs(pv.speed);
      if (vehSpd > 5.0) {
        for (const npc of this.npcs) {
          if (!npc.alive) continue;
          const dx = npc.x - pv.x;
          const dz = npc.z - pv.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2.25) {
            const nx = dist > 0.01 ? dx / dist : 1;
            const nz = dist > 0.01 ? dz / dist : 0;
            npc.x += nx * 1.9;
            npc.z += nz * 1.9;
            this.damageNpc(npc, vehSpd * 3.8, nx, nz);
            this.cameraShake = Math.max(this.cameraShake, 0.1);
          }
        }
      }
    } else if (!this.currentVehicle && this.wantedStars > 0) {
      // Pursuing police cars physically blocking / bumping Gord on foot
      for (const cop of this.vehicles) {
        if (!cop.isPolice || cop.driverOccupied || cop.y > 1.5) continue;
        const dx = this.px - cop.x;
        const dz = this.pz - cop.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 2.3) {
          const nx = dx / dist;
          const nz = dz / dist;
          const push = 2.3 - dist;
          this.px += nx * push;
          this.pz += nz * push;
          if (Math.abs(cop.speed) > 6) {
            this.audio.playImpact(0.5);
            this.spawnBloodBurst(this.px, this.py + 1.0, this.pz, nx, nz, 6, false);
            this.damageFlash = Math.max(this.damageFlash, 0.65);
            this.cameraShake = Math.max(this.cameraShake, 0.25);
            cop.speed *= 0.35;
            if (this.armor > 0) {
              this.armor = Math.max(0, this.armor - 10);
            } else {
              this.health = Math.max(5, this.health - 12);
            }
          }
        }
      }
    }

    // Dynamic destructible/knockable street props (hydrants, traffic cones, port crates)
    const strikerX = this.currentVehicle ? this.currentVehicle.x : this.px;
    const strikerZ = this.currentVehicle ? this.currentVehicle.z : this.pz;
    const strikerSpd = this.currentVehicle ? Math.abs(this.currentVehicle.speed) : Math.hypot(this.pvx, this.pvz);
    const hitRadius = this.currentVehicle ? 2.1 : 0.75;

    for (const prop of this.physicsProps) {
      const dx = prop.x - strikerX;
      const dz = prop.z - strikerZ;
      const dist = Math.hypot(dx, dz);
      if (dist < hitRadius + prop.radius && strikerSpd > 2.2) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const nz = dist > 0.01 ? dz / dist : 0;
        const launch = Math.min(24, strikerSpd * 1.15);
        prop.vx = nx * launch;
        prop.vz = nz * launch;
        prop.vy = 3.5 + launch * 0.25;
        prop.avX = (Math.random() - 0.5) * 14;
        prop.avZ = (Math.random() - 0.5) * 14;
        this.audio.playImpact(0.35);
      }

      if (Math.abs(prop.vx) > 0.05 || Math.abs(prop.vz) > 0.05 || prop.y > prop.halfH + 0.02) {
        prop.vy -= 22 * dt;
        prop.x += prop.vx * dt;
        prop.y += prop.vy * dt;
        prop.z += prop.vz * dt;
        prop.rx += prop.avX * dt;
        prop.rz += prop.avZ * dt;

        if (prop.y <= prop.halfH) {
          prop.y = prop.halfH;
          prop.vy = Math.abs(prop.vy) > 2.2 ? Math.abs(prop.vy) * 0.35 : 0;
          prop.vx *= 0.82;
          prop.vz *= 0.82;
          prop.avX *= 0.78;
          prop.avZ *= 0.78;
        }
        prop.mesh.position.set(prop.x, prop.y, prop.z);
        prop.mesh.rotation.set(prop.rx, 0, prop.rz);
      }
    }
  }

  private updatePlayerOnFoot(dt: number) {
    let moveF = 0;
    let moveR = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveF += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveF -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveR -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveR += 1;

    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.stamina > 2 && moveF > 0;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 18);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 14);
    }

    const legBoost = (this.cyberStage >= 3 ? 1.38 : 1.0) * (this.cyberOverdriveActive ? 1.28 : 1.0);
    const targetMaxSpeed = (sprinting ? 8.8 : 4.2) * legBoost;

    let speed = 0;
    if (moveF !== 0 || moveR !== 0) {
      const len = Math.hypot(moveF, moveR);
      const nf = moveF / len;
      const nr = moveR / len;
      const fwdX = Math.sin(this.camYaw);
      const fwdZ = Math.cos(this.camYaw);
      const rightX = Math.cos(this.camYaw);
      const rightZ = -Math.sin(this.camYaw);

      const dirX = fwdX * nf + rightX * nr;
      const dirZ = fwdZ * nf + rightZ * nr;
      this.pvx = THREE.MathUtils.damp(this.pvx, dirX * targetMaxSpeed, 12, dt);
      this.pvz = THREE.MathUtils.damp(this.pvz, dirZ * targetMaxSpeed, 12, dt);

      const targetYaw = this.aiming ? this.camYaw : Math.atan2(dirX, dirZ);
      let diff = targetYaw - this.pYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.pYaw += diff * Math.min(1, dt * 14);
    } else {
      this.pvx = THREE.MathUtils.damp(this.pvx, 0, 14, dt);
      this.pvz = THREE.MathUtils.damp(this.pvz, 0, 14, dt);
      if (this.aiming) {
        this.pYaw = this.camYaw;
      }
    }

    speed = Math.hypot(this.pvx, this.pvz);

    // Jump
    if (this.keys.has('Space') && this.grounded) {
      this.pvy = (this.cyberStage >= 3 ? 9.2 : 6.6) + (this.cyberOverdriveActive ? 1.6 : 0);
      this.grounded = false;
    }

    this.pvy -= 21 * dt;
    const nextX = THREE.MathUtils.clamp(this.px + this.pvx * dt, -230, 230);
    const nextZ = THREE.MathUtils.clamp(this.pz + this.pvz * dt, -230, 305);

    if (!this.collidersWithCheck(nextX, this.pz, 0.45, this.py)) this.px = nextX;
    if (!this.collidersWithCheck(this.px, nextZ, 0.45, this.py)) this.pz = nextZ;

    this.py += this.pvy * dt;
    const groundY = Math.abs(this.px) <= 210 && Math.abs(this.pz) <= 210 ? 0.16 : 0.04;
    if (this.py <= groundY) {
      this.py = groundY;
      this.pvy = 0;
      this.grounded = true;
    }

    this.gordRig.root.position.set(this.px, this.py, this.pz);
    this.gordRig.root.rotation.y = this.pYaw;
    this.gordRig.weaponMount.visible = true;

    animateCharacterRig(this.gordRig, {
      speed,
      maxSpeed: targetMaxSpeed,
      time: this.elapsed,
      dt,
      aiming: this.aiming || this.fireCooldown > 0,
      talking: this.dialogueTimer > 0,
      seated: false,
      meleeSwing: this.meleeSwingTimer > 0 ? 1 - this.meleeSwingTimer / 0.34 : 0,
      grounded: this.grounded,
      weaponRecoil: this.weaponRecoil,
    });
  }

  private collidersWithCheck(x: number, z: number, r: number, y: number): boolean {
    return this.colliders.some(
      (b) => y < b.maxY && x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ
    );
  }

  private updateDrivenVehicle(v: VehicleInstance, dt: number) {
    const throttle = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const steerIn = (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) -
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0);
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (v.kind === 'helicopter') {
      const ascend = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ControlLeft') || this.keys.has('KeyC') ? 1 : 0);
      v.vy = THREE.MathUtils.damp(v.vy, ascend * 14, 4, dt);
      v.y = Math.max(0.25, Math.min(180, v.y + v.vy * dt));
      v.yaw += steerIn * 1.8 * dt;
      const fwdSpeed = throttle * (boost ? 48 : 32);
      v.speed = THREE.MathUtils.damp(v.speed, fwdSpeed, 3, dt);
      v.vx = Math.sin(v.yaw) * v.speed;
      v.vz = Math.cos(v.yaw) * v.speed;
      v.x = THREE.MathUtils.clamp(v.x + v.vx * dt, -350, 350);
      v.z = THREE.MathUtils.clamp(v.z + v.vz * dt, -350, 420);
      v.pitch = THREE.MathUtils.damp(v.pitch, throttle * 0.22, 5, dt);
      v.roll = THREE.MathUtils.damp(v.roll, -steerIn * 0.28, 5, dt);
      this.audio.updateEngine(true, Math.max(0.4, Math.abs(v.speed) / 48), true);
    } else if (v.kind === 'jet') {
      const targetSpd = throttle > 0 ? (boost ? v.maxSpeed : v.maxSpeed * 0.65) : throttle < 0 ? 0 : Math.max(0, v.speed * 0.99);
      v.speed = THREE.MathUtils.damp(v.speed, targetSpd, 1.8, dt);
      v.yaw += steerIn * 1.45 * dt;
      const liftInput = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ControlLeft') || this.keys.has('KeyC') ? 1 : 0);
      if (v.speed > 26 || v.y > 1.2) {
        v.vy = THREE.MathUtils.damp(v.vy, liftInput * 22 + (v.speed > 40 ? 1.5 : -4), 3, dt);
      } else {
        v.vy = 0;
      }
      v.y = Math.max(0.22, Math.min(260, v.y + v.vy * dt));
      v.vx = Math.sin(v.yaw) * v.speed;
      v.vz = Math.cos(v.yaw) * v.speed;
      v.x = THREE.MathUtils.clamp(v.x + v.vx * dt, -420, 420);
      v.z = THREE.MathUtils.clamp(v.z + v.vz * dt, -420, 500);
      v.pitch = THREE.MathUtils.damp(v.pitch, -v.vy * 0.018, 4, dt);
      v.roll = THREE.MathUtils.damp(v.roll, -steerIn * 0.55, 4, dt);
      v.afterburnerGlow?.forEach((ab) => {
        ab.visible = v.speed > 18;
        ab.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      });
      this.audio.updateEngine(true, Math.min(1, v.speed / v.maxSpeed), true);
    } else {
      // Ground Car / Motorcycle Physics
      const handbrake = this.keys.has('Space');
      const maxS = v.maxSpeed * (boost ? 1.22 : 1.0);
      if (handbrake) {
        v.speed = THREE.MathUtils.damp(v.speed, 0, 5.5, dt);
      } else if (throttle !== 0) {
        const accelRate = throttle > 0 ? v.accel : v.accel * 0.75;
        v.speed = THREE.MathUtils.clamp(v.speed + throttle * accelRate * dt, -maxS * 0.35, maxS);
      } else {
        v.speed = THREE.MathUtils.damp(v.speed, 0, 1.8, dt);
      }

      const speedFactor = THREE.MathUtils.clamp(Math.abs(v.speed) / 8, 0, 1);
      const steerTarget = steerIn * (0.48 - speedFactor * 0.16);
      v.steerAngle = THREE.MathUtils.damp(v.steerAngle, steerTarget, 10, dt);

      const turnDir = v.speed >= 0 ? 1 : -1;
      v.yaw += v.steerAngle * speedFactor * turnDir * (handbrake ? 2.6 : 1.9) * dt;

      v.vx = Math.sin(v.yaw) * v.speed;
      v.vz = Math.cos(v.yaw) * v.speed;

      const nx = THREE.MathUtils.clamp(v.x + v.vx * dt, -230, 230);
      const nz = THREE.MathUtils.clamp(v.z + v.vz * dt, -230, 305);

      if (!this.collidersWithCheck(nx, v.z, 1.45, 0.5)) {
        v.x = nx;
      } else {
        const wallSpd = Math.abs(v.vx);
        this.audio.playImpact(Math.min(1, wallSpd / 25));
        if (wallSpd > 5.5) {
          const pushDirX = v.vx > 0 ? -1 : 1;
          deformVehicleBody(v, pushDirX, 0, wallSpd, v.x - pushDirX * 1.4, v.z);
          this.spawnSparks(v.x - pushDirX * 1.3, 0.65, v.z, Math.min(12, Math.floor(wallSpd * 0.45)), 10);
          v.health = Math.max(8, v.health - wallSpd * 0.55);
          this.cameraShake = Math.max(this.cameraShake, Math.min(0.35, wallSpd * 0.014));
        }
        v.speed *= -0.3;
      }
      if (!this.collidersWithCheck(v.x, nz, 1.45, 0.5)) {
        v.z = nz;
      } else {
        const wallSpd = Math.abs(v.vz);
        this.audio.playImpact(Math.min(1, wallSpd / 25));
        if (wallSpd > 5.5) {
          const pushDirZ = v.vz > 0 ? -1 : 1;
          deformVehicleBody(v, 0, pushDirZ, wallSpd, v.x, v.z - pushDirZ * 1.4);
          this.spawnSparks(v.x, 0.65, v.z - pushDirZ * 1.3, Math.min(12, Math.floor(wallSpd * 0.45)), 10);
          v.health = Math.max(8, v.health - wallSpd * 0.55);
          this.cameraShake = Math.max(this.cameraShake, Math.min(0.35, wallSpd * 0.014));
        }
        v.speed *= -0.3;
      }

      // Dynamic suspension pitch & roll
      v.pitch = THREE.MathUtils.damp(v.pitch, -throttle * 0.035, 8, dt);
      v.roll = THREE.MathUtils.damp(
        v.roll,
        v.kind === 'motorcycle' ? -steerIn * speedFactor * 0.42 : steerIn * speedFactor * 0.05,
        8,
        dt
      );
      if (v.taillightMat) {
        v.taillightMat.emissiveIntensity = throttle < 0 || handbrake ? 4.2 : 1.8;
      }
      if (v.health < v.maxHealth * 0.35) {
        v.turnSignal = 'hazard';
      } else if (steerIn > 0 && Math.abs(v.speed) > 1.2) {
        v.turnSignal = 'left';
      } else if (steerIn < 0 && Math.abs(v.speed) > 1.2) {
        v.turnSignal = 'right';
      } else {
        v.turnSignal = 'none';
      }
      // Patrolling police cruisers react to extreme reckless speeding right beside them (> 105 km/h)
      if (this.wantedStars === 0 && Math.abs(v.speed) > 29) {
        for (const cop of this.vehicles) {
          if (cop.isPolice && !cop.driverOccupied && cop.health > 0 && Math.hypot(cop.x - v.x, cop.z - v.z) < 20) {
            this.addWanted(1, false);
            this.showNotification('Патруль зафиксировал опасную езду!');
            break;
          }
        }
      }
      this.audio.updateEngine(true, Math.min(1, Math.abs(v.speed) / v.maxSpeed), false);
    }

    // Sync Gord coordinates to vehicle
    this.px = v.x;
    this.py = v.y;
    this.pz = v.z;
    this.pYaw = v.yaw;

    if (v.kind === 'motorcycle') {
      this.gordRig.root.position.set(v.x, v.y + 0.12, v.z);
      this.gordRig.root.rotation.y = v.yaw;
      animateCharacterRig(this.gordRig, {
        speed: 0,
        maxSpeed: 1,
        time: this.elapsed,
        dt,
        aiming: false,
        talking: false,
        seated: true,
        meleeSwing: 0,
        grounded: true,
      });
    }
  }

  private updateVehicles(dt: number) {
    const gvx = this.currentVehicle ? this.currentVehicle.vx : this.pvx;
    const gvz = this.currentVehicle ? this.currentVehicle.vz : this.pvz;
    const gSpeed = Math.hypot(gvx, gvz);

    for (const v of this.vehicles) {
      // Traffic & Police AI movement
      if (v.isTraffic && !v.driverOccupied) {
        const distPlayer = Math.hypot(this.px - v.x, this.pz - v.z);
        let targetSpd = v.isPolice ? 12.8 : 10.5;
        let desiredYaw = v.yaw;
        let turnRateMax = 2.2;

        if (v.isPolice && this.wantedStars > 0 && v.health > 0) {
          const starMaxSpeed = [0, 22, 27, 32, 37, 42][this.wantedStars] ?? 32;
          const role = v.policeRole ?? 'pursuit';
          const dxPlayer = this.px - v.x;
          const dzPlayer = this.pz - v.z;

          if (role === 'roadblock') {
            // Hold perpendicular barricade position across Gord's path with brakes locked
            desiredYaw = v.aiBlockAngle ?? v.yaw;
            targetSpd = 0;
            turnRateMax = 2.8;
          } else if (role === 'interceptor') {
            // Predict player's path, race ahead, and cut perpendicular in front of Gord to block escape!
            const lookahead = THREE.MathUtils.clamp(distPlayer / 24, 0.5, 2.3);
            const leadX = this.px + gvx * lookahead;
            const leadZ = this.pz + gvz * lookahead;

            const fwdX = gSpeed > 2 ? gvx / gSpeed : Math.sin(this.pYaw);
            const fwdZ = gSpeed > 2 ? gvz / gSpeed : Math.cos(this.pYaw);
            const isAheadOfGord = -dxPlayer * fwdX + -dzPlayer * fwdZ > 2.5;

            if (distPlayer < 19 && isAheadOfGord && gSpeed > 4) {
              // Execute perpendicular slide-block across Gord's lane & slam brakes!
              const perpYaw = Math.atan2(fwdX, fwdZ) + (v.aiBlockSign ?? 1) * (Math.PI / 2);
              desiredYaw = perpYaw;
              targetSpd = distPlayer < 10.5 ? 0 : starMaxSpeed * 0.42;
              turnRateMax = 4.5;
            } else {
              const sideX = -fwdZ * (v.aiBlockSign ?? 1) * (distPlayer > 22 ? 4.4 : 0.9);
              const sideZ = fwdX * (v.aiBlockSign ?? 1) * (distPlayer > 22 ? 4.4 : 0.9);
              desiredYaw = Math.atan2(leadX + sideX - v.x, leadZ + sideZ - v.z);
              targetSpd = starMaxSpeed * (this.wantedStars >= 4 ? 1.1 : 1.0);
              turnRateMax = 3.3;
            }
          } else {
            // 'pursuit': Aggressive chase, PIT rear-quarter ramming at 3+ stars, or box-in
            turnRateMax = 3.0;
            if (this.currentVehicle) {
              if (this.wantedStars >= 3 && gSpeed > 9 && distPlayer < 16) {
                // Target Gord's rear-quarter panel to execute a physical PIT maneuver spin!
                const fwdX = gvx / gSpeed;
                const fwdZ = gvz / gSpeed;
                const sideX = -fwdZ * (v.aiBlockSign ?? 1) * 1.45;
                const sideZ = fwdX * (v.aiBlockSign ?? 1) * 1.45;
                const pitX = this.px - fwdX * 1.9 + sideX;
                const pitZ = this.pz - fwdZ * 1.9 + sideZ;
                desiredYaw = Math.atan2(pitX - v.x, pitZ - v.z);
                targetSpd = Math.max(starMaxSpeed, gSpeed * 1.18);
              } else if (this.wantedStars <= 2 && distPlayer < 9.5) {
                desiredYaw = Math.atan2(dxPlayer, dzPlayer) + (v.aiBlockSign ?? 1) * 0.85;
                targetSpd = 0;
              } else {
                desiredYaw = Math.atan2(dxPlayer, dzPlayer);
                targetSpd = starMaxSpeed;
              }
            } else {
              // Gord is on foot: pull up sideways as ballistic cover and deploy officers
              desiredYaw = Math.atan2(dxPlayer, dzPlayer);
              if (distPlayer < 8.5) {
                desiredYaw += (v.aiBlockSign ?? 1) * 0.95;
                targetSpd = 0;
              } else {
                targetSpd = starMaxSpeed * 0.9;
              }
            }
          }

          // Deploy an officer from pursuing/roadblock cruiser when near Gord (2+ stars)
          if (v.aiDeployTimer && v.aiDeployTimer > 0) {
            v.aiDeployTimer -= dt;
          } else if (this.wantedStars >= 2 && distPlayer < 16 && Math.abs(v.speed) < 5) {
            const nearbyCopsOnFoot = this.npcs.filter(
              (n) => n.alive && n.role === 'police' && Math.hypot(n.x - this.px, n.z - this.pz) < 35
            ).length;
            if (nearbyCopsOnFoot < Math.min(6, this.wantedStars + 1)) {
              const ex = v.x - Math.cos(v.yaw) * 2.2;
              const ez = v.z + Math.sin(v.yaw) * 2.2;
              if (!this.collidersWithCheck(ex, ez, 0.5, 0.5)) {
                this.spawnEnemy('police', ex, ez);
                v.doorOpenProgress = 1.0;
                v.aiDeployTimer = 14;
              }
            } else {
              v.aiDeployTimer = 6;
            }
          }

          // Obstacle avoidance whisker probes + reverse recovery if blocked by buildings
          if (v.aiReverseTimer && v.aiReverseTimer > 0) {
            v.aiReverseTimer -= dt;
            targetSpd = -8.5;
            v.yaw += (v.aiReverseDir ?? 1) * 2.3 * dt;
            v.steerAngle = THREE.MathUtils.damp(v.steerAngle, -(v.aiReverseDir ?? 1) * 0.42, 10, dt);
          } else {
            const probeFwdX = v.x + Math.sin(v.yaw) * 4.2;
            const probeFwdZ = v.z + Math.cos(v.yaw) * 4.2;
            if (targetSpd > 4 && this.collidersWithCheck(probeFwdX, probeFwdZ, 1.5, 0.5)) {
              const leftYaw = v.yaw + 0.65;
              const rightYaw = v.yaw - 0.65;
              const leftBlocked = this.collidersWithCheck(v.x + Math.sin(leftYaw) * 4.8, v.z + Math.cos(leftYaw) * 4.8, 1.4, 0.5);
              const rightBlocked = this.collidersWithCheck(v.x + Math.sin(rightYaw) * 4.8, v.z + Math.cos(rightYaw) * 4.8, 1.4, 0.5);
              if (!leftBlocked) {
                desiredYaw = v.yaw + 1.1;
              } else if (!rightBlocked) {
                desiredYaw = v.yaw - 1.1;
              } else {
                v.aiReverseTimer = 0.75;
                v.aiReverseDir = Math.random() < 0.5 ? 1 : -1;
              }
            }

            let diff = desiredYaw - v.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const yawStep = THREE.MathUtils.clamp(diff, -turnRateMax * dt, turnRateMax * dt);
            v.yaw += yawStep;
            v.steerAngle = THREE.MathUtils.damp(
              v.steerAngle,
              THREE.MathUtils.clamp(diff * 0.9, -0.46, 0.46),
              10,
              dt
            );
          }
        } else {
          // City Grid Traffic AI: Traffic Rules, Signal Stopping, Turn Signals & Real-Time Obstacle Avoidance
          if (v.patrolTurnCooldown && v.patrolTurnCooldown > 0) {
            v.patrolTurnCooldown = Math.max(0, v.patrolTurnCooldown - dt);
          }
          if (v.aiPanicTimer && v.aiPanicTimer > 0) {
            v.aiPanicTimer = Math.max(0, v.aiPanicTimer - dt);
          }

          // Find nearest street centerline on X and Z
          let nearRX = ROAD_CENTERS[0];
          let minDX = Infinity;
          let nearRZ = ROAD_CENTERS[0];
          let minDZ = Infinity;
          for (const rc of ROAD_CENTERS) {
            const dx = Math.abs(v.x - rc);
            if (dx < minDX) {
              minDX = dx;
              nearRX = rc;
            }
            if (rc <= 150) {
              const dz = Math.abs(v.z - rc);
              if (dz < minDZ) {
                minDZ = dz;
                nearRZ = rc;
              }
            }
          }

          if (v.patrolTargetYaw === undefined) {
            v.patrolTargetYaw = v.yaw;
          }

          // Identify upcoming intersection ahead along current cardinal direction
          const tDirX = Math.round(Math.sin(v.patrolTargetYaw));
          const tDirZ = Math.round(Math.cos(v.patrolTargetYaw));
          let nextIX = nearRX;
          let nextIZ = nearRZ;
          let distToIntersection = Infinity;

          if (Math.abs(tDirX) > 0) {
            for (const rc of ROAD_CENTERS) {
              const dAhead = (rc - v.x) * tDirX;
              if (dAhead >= -2.5 && dAhead < distToIntersection) {
                distToIntersection = dAhead;
                nextIX = rc;
              }
            }
          } else {
            for (const rc of ROAD_CENTERS) {
              if (rc > 150) continue;
              const dAhead = (rc - v.z) * tDirZ;
              if (dAhead >= -2.5 && dAhead < distToIntersection) {
                distToIntersection = dAhead;
                nextIZ = rc;
              }
            }
          }

          // 1. Pre-intersection turn planning & turn-signal blinker activation (6m..26m before center)
          const planKey = `${nextIX}_${nextIZ}`;
          if (distToIntersection > 6.0 && distToIntersection < 26.0 && v.aiPlanKey !== planKey) {
            v.aiPlanKey = planKey;
            const leftYaw = v.patrolTargetYaw + Math.PI / 2;
            const rightYaw = v.patrolTargetYaw - Math.PI / 2;
            const isValidDir = (cy: number) => {
              const tx = nextIX + Math.sin(cy) * 45;
              const tz = nextIZ + Math.cos(cy) * 45;
              return tx >= -215 && tx <= 215 && tz >= -215 && tz <= 160;
            };
            const validTurns: Array<{ dir: 'straight' | 'left' | 'right'; yaw: number }> = [];
            if (isValidDir(v.patrolTargetYaw)) validTurns.push({ dir: 'straight', yaw: v.patrolTargetYaw });
            if (isValidDir(leftYaw)) validTurns.push({ dir: 'left', yaw: leftYaw });
            if (isValidDir(rightYaw)) validTurns.push({ dir: 'right', yaw: rightYaw });

            if (validTurns.length > 0) {
              const turnsOnly = validTurns.filter((t) => t.dir !== 'straight');
              const straightOpt = validTurns.find((t) => t.dir === 'straight');
              const turnChance = v.isPolice ? 0.52 : 0.38;
              if ((!straightOpt || Math.random() < turnChance) && turnsOnly.length > 0) {
                v.aiPlannedTurn = turnsOnly[Math.floor(Math.random() * turnsOnly.length)].dir;
              } else {
                v.aiPlannedTurn = straightOpt ? 'straight' : validTurns[0].dir;
              }
            } else {
              v.aiPlannedTurn = 'left';
            }
          }

          // Activate amber turn signal before and during turn
          if (v.aiPlannedTurn === 'left' && (distToIntersection < 25 || Math.abs(v.patrolTargetYaw - v.yaw) > 0.18)) {
            v.turnSignal = 'left';
          } else if (v.aiPlannedTurn === 'right' && (distToIntersection < 25 || Math.abs(v.patrolTargetYaw - v.yaw) > 0.18)) {
            v.turnSignal = 'right';
          } else {
            v.turnSignal = 'none';
          }

          // Execute planned turn smoothly upon entering intersection box
          if (distToIntersection < 5.2 && (v.patrolTurnCooldown ?? 0) <= 0) {
            if (v.aiPlannedTurn === 'left') {
              v.patrolTargetYaw += Math.PI / 2;
            } else if (v.aiPlannedTurn === 'right') {
              v.patrolTargetYaw -= Math.PI / 2;
            } else {
              // Ensure valid grid bounds even if plan missed
              const tx = nextIX + Math.sin(v.patrolTargetYaw) * 45;
              const tz = nextIZ + Math.cos(v.patrolTargetYaw) * 45;
              if (tx < -215 || tx > 215 || tz < -215 || tz > 160) {
                const altLeft = v.patrolTargetYaw + Math.PI / 2;
                const alx = nextIX + Math.sin(altLeft) * 45;
                const alz = nextIZ + Math.cos(altLeft) * 45;
                v.patrolTargetYaw = alx >= -215 && alx <= 215 && alz >= -215 && alz <= 160 ? altLeft : v.patrolTargetYaw - Math.PI / 2;
              }
            }
            v.patrolTurnCooldown = 3.2;
          }

          // Clear turn signal once turn maneuver is aligned on new road
          if ((v.patrolTurnCooldown ?? 0) > 0 && (v.patrolTurnCooldown ?? 0) < 1.8) {
            let remAngle = Math.abs(v.patrolTargetYaw - v.yaw);
            while (remAngle > Math.PI) remAngle = Math.abs(remAngle - Math.PI * 2);
            if (remAngle < 0.14) {
              v.aiPlannedTurn = 'straight';
              v.turnSignal = 'none';
            }
          }

          // 2. Traffic Light Signal Compliance (Stop smoothly behind crosswalk on Red / Yellow)
          const panicking = (v.aiPanicTimer ?? 0) > 0;
          let signalStopActive = false;
          if (panicking) {
            targetSpd = 18.5;
          } else if (
            Math.abs(nextIX) <= 155 &&
            Math.abs(nextIZ) <= 155 &&
            distToIntersection >= 10.2 &&
            distToIntersection <= 24.0
          ) {
            const sig = getIntersectionSignal(this.elapsed, nextIX, nextIZ);
            const myLight = Math.abs(tDirX) > 0 ? sig.ew : sig.ns;
            if (myLight === 'red' || (myLight === 'yellow' && distToIntersection > 12.2)) {
              signalStopActive = true;
              if (distToIntersection <= 22.0) {
                const distToStopLine = Math.max(0, distToIntersection - 11.4);
                targetSpd = distToStopLine < 1.8 ? 0 : Math.min(targetSpd, distToStopLine * 1.45);
              }
            }
          }

          // 3. Real-Time Forward Corridor Obstacle Detection & Steering Avoidance
          const fwdX = Math.sin(v.yaw);
          const fwdZ = Math.cos(v.yaw);
          const leftX = Math.cos(v.yaw);
          const leftZ = -Math.sin(v.yaw);
          const scanDist = 10.5 + Math.max(0, v.speed) * 0.65;
          let targetDodgeOffset = 0;
          let hazardBlocked = false;

          // 3a. Other Vehicles Ahead (Queue smoothly at lights or swerve around stalled wrecks)
          for (const other of this.vehicles) {
            if (other === v || other.y > 1.5) continue;
            const odx = other.x - v.x;
            const odz = other.z - v.z;
            const fwdDist = odx * fwdX + odz * fwdZ;
            const latDist = odx * leftX + odz * leftZ;
            if (fwdDist > 0.4 && fwdDist < scanDist && Math.abs(latDist) < 2.25) {
              const queuingAtSignal = signalStopActive && other.isTraffic && other.health > other.maxHealth * 0.65;
              const isStoppedObstacle = !queuingAtSignal && Math.abs(other.speed) < 1.0 && other !== this.currentVehicle;
              const isPlayerObstacle = other === this.currentVehicle && Math.abs(other.speed) < 1.5;
              if ((isStoppedObstacle || isPlayerObstacle) && fwdDist < 13.5 && targetSpd > 0) {
                // Attempt real-time lane-change dodge around stalled/parked obstacle if clear of buildings
                const dodgeDir = latDist <= 0.35 ? 1 : -1;
                const probeX = v.x + fwdX * 4.5 + leftX * dodgeDir * 2.8;
                const probeZ = v.z + fwdZ * 4.5 + leftZ * dodgeDir * 2.8;
                if (!this.collidersWithCheck(probeX, probeZ, 1.4, 0.5) && fwdDist > 5.8) {
                  targetDodgeOffset = dodgeDir * 2.75;
                  targetSpd = Math.min(targetSpd, 6.8);
                  v.turnSignal = dodgeDir > 0 ? 'left' : 'right';
                } else if (fwdDist < 7.5) {
                  targetSpd = 0;
                  hazardBlocked = true;
                } else {
                  targetSpd = Math.min(targetSpd, Math.max(0, (fwdDist - 6.5) * 1.4));
                }
              } else {
                // Normal moving vehicle ahead: maintain safe following distance
                if (fwdDist < 7.2) {
                  targetSpd = 0;
                } else {
                  const followCap = Math.max(0, other.speed * 0.92);
                  targetSpd = Math.min(targetSpd, Math.max(followCap, (fwdDist - 7.0) * 1.6));
                }
              }
            }
          }

          // 3b. Pedestrians & Gord on Foot in Forward Path (Emergency Yield / Brake)
          if (!this.currentVehicle) {
            const pF = (this.px - v.x) * fwdX + (this.pz - v.z) * fwdZ;
            const pL = (this.px - v.x) * leftX + (this.pz - v.z) * leftZ;
            if (pF > 0.3 && pF < 11.5 && Math.abs(pL) < 2.1) {
              targetSpd = 0;
              hazardBlocked = true;
              targetDodgeOffset = pL >= 0 ? -1.4 : 1.4;
            }
          }
          for (const npc of this.npcs) {
            if (!npc.alive) continue;
            const nF = (npc.x - v.x) * fwdX + (npc.z - v.z) * fwdZ;
            const nL = (npc.x - v.x) * leftX + (npc.z - v.z) * leftZ;
            if (nF > 0.3 && nF < 10.5 && Math.abs(nL) < 1.95) {
              targetSpd = 0;
              targetDodgeOffset = nL >= 0 ? -1.3 : 1.3;
              break;
            }
          }

          // 3c. Dynamic Street Obstacles (Traffic Cones, Hydrants, Crates)
          for (const prop of this.physicsProps) {
            const prF = (prop.x - v.x) * fwdX + (prop.z - v.z) * fwdZ;
            const prL = (prop.x - v.x) * leftX + (prop.z - v.z) * leftZ;
            if (prF > 0.5 && prF < 9.5 && Math.abs(prL) < 1.55) {
              targetDodgeOffset = prL >= 0 ? -2.1 : 2.1;
              targetSpd = Math.min(targetSpd, 6.0);
              break;
            }
          }

          if (hazardBlocked || v.health < v.maxHealth * 0.35) {
            v.turnSignal = 'hazard';
          }

          v.aiLaneDodgeOffset = THREE.MathUtils.damp(v.aiLaneDodgeOffset ?? 0, targetDodgeOffset, 5.5, dt);

          // Lane-centering correction toward right-hand lane + real-time obstacle dodge offset
          desiredYaw = v.patrolTargetYaw;
          const cardDirX = Math.sin(desiredYaw);
          const cardDirZ = Math.cos(desiredYaw);
          const rightLaneX = -cardDirZ * 3.8 + leftX * (v.aiLaneDodgeOffset ?? 0);
          const rightLaneZ = cardDirX * 3.8 + leftZ * (v.aiLaneDodgeOffset ?? 0);
          if (Math.abs(cardDirX) > 0.7) {
            // Driving East/West along nearRZ
            const laneErr = nearRZ + rightLaneZ - v.z;
            desiredYaw -= THREE.MathUtils.clamp(laneErr * cardDirX * 0.095, -0.38, 0.38);
          } else {
            // Driving North/South along nearRX
            const laneErr = nearRX + rightLaneX - v.x;
            desiredYaw += THREE.MathUtils.clamp(laneErr * cardDirZ * 0.095, -0.38, 0.38);
          }

          let diff = desiredYaw - v.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnMax = 2.55;
          v.yaw += THREE.MathUtils.clamp(diff, -turnMax * dt, turnMax * dt);
          v.steerAngle = THREE.MathUtils.damp(v.steerAngle, THREE.MathUtils.clamp(diff * 0.85, -0.44, 0.44), 9, dt);

          // Decelerate smoothly into 90-degree turns
          if (Math.abs(diff) > 0.32) {
            targetSpd = Math.min(targetSpd, 7.2);
          }
        }

        // Separation from other AI vehicles so pursuing police fan out instead of stacking
        for (const other of this.vehicles) {
          if (other === v || other === this.currentVehicle || other.y > 1.5) continue;
          const sx = v.x - other.x;
          const sz = v.z - other.z;
          const sd = Math.hypot(sx, sz);
          if (sd > 0.01 && sd < 3.4) {
            const push = (3.4 - sd) * 0.45;
            v.x += (sx / sd) * push;
            v.z += (sz / sd) * push;
          }
        }

        v.speed = THREE.MathUtils.damp(v.speed, targetSpd, targetSpd === 0 ? 7.5 : 4.2, dt);
        v.vx = Math.sin(v.yaw) * v.speed;
        v.vz = Math.cos(v.yaw) * v.speed;
        const nx = v.x + v.vx * dt;
        const nz = v.z + v.vz * dt;

        if (Math.abs(nx) > 220 || nz < -220 || nz > 170 || this.collidersWithCheck(nx, nz, 1.5, 0.5)) {
          if (Math.abs(v.speed) > 7.0) {
            const impactX = -Math.sin(v.yaw);
            const impactZ = -Math.cos(v.yaw);
            deformVehicleBody(v, impactX, impactZ, Math.abs(v.speed) * 0.9);
            v.health = Math.max(8, v.health - Math.abs(v.speed) * 0.45);
          }
          if (v.isPolice && this.wantedStars > 0) {
            v.aiStuckTimer = (v.aiStuckTimer ?? 0) + dt;
            v.speed *= -0.25;
            if ((v.aiStuckTimer ?? 0) > 0.25) {
              v.aiReverseTimer = 0.75;
              v.aiReverseDir = (v.aiReverseDir ?? 1) * -1;
              v.aiStuckTimer = 0;
            }
          } else {
            v.yaw += Math.PI;
            v.patrolTargetYaw = v.yaw;
            v.patrolTurnCooldown = 1.8;
            v.aiPlannedTurn = 'straight';
            v.turnSignal = 'none';
          }
        } else {
          v.x = nx;
          v.z = nz;
          v.aiStuckTimer = 0;
        }

        // Suspension pitch & brake lights for AI cars
        v.pitch = THREE.MathUtils.damp(v.pitch, targetSpd === 0 && v.speed > 2 ? 0.03 : 0, 8, dt);
        v.roll = THREE.MathUtils.damp(v.roll, v.steerAngle * Math.min(1, Math.abs(v.speed) / 14) * 0.08, 8, dt);
        if (v.taillightMat) {
          v.taillightMat.emissiveIntensity = targetSpd === 0 ? 4.2 : 1.8;
        }
      }

      // Progressive crash damage tilt & engine smoke
      if (v.crashJolt && v.crashJolt > 0) {
        v.crashJolt = Math.max(0, v.crashJolt - dt * 0.9);
      }
      const dmgRatio = Math.max(0, 1 - v.health / v.maxHealth);
      if (dmgRatio > 0.38 && Math.hypot(v.x - this.px, v.z - this.pz) < 85) {
        v.smokeCooldown = (v.smokeCooldown ?? 0) - dt;
        if ((v.smokeCooldown ?? 0) <= 0) {
          v.smokeCooldown = dmgRatio > 0.72 ? 0.09 : 0.22;
          const hoodX = v.x + Math.sin(v.yaw) * 1.45;
          const hoodZ = v.z + Math.cos(v.yaw) * 1.45;
          this.spawnEngineSmoke(hoodX, v.y + 0.92, hoodZ);
        }
      }

      // Sync visual transforms, wheels, rotors, doors & sirens
      v.root.position.set(v.x, v.y, v.z);
      v.root.rotation.y = v.yaw;
      v.bodyGroup.rotation.x = v.pitch + (v.crashJolt ?? 0) + dmgRatio * 0.04;
      v.bodyGroup.rotation.z = v.roll + (dmgRatio > 0.5 ? 0.035 : 0);

      for (const pivot of v.frontSteerPivots) {
        pivot.rotation.y = v.steerAngle;
      }
      if (v.steeringWheel) {
        v.steeringWheel.rotation.z = v.steerAngle * 2.2;
      }
      for (const w of v.wheels) {
        w.rotation.x += (v.speed / 0.35) * dt;
      }
      if (v.leftDoor) {
        v.doorOpenProgress = Math.max(0, v.doorOpenProgress - dt * 1.4);
        v.leftDoor.rotation.y = -v.doorOpenProgress * 0.95;
      }
      if (v.mainRotor) {
        const spin = v.driverOccupied ? 26 : 2.5;
        v.mainRotor.rotation.y += spin * dt;
      }
      if (v.tailRotor) {
        const spin = v.driverOccupied ? 32 : 3.5;
        v.tailRotor.rotation.x += spin * dt;
      }
      if (v.policeLights) {
        const active = this.wantedStars > 0 || v.driverOccupied;
        const flashRate = 16 + this.wantedStars * 3;
        const flash = Math.sin(this.elapsed * flashRate) > 0;
        (v.policeLights.red.material as THREE.MeshStandardMaterial).emissiveIntensity = active && flash ? 5.2 : 0.4;
        (v.policeLights.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = active && !flash ? 5.2 : 0.4;
      }
      if (v.turnSignals) {
        const blinkOn = Math.sin(this.elapsed * 14.5) > 0;
        const sig = v.turnSignal ?? 'none';
        v.turnSignals.leftMat.emissiveIntensity = (sig === 'left' || sig === 'hazard') && blinkOn ? 5.0 : 0.0;
        v.turnSignals.rightMat.emissiveIntensity = (sig === 'right' || sig === 'hazard') && blinkOn ? 5.0 : 0.0;
      }
    }
  }

  private updateNpcs(dt: number) {
    for (const npc of this.npcs) {
      if (!npc.alive) continue;

      if (npc.talkingTimer > 0 && npc.talkingTimer < 500) {
        npc.talkingTimer -= dt;
      }
      if (npc.hitFlinchTimer && npc.hitFlinchTimer > 0) {
        npc.hitFlinchTimer = Math.max(0, npc.hitFlinchTimer - dt);
      }
      if (npc.panicTimer && npc.panicTimer > 0) {
        npc.panicTimer = Math.max(0, npc.panicTimer - dt);
      }

      // Knockback velocity decay from punches, bullets, or vehicle hits
      if (npc.knockVx || npc.knockVz) {
        const kx = npc.x + (npc.knockVx ?? 0) * dt;
        const kz = npc.z + (npc.knockVz ?? 0) * dt;
        if (!this.collidersWithCheck(kx, kz, 0.45, 0.5)) {
          npc.x = kx;
          npc.z = kz;
        }
        npc.knockVx = (npc.knockVx ?? 0) * 0.82;
        npc.knockVz = (npc.knockVz ?? 0) * 0.82;
        if (Math.hypot(npc.knockVx, npc.knockVz) < 0.08) {
          npc.knockVx = 0;
          npc.knockVz = 0;
        }
      }

      const distToPlayer = Math.hypot(this.px - npc.x, this.pz - npc.z);
      const isHostile =
        npc.role === 'gangster' ||
        npc.role === 'boss' ||
        (npc.role === 'police' && this.wantedStars > 0);

      let aiming = false;
      let moveSpd = 0;
      let meleeSwing = 0;
      const panicking = npc.role === 'civilian' && (npc.panicTimer ?? 0) > 0;

      if (isHostile && distToPlayer < 46) {
        npc.yaw = Math.atan2(this.px - npc.x, this.pz - npc.z);
        if (distToPlayer <= 2.1 && !this.currentVehicle) {
          // Close-quarters melee strike / brawl!
          npc.fireCooldown -= dt;
          if (npc.fireCooldown <= 0) {
            npc.fireCooldown = 0.85;
            meleeSwing = 1.0;
            this.audio.playImpact(0.45);
            this.damageFlash = Math.max(this.damageFlash, 0.48);
            this.spawnBloodBurst(this.px, this.py + 1.2, this.pz, 0, 0, 4, false);
            if (this.armor > 0) this.armor = Math.max(0, this.armor - 7);
            else this.health = Math.max(0, this.health - 9);
          }
        } else if (distToPlayer > 14) {
          moveSpd = npc.speed * 1.35;
          const nx = npc.x + Math.sin(npc.yaw) * moveSpd * dt;
          const nz = npc.z + Math.cos(npc.yaw) * moveSpd * dt;
          if (!this.collidersWithCheck(nx, nz, 0.45, 0.5)) {
            npc.x = nx;
            npc.z = nz;
          }
        } else {
          aiming = true;
          npc.fireCooldown -= dt;
          if (npc.fireCooldown <= 0) {
            npc.fireCooldown = npc.role === 'boss' ? 0.48 : 0.95;
            this.fireNpcBullet(npc);
          }
        }
      } else if (panicking) {
        // Civilians sprint away in panic from gunfire, crashes & explosions!
        moveSpd = npc.speed * 2.4;
        const nx = npc.x + Math.sin(npc.yaw) * moveSpd * dt;
        const nz = npc.z + Math.cos(npc.yaw) * moveSpd * dt;
        if (Math.abs(nx) > 215 || Math.abs(nz) > 205 || this.collidersWithCheck(nx, nz, 0.5, 0.5)) {
          npc.yaw += Math.PI * 0.55;
        } else {
          npc.x = nx;
          npc.z = nz;
        }
      } else if (npc.talkingTimer > 0) {
        moveSpd = 0;
      } else {
        // Sidewalk pedestrian walk
        moveSpd = npc.speed;
        const nx = npc.x + Math.sin(npc.yaw) * moveSpd * dt;
        const nz = npc.z + Math.cos(npc.yaw) * moveSpd * dt;
        if (Math.abs(nx) > 215 || Math.abs(nz) > 205 || this.collidersWithCheck(nx, nz, 0.5, 0.5)) {
          npc.yaw += Math.PI * 0.65;
        } else {
          npc.x = nx;
          npc.z = nz;
        }
        if (Math.random() < dt * 0.25) {
          npc.yaw += (Math.random() - 0.5) * 1.4;
        }
      }

      npc.rig.root.position.set(npc.x, npc.y, npc.z);
      npc.rig.root.rotation.y = npc.yaw;

      animateCharacterRig(
        npc.rig,
        {
          speed: moveSpd,
          maxSpeed: 3.5,
          time: this.elapsed,
          dt,
          aiming,
          talking: npc.talkingTimer > 0 && moveSpd < 0.1,
          seated: false,
          meleeSwing,
          grounded: true,
          panic: panicking,
          hitFlinch: (npc.hitFlinchTimer ?? 0) / 0.28,
        },
        npc.phase
      );
    }
  }

  private fireNpcBullet(npc: NpcActor) {
    const tracer = new THREE.Mesh(this.bulletGeo, this.bulletMatEnemy);
    const dx = this.px - npc.x;
    const dy = (this.py + 1.1) - (npc.y + 1.35);
    const dz = this.pz - npc.z;
    const len = Math.max(0.01, Math.hypot(dx, dy, dz));
    tracer.position.set(npc.x + (dx / len) * 0.7, npc.y + 1.35, npc.z + (dz / len) * 0.7);
    this.scene.add(tracer);
    this.bullets.push({
      mesh: tracer,
      vx: (dx / len) * 65,
      vy: (dy / len) * 65,
      vz: (dz / len) * 65,
      life: 1.2,
      fromPlayer: false,
      damage: npc.role === 'boss' ? 14 : 8,
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;

      let hitWall = this.collidersWithCheck(b.mesh.position.x, b.mesh.position.z, 0.15, b.mesh.position.y);
      let hit = b.life <= 0 || hitWall;
      if (hitWall) {
        this.spawnSparks(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 4, 5);
      }

      if (!hit && b.fromPlayer) {
        for (const npc of this.npcs) {
          if (!npc.alive) continue;
          if (Math.hypot(npc.x - b.mesh.position.x, npc.z - b.mesh.position.z) < 0.75 &&
              Math.abs((npc.y + 1.1) - b.mesh.position.y) < 1.1) {
            this.damageNpc(npc, b.damage, b.vx, b.vz);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const v of this.vehicles) {
            if (v === this.currentVehicle) continue;
            if (Math.hypot(v.x - b.mesh.position.x, v.z - b.mesh.position.z) < 1.9 &&
                Math.abs((v.y + 0.85) - b.mesh.position.y) < 1.1) {
              v.health = Math.max(0, v.health - b.damage * 0.85);
              this.audio.playImpact(0.35);
              this.spawnSparks(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 6, 7);
              if (v.isPolice) {
                this.addWanted(2, true);
              } else if (v.isTraffic) {
                this.addWanted(1);
              }
              if (v.health === 0) {
                v.health = v.maxHealth;
                this.spawnExplosion(v.x, v.y + 0.7, v.z, 7.5);
              }
              hit = true;
              break;
            }
          }
        }
      } else if (!hit && !b.fromPlayer) {
        if (Math.hypot(this.px - b.mesh.position.x, this.pz - b.mesh.position.z) < 0.85) {
          if (this.currentVehicle) {
            this.currentVehicle.health = Math.max(10, this.currentVehicle.health - b.damage * 0.5);
            this.spawnSparks(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 4, 5);
          } else {
            this.damageFlash = Math.max(this.damageFlash, 0.55);
            this.cameraShake = Math.max(this.cameraShake, 0.12);
            this.spawnBloodBurst(this.px, this.py + 1.15, this.pz, b.vx, b.vz, 5, false);
            const incomingDmg = b.damage * (this.cyberOverdriveActive ? 0.65 : 1.0);
            if (this.armor > 0) {
              this.armor = Math.max(0, this.armor - incomingDmg);
            } else {
              this.health -= incomingDmg;
              if (this.health <= 0) {
                // Hospital Respawn
                this.health = this.maxHealth;
                this.armor = 50;
                this.wantedStars = 0;
                this.cyberOverdriveActive = false;
                this.mats.cyberGlowCyanMat.emissiveIntensity = 2.0;
                this.px = -155;
                this.pz = -120;
                this.py = 0.16;
                this.showNotification('Вы доставлены в Центральную больницу. Розыск снят.');
              }
            }
          }
          hit = true;
        }
      }

      if (hit) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 18 * dt;
      g.mesh.position.x += g.vx * dt;
      g.mesh.position.y = Math.max(0.18, g.mesh.position.y + g.vy * dt);
      g.mesh.position.z += g.vz * dt;
      if (g.mesh.position.y <= 0.18) {
        g.vx *= 0.65;
        g.vz *= 0.65;
        g.vy = Math.abs(g.vy) * 0.35;
      }
      if (g.fuse <= 0) {
        this.spawnExplosion(g.mesh.position.x, g.mesh.position.y + 0.4, g.mesh.position.z);
        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        (g.mesh.material as THREE.Material).dispose();
        this.grenades.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.life += dt;
      const t = e.life / e.maxLife;
      e.mesh.scale.setScalar(1 + t * 8.5);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t);
      if (e.life >= e.maxLife) {
        this.scene.remove(e.mesh);
        (e.mesh.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      }
    }

    // Update pooled FX Particles (blood droplets, crash sparks, brass casings, engine smoke)
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const p = this.fxParticles[i];
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.kind === 'shell') {
        p.mesh.rotation.x += 18 * dt;
        p.mesh.rotation.z += 14 * dt;
      } else if (p.kind === 'smoke') {
        const s = 0.55 + (1 - p.life / p.maxLife) * 1.9;
        p.mesh.scale.setScalar(s);
      }
      if (p.mesh.position.y < 0.18 && p.kind !== 'smoke') {
        p.mesh.position.y = 0.18;
        p.vy = p.kind === 'shell' ? Math.abs(p.vy) * 0.35 : 0;
        p.vx *= 0.45;
        p.vz *= 0.45;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.fxParticles.splice(i, 1);
      }
    }

    // Smoothly expand fresh blood pools on asphalt
    for (const pool of this.bloodPools) {
      if (pool.currentScale < pool.targetScale) {
        pool.currentScale = Math.min(pool.targetScale, pool.currentScale + dt * 1.15);
        pool.mesh.scale.setScalar(pool.currentScale);
      }
    }
  }

  private updateMissionsAndJobs(dt: number) {
    const m = this.missions[this.missionIndex];
    if (m && !m.completed) {
      this.missionMarker.visible = true;
      this.missionMarker.position.set(m.targetX, 0.2, m.targetZ);

      const dist = Math.hypot(this.px - m.targetX, this.pz - m.targetZ);
      let done = false;

      if (m.type === 'goto' && dist < 8) done = true;
      else if (m.type === 'deliver' && dist < 8) done = true;
      else if (m.type === 'eliminate' || m.type === 'arrest') {
        const aliveTargets = this.npcs.filter((n) => n.missionTag === m.id && n.alive);
        if (aliveTargets.length === 0) done = true;
      } else if (m.type === 'fly' && this.currentVehicle && (this.currentVehicle.kind === 'helicopter' || this.currentVehicle.kind === 'jet') && this.py > 65) {
        done = true;
      }

      if (done) {
        m.completed = true;
        this.money += m.rewardMoney;
        this.addXp(m.rewardXp);
        if (m.cyberUnlock && m.cyberUnlock > this.cyberStage) {
          this.cyberStage = m.cyberUnlock;
          this.gordRig.setCyberStage?.(this.cyberStage);
          this.cyberTransformBannerTimer = 4.2;
          this.cyberEnergy = this.maxCyberEnergy;
          const upg = this.upgrades.find((u) => u.stageRequired === m.cyberUnlock);
          if (upg) upg.installed = true;
        }
        this.audio.playUiConfirm();
        this.showNotification(`Миссия выполнена! +$${m.rewardMoney.toLocaleString()} · +${m.rewardXp} XP`);
        if (this.missionIndex < this.missions.length - 1) {
          this.missionIndex += 1;
        }
      }
    } else {
      this.missionMarker.visible = false;
    }

    if (this.activeJob) {
      this.activeJob.timeLeft -= dt;
      if (Math.hypot(this.px - this.activeJob.targetX, this.pz - this.activeJob.targetZ) < 10) {
        this.money += this.activeJob.reward;
        this.addXp(450);
        this.audio.playUiConfirm();
        this.showNotification(`Контракт выполнен: +$${this.activeJob.reward}`);
        this.activeJob = null;
      } else if (this.activeJob.timeLeft <= 0) {
        this.showNotification('Время контракта истекло');
        this.activeJob = null;
      }
    }
  }

  private updateCamera(dt: number) {
    const anchorX = this.currentVehicle ? this.currentVehicle.x : this.px;
    const anchorY = this.currentVehicle ? this.currentVehicle.y : this.py;
    const anchorZ = this.currentVehicle ? this.currentVehicle.z : this.pz;

    if (this.cameraMode === 'first_person') {
      this.gordRig.root.visible = false;
      const eyeY = this.currentVehicle ? anchorY + (this.currentVehicle.kind === 'motorcycle' ? 1.38 : 1.24) : anchorY + 1.62;
      const lookYaw = this.currentVehicle ? this.currentVehicle.yaw : this.camYaw;
      _camPos.set(anchorX, eyeY, anchorZ);
      if (this.cameraShake > 0.005) {
        _camPos.x += (Math.random() - 0.5) * this.cameraShake * 0.65;
        _camPos.y += (Math.random() - 0.5) * this.cameraShake * 0.55;
        _camPos.z += (Math.random() - 0.5) * this.cameraShake * 0.65;
      }
      _camTarget.set(
        anchorX + Math.sin(lookYaw) * 12,
        eyeY - Math.sin(this.camPitch) * 8,
        anchorZ + Math.cos(lookYaw) * 12
      );
      this.camera.position.copy(_camPos);
      this.camera.lookAt(_camTarget);
      const spdFp = this.currentVehicle ? Math.abs(this.currentVehicle.speed) : Math.hypot(this.pvx, this.pvz);
      const fpFov = this.aiming ? 44 : 66 + Math.min(14, spdFp * 0.2);
      if (Math.abs(this.camera.fov - fpFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fpFov, 10, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    this.gordRig.root.visible = !this.currentVehicle || this.currentVehicle.kind === 'motorcycle';

    const baseDist = this.cameraMode === 'third_far' ? this.camDist * 1.48 : this.camDist;
    const targetDist = this.aiming ? 2.8 : this.currentVehicle ? (this.currentVehicle.kind === 'jet' ? 14 : baseDist + 2.2) : baseDist;
    const heightOffset = this.aiming ? 1.55 : this.currentVehicle ? 2.05 : 1.7;
    const shoulderRight = this.aiming ? 0.72 : 0;

    _camTarget.set(
      anchorX - Math.cos(this.camYaw) * shoulderRight,
      anchorY + heightOffset,
      anchorZ + Math.sin(this.camYaw) * shoulderRight
    );

    const horiz = Math.cos(this.camPitch) * targetDist;
    const vert = Math.sin(this.camPitch) * targetDist;
    _v1.set(
      _camTarget.x - Math.sin(this.camYaw) * horiz,
      Math.max(0.65, _camTarget.y + vert),
      _camTarget.z - Math.cos(this.camYaw) * horiz
    );

    // Smooth exponential camera damping + realistic impact shake
    _camPos.copy(this.camera.position);
    if (_camPos.lengthSq() < 0.01) _camPos.copy(_v1);
    _camPos.x = THREE.MathUtils.damp(_camPos.x, _v1.x, 12, dt);
    _camPos.y = THREE.MathUtils.damp(_camPos.y, _v1.y, 12, dt);
    _camPos.z = THREE.MathUtils.damp(_camPos.z, _v1.z, 12, dt);
    if (this.cameraShake > 0.005) {
      _camPos.x += (Math.random() - 0.5) * this.cameraShake;
      _camPos.y += (Math.random() - 0.5) * this.cameraShake * 0.8;
      _camPos.z += (Math.random() - 0.5) * this.cameraShake;
    }
    this.camera.position.copy(_camPos);
    this.camera.lookAt(_camTarget);

    // Subtle FOV widen at high speed
    const spd = this.currentVehicle ? Math.abs(this.currentVehicle.speed) : Math.hypot(this.pvx, this.pvz);
    const targetFov = this.aiming ? 44 : 58 + Math.min(18, spd * 0.25);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private getPromptText(): string | null {
    if (this.currentVehicle) return '[F] Выйти из транспорта';
    for (const v of this.vehicles) {
      if (Math.hypot(v.x - this.px, v.z - this.pz) < 5.2) {
        return `[F] Сесть в ${v.name}`;
      }
    }
    for (const poi of CITY_POIS) {
      if (Math.hypot(poi.x - this.px, poi.z - this.pz) < 6.5) {
        return `[E] ${poi.name}`;
      }
    }
    for (const npc of this.npcs) {
      if (npc.alive && npc.role === 'civilian' && Math.hypot(npc.x - this.px, npc.z - this.pz) < 4.0) {
        return `[E] Поговорить с прохожим`;
      }
    }
    return null;
  }

  private getDistrictName(): string {
    if (this.pz > 205) return 'Морской порт и ВПП';
    if (Math.abs(this.px) <= 85 && Math.abs(this.pz) <= 85) return 'Центральная площадь NEXORUM';
    if (this.pz < -85) return 'Финансовый центр';
    return 'Деловой и жилой квартал';
  }

  private emitHud() {
    const activeMission = this.missions[this.missionIndex] ?? null;
    const blips: HudSnapshot['minimapBlips'] = [];

    for (const poi of CITY_POIS) {
      blips.push({ x: poi.x, z: poi.z, color: poi.color, kind: 'poi' });
    }
    if (activeMission && !activeMission.completed) {
      blips.push({ x: activeMission.targetX, z: activeMission.targetZ, color: '#38bdf8', kind: 'mission' });
    }
    for (const v of this.vehicles) {
      if (v.isPolice && !v.driverOccupied && this.wantedStars > 0) {
        blips.push({
          x: v.x,
          z: v.z,
          color: Math.sin(this.elapsed * 14) > 0 ? '#3b82f6' : '#ef4444',
          kind: 'police',
        });
      } else if (!v.isTraffic && v !== this.currentVehicle) {
        blips.push({ x: v.x, z: v.z, color: '#f8fafc', kind: 'vehicle' });
      }
    }
    for (const n of this.npcs) {
      if (!n.alive) continue;
      if (n.role === 'police' && this.wantedStars > 0) {
        blips.push({ x: n.x, z: n.z, color: '#3b82f6', kind: 'police' });
      } else if (n.role === 'gangster' || n.role === 'boss') {
        blips.push({ x: n.x, z: n.z, color: '#ef4444', kind: 'enemy' });
      }
    }

    const cyberEffects: HudSnapshot['cyberActiveEffects'] = [];
    if (this.cyberStage >= 1) {
      cyberEffects.push({ id: 'arm', label: 'Титановая рука', detail: '+45% ближний бой', kind: 'passive' });
    }
    if (this.cyberStage >= 2) {
      cyberEffects.push({ id: 'eye', label: 'Нейро-визор', detail: '+25% урон стрельбы', kind: 'passive' });
    }
    if (this.cyberStage >= 3) {
      cyberEffects.push({ id: 'legs', label: 'Экзо-сервоприводы', detail: '+38% бег и прыжок', kind: 'passive' });
    }
    if (this.cyberStage >= 4) {
      cyberEffects.push({ id: 'core', label: 'Реактор NEXORUM', detail: '+2.5 HP/с регенерация', kind: 'passive' });
    }
    if (this.cyberOverdriveActive) {
      cyberEffects.push({ id: 'ov_fire', label: 'Импульс привода', detail: '+35% урон · +28% темп', kind: 'overdrive' });
      cyberEffects.push({ id: 'ov_shield', label: 'Нано-щит', detail: '+28% скорость · -35% урон', kind: 'overdrive' });
    }

    this.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      cyberEnergy: Math.round(this.cyberEnergy),
      maxCyberEnergy: this.maxCyberEnergy,
      money: this.money,
      xp: this.xp,
      xpNext: this.xpNext,
      level: this.level,
      wantedStars: this.wantedStars,
      cyberStage: this.cyberStage,
      cyberPercent: this.cyberStage * 25,
      cyberOverdriveActive: this.cyberOverdriveActive,
      cyberTransformBannerTimer: this.cyberTransformBannerTimer,
      cyberActiveEffects: cyberEffects,
      activeSlot: this.activeSlot,
      reloading: this.reloadTimer > 0,
      cameraMode: this.cameraMode,
      weapons: this.weapons.map((w) => ({ ...w })),
      inVehicle: Boolean(this.currentVehicle),
      vehicleName: this.currentVehicle?.name ?? '',
      vehicleKind: this.currentVehicle?.kind ?? null,
      speedKmh: this.currentVehicle ? Math.round(Math.abs(this.currentVehicle.speed) * 3.6) : Math.round(Math.hypot(this.pvx, this.pvz) * 3.6),
      altitudeM: this.currentVehicle ? Math.round(this.currentVehicle.y) : 0,
      vehicleHealth: this.currentVehicle ? Math.round((this.currentVehicle.health / this.currentVehicle.maxHealth) * 100) : 100,
      vehicleDamage: this.currentVehicle
        ? {
            front: Math.round(this.currentVehicle.damageZones.front * 100),
            rear: Math.round(this.currentVehicle.damageZones.rear * 100),
            left: Math.round(this.currentVehicle.damageZones.left * 100),
            right: Math.round(this.currentVehicle.damageZones.right * 100),
            overall: Math.round((1 - this.currentVehicle.health / this.currentVehicle.maxHealth) * 100),
          }
        : { front: 0, rear: 0, left: 0, right: 0, overall: 0 },
      playerX: this.px,
      playerZ: this.pz,
      playerYaw: this.pYaw,
      activeMission,
      missionIndex: this.missionIndex,
      totalMissions: this.missions.length,
      interactionPrompt: this.getPromptText(),
      activeDialogue: this.activeDialogue,
      activeJob: this.activeJob ? { ...this.activeJob } : null,
      minimapBlips: blips,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      graphicsQuality: this.graphicsQuality,
      districtName: this.getDistrictName(),
      notification: this.notification,
      damageFlash: this.damageFlash,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.audio.dispose();
    this.mats.dispose();
    this.bulletGeo.dispose();
    this.bulletMatPlayer.dispose();
    this.bulletMatEnemy.dispose();
    this.explosionGeo.dispose();
    this.bloodDropGeo.dispose();
    this.bloodPoolGeo.dispose();
    this.sparkGeo.dispose();
    this.shellGeo.dispose();
    this.smokeGeo.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
