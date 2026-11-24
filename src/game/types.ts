export type TimeOfDay = 'day' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog';
export type CameraMode = 'third_close' | 'third_far' | 'first_person';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type VehicleKind = 'supercar' | 'sedan' | 'suv' | 'police' | 'motorcycle' | 'helicopter' | 'jet';

export type WeaponId = 'rifle' | 'pistol' | 'grenade' | 'blade' | 'medkit';

export type CyberStage = 0 | 1 | 2 | 3 | 4;
// 0: 100% Human
// 1: Cybernetic Right Arm
// 2: + Cybernetic Eye & Cranial Interface
// 3: + Robotic Legs & Exoskeleton
// 4: Full Nexorum Cyber-Frame

export interface CyberUpgrade {
  id: string;
  name: string;
  stageRequired: CyberStage;
  cost: number;
  description: string;
  statBoost: string;
  installed: boolean;
}

export interface WeaponSlot {
  id: WeaponId;
  slot: number;
  name: string;
  ammo: number;
  maxAmmo: number;
  clip: number;
  clipSize: number;
  damage: number;
  fireRate: number;
  owned: boolean;
  price: number;
}

export interface PropertyItem {
  id: string;
  name: string;
  district: string;
  type: 'apartment' | 'penthouse' | 'garage' | 'business';
  price: number;
  incomePerMin: number;
  owned: boolean;
  x: number;
  z: number;
  description: string;
}

export interface VehicleCatalogItem {
  id: string;
  kind: VehicleKind;
  name: string;
  category: string;
  price: number;
  topSpeedKmh: number;
  color: string;
  owned: boolean;
  description: string;
}

export interface MissionStep {
  id: string;
  title: string;
  objective: string;
  targetX: number;
  targetZ: number;
  type: 'goto' | 'eliminate' | 'deliver' | 'arrest' | 'fly';
  rewardMoney: number;
  rewardXp: number;
  cyberUnlock?: CyberStage;
  completed: boolean;
}

export interface PoiLocation {
  id: string;
  name: string;
  kind: 'hospital' | 'police' | 'dealership' | 'shop' | 'clinic' | 'port' | 'safehouse' | 'job';
  x: number;
  z: number;
  label: string;
  color: string;
}

export interface VehicleDamageState {
  front: number;
  rear: number;
  left: number;
  right: number;
  overall: number;
}

export interface AmbientSpeechBubble {
  id: string;
  speaker: string;
  text: string;
  screenX: number;
  screenY: number;
  distance: number;
  tone: 'chat' | 'greet' | 'awe' | 'alert' | 'angry';
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  maxStamina: number;
  cyberEnergy: number;
  maxCyberEnergy: number;
  money: number;
  xp: number;
  xpNext: number;
  level: number;
  wantedStars: number;
  cyberStage: CyberStage;
  cyberPercent: number;
  cyberOverdriveActive: boolean;
  cyberTransformBannerTimer: number;
  cyberActiveEffects: Array<{ id: string; label: string; detail: string; kind: 'passive' | 'overdrive' }>;
  activeSlot: number;
  reloading: boolean;
  cameraMode: CameraMode;
  weapons: WeaponSlot[];
  inVehicle: boolean;
  vehicleName: string;
  vehicleKind: VehicleKind | null;
  speedKmh: number;
  altitudeM: number;
  vehicleHealth: number;
  vehicleDamage: VehicleDamageState;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  activeMission: MissionStep | null;
  missionIndex: number;
  totalMissions: number;
  interactionPrompt: string | null;
  activeDialogue: { speaker: string; role: string; text: string } | null;
  ambientBubbles: AmbientSpeechBubble[];
  activeJob: { title: string; targetX: number; targetZ: number; reward: number; timeLeft: number } | null;
  minimapBlips: Array<{ x: number; z: number; color: string; kind: 'police' | 'enemy' | 'vehicle' | 'poi' | 'mission' }>;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  graphicsQuality: GraphicsQuality;
  districtName: string;
  notification: string | null;
  damageFlash: number;
}

export type ActiveMenu =
  | null
  | 'map'
  | 'inventory'
  | 'missions'
  | 'skills'
  | 'shop'
  | 'home'
  | 'vehicles'
  | 'settings';
