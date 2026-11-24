import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Car,
  ChevronDown,
  ChevronUp,
  Cpu,
  Crosshair,
  Flame,
  Heart,
  Home,
  Map as MapIcon,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Sword,
  Zap,
} from 'lucide-react';
import { NexorumEngine } from './game/engine';
import { INITIAL_WEAPONS } from './game/data';
import { ActiveMenu, HudSnapshot } from './game/types';
import { Minimap } from './components/Minimap';
import { GameModals } from './components/GameModals';

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  armor: 60,
  maxArmor: 100,
  stamina: 100,
  maxStamina: 100,
  cyberEnergy: 100,
  maxCyberEnergy: 100,
  money: 15000,
  xp: 450,
  xpNext: 1000,
  level: 1,
  wantedStars: 0,
  cyberStage: 0,
  cyberPercent: 0,
  cyberOverdriveActive: false,
  cyberTransformBannerTimer: 0,
  cyberActiveEffects: [],
  activeSlot: 1,
  reloading: false,
  cameraMode: 'third_close',
  weapons: INITIAL_WEAPONS,
  inVehicle: false,
  vehicleName: '',
  vehicleKind: null,
  speedKmh: 0,
  altitudeM: 0,
  vehicleHealth: 100,
  vehicleDamage: { front: 0, rear: 0, left: 0, right: 0, overall: 0 },
  playerX: -4,
  playerZ: 12,
  playerYaw: Math.PI,
  activeMission: null,
  missionIndex: 0,
  totalMissions: 5,
  interactionPrompt: null,
  activeDialogue: null,
  activeJob: null,
  minimapBlips: [],
  timeOfDay: 'sunset',
  weather: 'clear',
  graphicsQuality: 'high',
  districtName: 'Центральная площадь NEXORUM',
  notification: null,
  damageFlash: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NexorumEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [started, setStarted] = useState(false);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const handleMenuShortcut = useCallback((key: string) => {
    const valid = key as Exclude<ActiveMenu, null>;
    setActiveMenu((prev) => (prev === valid ? null : valid));
  }, []);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new NexorumEngine(
      container,
      (snap) => setHud(snap),
      handleMenuShortcut
    );
    engineRef.current = engine;

    const canvas = container.querySelector('canvas');
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas?.addEventListener('webglcontextlost', onLost);
    canvas?.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas?.removeEventListener('webglcontextlost', onLost);
      canvas?.removeEventListener('webglcontextrestored', onRestored);
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleMenuShortcut]);

  // Pause simulation while title screen or modal is open
  useEffect(() => {
    engineRef.current?.setPaused(!started || activeMenu !== null);
  }, [started, activeMenu]);

  // Toggle HUD visibility with U
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyU' && started && !activeMenu) {
        setHudVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, activeMenu]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setAudioMuted(next);
  };

  const activeWeapon = hud.weapons[hud.activeSlot - 1];
  const lists = engineRef.current?.getStateLists();

  const navItems: Array<{ id: Exclude<ActiveMenu, null>; label: string; keyHint: string; icon: typeof MapIcon }> = [
    { id: 'map', label: 'Карта', keyHint: 'M', icon: MapIcon },
    { id: 'inventory', label: 'Инвентарь', keyHint: 'Tab', icon: Briefcase },
    { id: 'missions', label: 'Миссии', keyHint: 'J', icon: Shield },
    { id: 'skills', label: 'Навыки', keyHint: 'K', icon: Sparkles },
    { id: 'shop', label: 'Магазин', keyHint: 'B', icon: ShoppingBag },
    { id: 'home', label: 'Дом', keyHint: 'H', icon: Home },
    { id: 'vehicles', label: 'Транспорт', keyHint: 'T', icon: Car },
    { id: 'settings', label: 'Настройки', keyHint: 'Esc', icon: Settings },
  ];

  const slotIcons = [Crosshair, Crosshair, Flame, Sword, Heart];

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070a10]">
      {/* Isolated 3D WebGL Canvas Mount */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* Peripheral Blood / Crash Impact Vignette */}
      {started && hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 z-10 pointer-events-none shadow-[inset_0_0_140px_rgba(185,28,28,0.88)]"
          style={{ opacity: Math.min(0.85, hud.damageFlash) }}
        />
      )}

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a10]/95 text-center p-6">
          <div className="max-w-md space-y-3">
            <h2 className="font-display text-2xl font-bold text-white">Восстановление графического контекста</h2>
            <p className="text-sm text-slate-300">WebGL-контекст был временно приостановлен браузером.</p>
          </div>
        </div>
      )}

      {/* Title / Launch Screen */}
      {!started && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-start p-6 md:p-14 bg-[#070a10]">
          <img
            src="/assets/aistudio/image_f8ddf150.png"
            alt="NEXORUM City"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060911]/95 via-[#060911]/70 to-transparent" />
          <div className="relative z-10 max-w-xl space-y-5">
            <div className="text-xs font-medium tracking-widest uppercase text-sky-400">
              Открытый мир · Транспорт · Эволюция героя
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight text-white">
              NEXORUM
            </h1>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed">
              Исследуйте живой мегаполис в роли Горда: управляйте суперкарами, мотоциклами, вертолётами и истребителями,
              выполняйте сюжетные миссии, покупайте недвижимость и пройдите путь от человека до кибернетического совершенства.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setStarted(true)}
                className="px-7 py-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer shadow-lg"
              >
                Войти в город
              </button>
              <button
                onClick={() => {
                  setStarted(true);
                  setActiveMenu('settings');
                }}
                className="px-5 py-3.5 rounded-lg border border-white/20 bg-black/60 hover:bg-black/80 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Графика и управление
              </button>
            </div>
            <div className="text-xs text-slate-400 pt-1 leading-relaxed">
              WASD — движение · Shift — бег · Space — прыжок · F — транспорт · E — действие · V — камера · ЛКМ — стрельба · R — перезарядка · Tab — инвентарь
            </div>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {started && hudVisible && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          {/* Top-Left: Brand + Gord Profile + Compact Left Quick Menu */}
          <div className="absolute top-4 left-4 flex flex-col gap-2.5 pointer-events-auto">
            <div className="font-display text-2xl font-extrabold tracking-wider text-white drop-shadow">
              NEXORUM
            </div>

            <div className="w-[244px] rounded-lg border border-white/15 bg-[#090d16]/85 p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-md border border-sky-400/40 bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  <span className="font-display text-lg font-bold text-sky-300">Г</span>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Горд</span>
                    <span className="font-mono-num text-slate-300">Ур. {hud.level}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono-num">
                    Опыт: {hud.xp.toLocaleString('en-US')} / {hud.xpNext.toLocaleString('en-US')}
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 font-mono-num">
                    Деньги: ${hud.money.toLocaleString('en-US')}
                  </div>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Кибер-трансформация</span>
                  <span className="font-mono-num text-sky-400">{hud.cyberPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${hud.cyberPercent}%` }}
                  />
                </div>
              </div>

              {/* Active Cyber-Transformation Status Effects & Overdrive Trigger */}
              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                <button
                  onClick={() =>
                    hud.cyberStage > 0
                      ? engineRef.current?.toggleCyberOverdrive()
                      : setActiveMenu('skills')
                  }
                  className={`w-full flex items-center justify-between px-2 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                    hud.cyberOverdriveActive
                      ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                      : hud.cyberStage > 0
                      ? 'border-sky-400/35 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    {hud.cyberOverdriveActive
                      ? 'Овердрайв активен'
                      : hud.cyberStage > 0
                      ? 'Кибер-овердрайв'
                      : 'Импланты не установлены'}
                  </span>
                  <span className="font-mono-num text-[10px]">
                    {hud.cyberStage > 0 ? '[X]' : '[K]'}
                  </span>
                </button>

                {hud.cyberActiveEffects.length > 0 && (
                  <div className="space-y-1">
                    {hud.cyberActiveEffects.map((eff) => (
                      <div
                        key={eff.id}
                        className={`flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded border ${
                          eff.kind === 'overdrive'
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                            : 'border-white/10 bg-white/[0.03] text-slate-300'
                        }`}
                      >
                        <span className="font-medium truncate mr-1">{eff.label}</span>
                        <span className="font-mono-num text-sky-300 shrink-0">{eff.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible Quick Navigation Rail */}
            <div className="w-[244px] rounded-lg border border-white/12 bg-[#090d16]/80 overflow-hidden">
              <button
                onClick={() => setMenuCollapsed((c) => !c)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <span>Меню города</span>
                {menuCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              {!menuCollapsed && (
                <div className="border-t border-white/10 py-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveMenu(item.id)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {item.label}
                        </span>
                        <span className="text-[11px] font-mono-num text-slate-400">({item.keyHint})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top-Right: Wanted Stars + Weapon Ammo + Mission Box */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/12 bg-[#090d16]/80">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= hud.wantedStars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                  }`}
                />
              ))}
            </div>

            {activeWeapon && (
              <div className="px-3.5 py-2 rounded-lg border border-white/12 bg-[#090d16]/85 text-right">
                <div className="text-xs font-semibold text-white">{activeWeapon.name}</div>
                <div className="font-display text-lg font-bold text-slate-100 font-mono-num">
                  {hud.reloading
                    ? 'Перезарядка...'
                    : activeWeapon.id === 'blade'
                    ? 'Ближний бой'
                    : activeWeapon.id === 'medkit'
                    ? `Запас: ${activeWeapon.ammo}`
                    : `${activeWeapon.clip} / ${activeWeapon.ammo}`}
                </div>
              </div>
            )}

            <button
              onClick={() => engineRef.current?.cycleCameraMode()}
              className="px-3 py-1 rounded-md border border-white/10 bg-[#090d16]/80 hover:bg-[#131b2b]/90 text-[11px] text-slate-300 pointer-events-auto cursor-pointer transition-colors"
              title="Переключить камеру (V)"
            >
              Камера [V]:{' '}
              <span className="text-white font-medium">
                {hud.cameraMode === 'first_person'
                  ? '1-е лицо'
                  : hud.cameraMode === 'third_far'
                  ? '3-е лицо (далеко)'
                  : '3-е лицо'}
              </span>
            </button>

            {hud.activeMission && !hud.activeMission.completed && (
              <div className="w-[264px] rounded-lg border border-sky-400/35 bg-[#090d16]/85 p-3 shadow-lg">
                <div className="text-[11px] font-semibold text-sky-400">
                  {hud.activeMission.title}
                </div>
                <div className="text-xs text-slate-100 mt-1 leading-snug">
                  {hud.activeMission.objective}
                </div>
              </div>
            )}

            {hud.activeJob && (
              <div className="w-[264px] rounded-lg border border-amber-400/35 bg-[#090d16]/85 p-3 shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
                  <span>{hud.activeJob.title}</span>
                  <span className="font-mono-num">{Math.ceil(hud.activeJob.timeLeft)}с</span>
                </div>
                <div className="text-xs text-slate-200 mt-1">
                  Награда: +${hud.activeJob.reward.toLocaleString('en-US')}
                </div>
              </div>
            )}
          </div>

          {/* Center Subtle Crosshair when on foot */}
          {!hud.inVehicle && !activeMenu && (
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow" />
            </div>
          )}

          {/* Dedicated Cyber-Transformation Visor Overlay */}
          {(hud.cyberOverdriveActive || hud.cyberTransformBannerTimer > 0) && (
            <div className="fixed inset-0 pointer-events-none z-0">
              {hud.cyberOverdriveActive && (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle at center, transparent 62%, rgba(6, 182, 212, 0.22) 100%)',
                    }}
                  />
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400/80" />
                  <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400/80" />
                  <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400/80" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400/80" />
                </>
              )}

              <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[min(460px,92vw)] rounded-lg border border-cyan-400/50 bg-[#070e18]/90 px-4 py-2.5 shadow-2xl">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-display font-bold tracking-wide text-cyan-300 uppercase">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    {hud.cyberOverdriveActive
                      ? 'Кибер-трансформация · Овердрайв'
                      : `Кибер-трансформация · Стадия ${hud.cyberStage}/4`}
                  </div>
                  <span className="font-mono-num text-[11px] text-cyan-200">
                    Энергия {hud.cyberEnergy}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-150"
                    style={{ width: `${(hud.cyberEnergy / hud.maxCyberEnergy) * 100}%` }}
                  />
                </div>
                {hud.cyberActiveEffects.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {hud.cyberActiveEffects.map((eff) => (
                      <div
                        key={eff.id}
                        className={`px-2 py-1 rounded border text-[11px] flex items-center justify-between gap-1 ${
                          eff.kind === 'overdrive'
                            ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                            : 'border-sky-400/25 bg-sky-500/10 text-slate-200'
                        }`}
                      >
                        <span className="truncate font-medium">{eff.label}</span>
                        <span className="font-mono-num text-[10px] text-cyan-300 shrink-0">{eff.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contextual Notification & Dialogue Toast */}
          {hud.notification && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border border-sky-400/40 bg-[#090d16]/90 text-xs font-medium text-white shadow-lg">
              {hud.notification}
            </div>
          )}

          {hud.activeDialogue && (
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[min(520px,90vw)] rounded-lg border border-white/15 bg-[#090d16]/90 p-4 shadow-xl">
              <div className="text-xs font-semibold text-sky-400">
                {hud.activeDialogue.speaker} · {hud.activeDialogue.role}
              </div>
              <p className="text-sm text-slate-100 mt-1 leading-relaxed">{hud.activeDialogue.text}</p>
            </div>
          )}

          {/* Bottom-Left: Minimap + Health / Armor / Stamina / Cyber Energy */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2">
            <Minimap hud={hud} />
            <div className="w-[164px] grid grid-cols-2 gap-1.5 bg-[#090d16]/85 p-2 rounded-md border border-white/12">
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5 font-mono-num">HP {hud.health}</div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5 font-mono-num">Броня {hud.armor}</div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${(hud.armor / hud.maxArmor) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5 font-mono-num">Силы</div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5 font-mono-num">Энергия</div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${(hud.cyberEnergy / hud.maxCyberEnergy) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Center: Interaction Prompt + 5-Slot Weapon Dock */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
            {hud.interactionPrompt && (
              <div className="px-3.5 py-1.5 rounded-md border border-white/20 bg-[#090d16]/90 text-xs font-semibold text-white">
                {hud.interactionPrompt}
              </div>
            )}

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-white/15 bg-[#090d16]/85">
              {hud.weapons.map((w, idx) => {
                const Icon = slotIcons[idx] ?? Zap;
                const active = hud.activeSlot === w.slot;
                return (
                  <button
                    key={w.id}
                    onClick={() => engineRef.current?.selectWeaponSlot(w.slot)}
                    className={`relative w-12 h-11 rounded-md border flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
                    }`}
                    title={w.name}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-mono-num mt-0.5 text-slate-300">{w.slot}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom-Right: Matrix Awakens Speedometer + Real-Time Chassis Damage Schematic */}
          {hud.inVehicle && (
            <div className="absolute bottom-5 right-6 flex flex-col items-end gap-1.5 pointer-events-none select-none">
              <div className="flex items-end gap-3">
                {/* Real-Time 4-Zone Vehicle Body Deformation / Damage Telemetry */}
                {hud.vehicleKind !== 'helicopter' && hud.vehicleKind !== 'jet' && (
                  <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-white/12 bg-[#090d16]/85">
                    <svg viewBox="0 0 44 68" className="w-8 h-12 shrink-0">
                      {/* Front Bumper / Hood Zone */}
                      <path
                        d="M 10 14 L 14 5 L 30 5 L 34 14 Z"
                        fill={
                          hud.vehicleDamage.front > 60
                            ? '#ef4444'
                            : hud.vehicleDamage.front > 25
                            ? '#f59e0b'
                            : '#334155'
                        }
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                      />
                      {/* Left Side Zone */}
                      <rect
                        x="4"
                        y="16"
                        width="7"
                        height="34"
                        rx="2"
                        fill={
                          hud.vehicleDamage.left > 60
                            ? '#ef4444'
                            : hud.vehicleDamage.left > 25
                            ? '#f59e0b'
                            : '#334155'
                        }
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                      />
                      {/* Cabin Core */}
                      <rect
                        x="13"
                        y="16"
                        width="18"
                        height="34"
                        rx="3"
                        fill={hud.vehicleHealth < 40 ? '#7f1d1d' : '#1e293b'}
                        stroke="#64748b"
                        strokeWidth="1"
                      />
                      {/* Right Side Zone */}
                      <rect
                        x="33"
                        y="16"
                        width="7"
                        height="34"
                        rx="2"
                        fill={
                          hud.vehicleDamage.right > 60
                            ? '#ef4444'
                            : hud.vehicleDamage.right > 25
                            ? '#f59e0b'
                            : '#334155'
                        }
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                      />
                      {/* Rear Trunk / Bumper Zone */}
                      <path
                        d="M 10 52 L 34 52 L 32 63 L 12 63 Z"
                        fill={
                          hud.vehicleDamage.rear > 60
                            ? '#ef4444'
                            : hud.vehicleDamage.rear > 25
                            ? '#f59e0b'
                            : '#334155'
                        }
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                      />
                    </svg>
                    <div className="text-[10px] leading-tight space-y-1 min-w-[76px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Кузов</span>
                        <span
                          className={`font-mono-num font-bold ${
                            hud.vehicleHealth < 40
                              ? 'text-red-400'
                              : hud.vehicleHealth < 75
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {hud.vehicleHealth}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${
                            hud.vehicleHealth < 40
                              ? 'bg-red-500'
                              : hud.vehicleHealth < 75
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, hud.vehicleHealth))}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-slate-300">
                        {hud.vehicleHealth < 40
                          ? 'Крит. повреждения'
                          : hud.vehicleDamage.overall > 15
                          ? 'Деформация'
                          : 'Норма'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative w-36 h-28 flex items-center justify-center">
                  <svg viewBox="0 0 140 110" className="w-full h-full overflow-visible">
                    <path
                      d="M 22 92 A 54 54 0 1 1 118 92"
                      fill="none"
                      stroke="rgba(255,255,255,0.16)"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 22 92 A 54 54 0 1 1 118 92"
                      fill="none"
                      stroke={hud.speedKmh > 180 ? '#f59e0b' : '#ffffff'}
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeDasharray="244"
                      strokeDashoffset={244 - Math.min(1, hud.speedKmh / 280) * 244}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
                    <span className="font-display italic text-4xl font-extrabold tracking-tight text-white font-mono-num drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                      {String(hud.speedKmh).padStart(3, '0')}
                    </span>
                    <span className="text-[11px] font-semibold tracking-widest text-slate-300 mt-0.5">
                      КМ/Ч
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded border border-white/12 bg-[#090d16]/85 text-right text-xs">
                <span className="font-medium text-white">{hud.vehicleName}</span>
                {(hud.vehicleKind === 'helicopter' || hud.vehicleKind === 'jet') && (
                  <span className="ml-2 text-sky-400 font-mono-num">· {hud.altitudeM} м</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtle HUD Restore Button when HUD hidden via [U] */}
      {started && !hudVisible && (
        <button
          onClick={() => setHudVisible(true)}
          className="fixed bottom-4 right-4 z-20 px-3 py-1.5 rounded-md border border-white/15 bg-[#090d16]/80 text-xs text-slate-200 hover:text-white cursor-pointer"
        >
          Показать HUD (U)
        </button>
      )}

      {/* Game Modals */}
      {lists && (
        <GameModals
          menu={activeMenu}
          hud={hud}
          engine={engineRef.current}
          onClose={() => setActiveMenu(null)}
          upgrades={lists.upgrades}
          properties={lists.properties}
          vehicles={lists.vehicleCatalog}
          missions={lists.missions}
          pois={lists.pois}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
