import React from 'react';
import {
  Building2,
  Car,
  Check,
  CloudFog,
  CloudRain,
  Cpu,
  MapPin,
  Monitor,
  Moon,
  Shield,
  ShoppingBag,
  Snowflake,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ActiveMenu,
  CyberUpgrade,
  GraphicsQuality,
  HudSnapshot,
  MissionStep,
  PoiLocation,
  PropertyItem,
  TimeOfDay,
  VehicleCatalogItem,
  WeatherType,
} from '../game/types';
import { NexorumEngine } from '../game/engine';

interface GameModalsProps {
  menu: ActiveMenu;
  hud: HudSnapshot;
  engine: NexorumEngine | null;
  onClose: () => void;
  upgrades: CyberUpgrade[];
  properties: PropertyItem[];
  vehicles: VehicleCatalogItem[];
  missions: MissionStep[];
  pois: PoiLocation[];
  muted: boolean;
  onToggleMute: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  menu,
  hud,
  engine,
  onClose,
  upgrades,
  properties,
  vehicles,
  missions,
  pois,
  muted,
  onToggleMute,
}) => {
  if (!menu) return null;

  const titles: Record<Exclude<ActiveMenu, null>, string> = {
    map: 'Карта города NEXORUM',
    inventory: 'Инвентарь и экипировка Горда',
    missions: 'Сюжетные миссии и контракты',
    skills: 'Кибернетическая эволюция Горда',
    shop: 'Магазин снаряжения и контракты',
    home: 'Недвижимость и доход',
    vehicles: 'Автосалон и гараж NEXORUM',
    settings: 'Настройки мира и графики',
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl max-h-[86vh] flex flex-col rounded-xl border border-white/15 bg-[#0b101a] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f1624]">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-white">{titles[menu]}</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-num">
              Баланс: ${hud.money.toLocaleString('en-US')} · Уровень {hud.level} · Кибернетизация {hud.cyberPercent}%
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {menu === 'map' && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div className="md:col-span-3 relative aspect-square rounded-lg border border-white/15 bg-[#0a111c] overflow-hidden p-4">
                <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:32px_32px]" />
                {pois.map((poi) => {
                  const leftPct = ((poi.x + 250) / 500) * 100;
                  const topPct = ((poi.z + 250) / 560) * 100;
                  return (
                    <button
                      key={poi.id}
                      onClick={() => {
                        engine?.setWaypointTo(poi.x, poi.z);
                        onClose();
                      }}
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center cursor-pointer"
                      title={`Переместиться: ${poi.name}`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: poi.color }}
                      />
                      <span className="mt-1 px-1.5 py-0.5 rounded bg-black/85 text-[10px] text-white whitespace-nowrap">
                        {poi.label}
                      </span>
                    </button>
                  );
                })}
                {hud.activeMission && !hud.activeMission.completed && (
                  <div
                    style={{
                      left: `${((hud.activeMission.targetX + 250) / 500) * 100}%`,
                      top: `${((hud.activeMission.targetZ + 250) / 560) * 100}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-sky-500 text-[10px] font-bold text-slate-950"
                  >
                    Миссия
                  </div>
                )}
                <div
                  style={{
                    left: `${((hud.playerX + 250) / 500) * 100}%`,
                    top: `${((hud.playerZ + 250) / 560) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-sky-400 shadow"
                />
              </div>

              <div className="md:col-span-2 space-y-2.5">
                <p className="text-xs text-slate-400">Нажмите на любую локацию для быстрого перемещения по городу:</p>
                {pois.map((poi) => (
                  <button
                    key={poi.id}
                    onClick={() => {
                      engine?.setWaypointTo(poi.x, poi.z);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: poi.color }} />
                      <div>
                        <div className="text-sm font-medium text-white">{poi.name}</div>
                        <div className="text-[11px] text-slate-400">{poi.label}</div>
                      </div>
                    </div>
                    <span className="text-xs text-sky-400 whitespace-nowrap">В путь</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {menu === 'skills' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-sky-500/30 bg-sky-950/25 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Стадия трансформации Горда: {hud.cyberStage} / 4</div>
                  <div className="text-xs text-slate-300 mt-1">
                    Каждая установка визуально меняет модель Горда в 3D-мире (металлическая рука, глаз, ноги и полный экзо-корпус).
                  </div>
                </div>
                <div className="font-display text-2xl font-bold text-sky-400 font-mono-num">{hud.cyberPercent}%</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upgrades.map((u) => {
                  const canInstall = !u.installed && u.stageRequired === hud.cyberStage + 1 && hud.money >= u.cost;
                  return (
                    <div key={u.id} className="p-4 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-sky-400" />
                            {u.name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono-num">Этап {u.stageRequired}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">{u.description}</p>
                        <p className="text-xs text-emerald-400 mt-2 font-medium">{u.statBoost}</p>
                      </div>
                      <button
                        disabled={!canInstall}
                        onClick={() => engine?.installUpgrade(u.id)}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors ${
                          u.installed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : canInstall
                            ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                            : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {u.installed ? 'Установлено' : `Установить за $${u.cost.toLocaleString('en-US')}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {menu === 'vehicles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v) => {
                const canAfford = v.owned || hud.money >= v.price;
                return (
                  <div key={v.id} className="p-4 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-2">
                          <Car className="w-4 h-4 text-amber-400" />
                          {v.name}
                        </span>
                        <span className="text-xs text-slate-400">{v.category} · {v.topSpeedKmh} км/ч</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2">{v.description}</p>
                    </div>
                    <button
                      disabled={!canAfford}
                      onClick={() => {
                        if (engine?.buyOrSpawnVehicle(v.id)) onClose();
                      }}
                      className={`w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors ${
                        v.owned
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {v.owned ? 'Доставить рядом с Гордом' : `Купить за $${v.price.toLocaleString('en-US')}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {menu === 'home' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.map((p) => {
                const canBuy = !p.owned && hud.money >= p.price;
                return (
                  <div key={p.id} className="p-4 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-400" />
                          {p.name}
                        </span>
                        <span className="text-xs text-emerald-400 font-mono-num">+${p.incomePerMin}/мин</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.district}</div>
                      <p className="text-xs text-slate-300 mt-2">{p.description}</p>
                    </div>
                    {p.owned ? (
                      <button
                        onClick={() => {
                          engine?.teleportToProperty(p.id);
                          onClose();
                        }}
                        className="w-full py-2 px-4 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer"
                      >
                        Отправиться домой (снять розыск)
                      </button>
                    ) : (
                      <button
                        disabled={!canBuy}
                        onClick={() => engine?.buyProperty(p.id)}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-semibold ${
                          canBuy
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                            : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        Купить за ${p.price.toLocaleString('en-US')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {menu === 'shop' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  Снаряжение и боеприпасы
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'ammo' as const, title: 'Полный боекомплект', desc: 'Пополнить патроны NX-47 и P90', price: 400 },
                    { id: 'armor' as const, title: 'Бронежилет Т-4', desc: 'Восстановить броню до 100%', price: 800 },
                    { id: 'medkit' as const, title: 'Аптечка Травма-Про', desc: '+1 полевая аптечка в слот 5', price: 350 },
                    { id: 'grenade' as const, title: 'Осколочные гранаты', desc: '+2 гранаты в слот 3', price: 450 },
                  ].map((item) => (
                    <div key={item.id} className="p-3.5 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => engine?.buyShopItem(item.id)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        Купить · ${item.price}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Работа и быстрые контракты в городе
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'taxi' as const, title: 'VIP-такси по городу', reward: '$2 200', desc: 'Доставьте пассажира в западный квартал за 75 сек.' },
                    { id: 'courier' as const, title: 'Корпоративный курьер', reward: '$2 200', desc: 'Срочная доставка защищённого кейса в деловой центр.' },
                    { id: 'bounty' as const, title: 'Охранный патруль', reward: '$3 500', desc: 'Патрулирование южной точки по контракту NEXORUM.' },
                  ].map((job) => (
                    <div key={job.id} className="p-3.5 rounded-lg border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{job.title}</span>
                          <span className="text-xs font-mono-num text-emerald-400">{job.reward}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{job.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          engine?.startQuickJob(job.id);
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        Принять заказ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {menu === 'missions' && (
            <div className="space-y-3">
              {missions.map((m, idx) => {
                const isCurrent = idx === hud.missionIndex && !m.completed;
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-lg border ${
                      isCurrent
                        ? 'border-sky-400/50 bg-sky-950/25'
                        : m.completed
                        ? 'border-emerald-500/30 bg-emerald-950/15'
                        : 'border-white/10 bg-white/[0.02]'
                    } flex items-center justify-between gap-4`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {m.completed && <Check className="w-4 h-4 text-emerald-400" />}
                        <span className="font-semibold text-white">{m.title}</span>
                        {isCurrent && <span className="text-xs text-sky-400 font-medium">· Активна</span>}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{m.objective}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono-num text-emerald-400">+${m.rewardMoney.toLocaleString('en-US')}</div>
                      <div className="text-[11px] font-mono-num text-slate-400">+{m.rewardXp} XP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {menu === 'inventory' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {hud.weapons.map((w) => (
                <div
                  key={w.id}
                  onClick={() => {
                    engine?.selectWeaponSlot(w.slot);
                    onClose();
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    hud.activeSlot === w.slot
                      ? 'border-sky-400 bg-sky-950/30'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{w.name}</span>
                    <span className="text-xs font-mono-num text-slate-400">Слот {w.slot}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-2 font-mono-num">
                    Боезапас: {w.ammo} / {w.maxAmmo}
                  </div>
                  {w.damage > 0 && <div className="text-xs text-amber-400 mt-1 font-mono-num">Урон: {w.damage}</div>}
                </div>
              ))}
            </div>
          )}

          {menu === 'settings' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    Качество графики (WebGL / HDRP)
                  </h3>
                  <span className="text-xs font-mono-num text-sky-300 uppercase">{hud.graphicsQuality}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { id: 'low', label: 'Low', desc: 'Макс. FPS · без теней и Bloom' },
                    { id: 'medium', label: 'Medium', desc: 'Баланс · тени 1K, 100% скейл' },
                    { id: 'high', label: 'High', desc: 'AAA · тени 2K, HDR Bloom' },
                    { id: 'ultra', label: 'Ultra', desc: 'Максимум · тени 4K, 2x скейл' },
                  ] as Array<{ id: GraphicsQuality; label: string; desc: string }>).map((q) => (
                    <button
                      key={q.id}
                      onClick={() => engine?.setGraphicsQuality(q.id)}
                      className={`flex flex-col items-start p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                        hud.graphicsQuality === q.id
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm font-bold">{q.label}</span>
                      <span className="text-[11px] text-slate-400 mt-0.5 leading-tight">{q.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2.5">Время суток</h3>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: 'day', label: 'День', icon: Sun },
                    { id: 'sunset', label: 'Закат (GTA)', icon: Sunset },
                    { id: 'night', label: 'Ночь', icon: Moon },
                  ] as Array<{ id: TimeOfDay; label: string; icon: React.ComponentType<{ className?: string }> }>).map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => engine?.setTimeOfDay(t.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium cursor-pointer ${
                          hud.timeOfDay === t.id
                            ? 'border-sky-400 bg-sky-500/20 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2.5">Погода и атмосфера</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { id: 'clear', label: 'Ясно', icon: Sun },
                    { id: 'rain', label: 'Дождь (Мокрый асфальт)', icon: CloudRain },
                    { id: 'snow', label: 'Снег', icon: Snowflake },
                    { id: 'fog', label: 'Густой туман', icon: CloudFog },
                  ] as Array<{ id: WeatherType; label: string; icon: React.ComponentType<{ className?: string }> }>).map((w) => {
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.id}
                        onClick={() => engine?.setWeather(w.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-medium cursor-pointer ${
                          hud.weather === w.id
                            ? 'border-sky-400 bg-sky-500/20 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{w.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.03]">
                <div>
                  <div className="text-sm font-semibold text-white">Звуковые эффекты и двигатели</div>
                  <div className="text-xs text-slate-400">Процедурный синтезатор выстрелов, сирен и моторов</div>
                </div>
                <button
                  onClick={onToggleMute}
                  className="flex items-center gap-2 py-2 px-4 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  {muted ? 'Звук выкл.' : 'Звук вкл.'}
                </button>
              </div>

              <div className="p-4 rounded-lg border border-white/10 bg-white/[0.02] text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-white mb-1">Управление в NEXORUM:</div>
                <div>WASD — Движение / Вождение · Shift — Бег / Нитро · Space — Прыжок / Ручник / Взлёт</div>
                <div>F — Сесть / Выйти из транспорта · E — Взаимодействие · V — Смена камеры · X — Кибер-овердрайв</div>
                <div>ЛКМ — Стрельба / Удар · R — Перезарядка · Tab — Инвентарь · 1–5 — Оружие и аптечка</div>
                <div>M — Карта · J — Миссии · K — Кибер-улучшения · B — Магазин · T — Транспорт · Esc — Настройки</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
