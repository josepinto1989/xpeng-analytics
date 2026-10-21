import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Area as RechartsArea, AreaChart as RechartsAreaChart, Bar as RechartsBar, BarChart, CartesianGrid, Cell, ComposedChart as RechartsComposedChart, Legend, Line as RechartsLine, LineChart as RechartsLineChart, Pie as RechartsPie, PieChart, ReferenceLine, ResponsiveContainer, Scatter as RechartsScatter, ScatterChart, Tooltip, XAxis as RechartsXAxis, YAxis, ZAxis } from "recharts";
import "leaflet/dist/leaflet.css";
import { APP_VERSION } from "./version.js";
import { formatTelemetryCoverage } from "./data-coverage.js";
import { calculateDrivingPersonality } from "./driving-personality.js";
import { formatStoredBytes, IMPORT_REMINDER_DAY_OPTIONS, nextReminderAt } from "./persistent-history.js";
import { createTimestampLookup, nearestTimestampPoint, telemetryPointFromChart } from "./route-sync.js";
import { consumptionUnit, consumptionValue, distanceUnit, distanceValue, pressureUnitLabel, pressureValue, speedUnit, speedValue, temperatureUnit, temperatureValue } from "./units.js";

const Replay = React.lazy(() => import("./Replay.jsx"));
const MyCharts = React.lazy(() => import("./MyCharts.jsx"));
const navGroups = [
  { key: null, items: ["overview"] },
  { key: "driving", items: ["journeys", "driving", "activity", "trends", "replay"] },
  { key: "vehicle", items: ["charging", "battery", "tyres"] },
  { key: "tools", items: ["mycharts", "report"] },
  { key: "data", items: ["quality", "data"] },
];
const sections = navGroups.flatMap((group) => group.items);
const iconPaths = {
  overview: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z",
  journeys: "M5 19c4-8 10-3 14-14M14 5h5v5", charging: "M13 2 5 14h6l-1 8 8-12h-6l1-8Z",
  driving: "M4 16c2-5 5-8 8-8s6 3 8 8M8 16h8M12 8V4",
  battery: "M3 7h17v12H3V7Zm17 4h2v4h-2M6 10h7v6H6v-6Z", tyres: "M6 12a6 6 0 1 0 12 0 6 6 0 1 0-12 0Zm3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z", activity: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  trends: "M4 18 9 12l4 3 7-9M15 6h5v5",
  replay: "M5 5h14v14H5V5Zm5 4 6 3-6 3V9Z",
  mycharts: "M4 19V9m5 10V5m5 14v-7m5 7V3M3 21h18",
  report: "M6 2h9l4 4v16H6V2Zm9 0v5h4M9 11h7M9 15h7M9 19h5", quality: "m4 12 5 5L20 6", data: "M12 3v12m-5-5 5 5 5-5M5 20h14",
};
const C = { mint: "#20a983", teal: "#3ab5ae", cyan: "#63b7d4", amber: "#e3a62f", coral: "#e27b66", violet: "#8a82d5" };
const signalLabels = {
  speed_kmh: "speed", longitudinal_accel: "longitudinalAcceleration", lateral_accel: "lateralAcceleration", odometer_km: "odometer",
  steering_angle_deg: "steeringAngle", steering_speed_deg_s: "steeringSpeed", accelerator_pct: "acceleratorPosition", brake_status: "brakeSignal", gear_level: "gearPosition",
  front_motor_rpm: "frontMotorSpeed", rear_motor_rpm: "rearMotorSpeed", front_motor_torque_nm: "frontMotorTorque", rear_motor_torque_nm: "rearMotorTorque",
  front_rotor_temp_c: "frontRotorTemperature", rear_rotor_temp_c: "rearRotorTemperature", pack_voltage_v: "packVoltage", pack_current_a: "packCurrent",
  charge_power_kw: "chargingPower", soc_pct: "batterySoc", battery_temp_max_c: "maximumTemperature", battery_temp_min_c: "minimumTemperature",
  hottest_cell_index: "hottestCellPosition", coldest_cell_index: "coldestCellPosition", displayed_range_km: "displayedRange",
  driver_door_ajar: "driverDoor", passenger_door_ajar: "passengerDoor", rear_left_door_ajar: "rearLeftDoor", rear_right_door_ajar: "rearRightDoor",
  front_left_window_position: "frontLeftWindow", rear_left_window_position: "rearLeftWindow", front_right_window_position: "frontRightWindow", rear_right_window_position: "rearRightWindow",
  trunk_open_status: "bootStatus", tyre_pressure_fl_kpa: "frontLeftTyre", tyre_pressure_fr_kpa: "frontRightTyre", tyre_pressure_rl_kpa: "rearLeftTyre", tyre_pressure_rr_kpa: "rearRightTyre",
};
const phaseKeys = { runtime_load:"phaseRuntimeLoad", engine_init:"phaseEngineInit", archive_write:"phaseArchiveWrite", archive_import:"phaseArchiveImport", analytics_rebuild:"phaseAnalyticsRebuild", validation:"phaseValidation", history_read:"phaseHistoryRead", history_export:"phaseHistoryExport", history_export_complete:"phaseHistoryExportComplete", persistent_history_save:"phasePersistentHistorySave", persistent_history_saved:"phasePersistentHistorySaved", complete:"phaseComplete", reset:"phaseReset", native_ready:"phaseNativeReady", native_scan:"phaseNativeScan", native_parse:"phaseNativeParse", native_merge:"phaseNativeMerge", native_analytics:"phaseNativeAnalytics", native_snapshot:"phaseNativeSnapshot", gps_parse:"phaseGpsParse", gps_match:"phaseGpsMatch" };
const safe = (rows) => Array.isArray(rows) ? rows : [];
const newestFirst = (rows) => safe(rows).slice().sort((a, b) => String(b?.startedAtUtc || b?.date || "").localeCompare(String(a?.startedAtUtc || a?.date || "")));
const sum = (rows, field) => safe(rows).reduce((total, row) => total + (Number(row?.[field]) || 0), 0);
const maximum = (rows, field) => { const values = safe(rows).map((row)=>Number(row?.[field])).filter(Number.isFinite); return values.length ? Math.max(...values) : null; };
const median = (values) => { const rows = safe(values).map(Number).filter(Number.isFinite).sort((a,b)=>a-b); if (!rows.length) return null; const middle = Math.floor(rows.length / 2); return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2; };
const sampleTimeline = (rows, limit = 420) => {
  const source = safe(rows);
  if (source.length <= limit) return source;
  const sampled = [source[0]], slots = limit - 2, step = (source.length - 2) / slots;
  for (let index = 0; index < slots; index++) sampled.push(source[1 + Math.floor(index * step)]);
  sampled.push(source.at(-1));
  return sampled;
};
const sampleScatter = (rows, limit = 900) => {
  const source = safe(rows);
  if (source.length <= limit) return source;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let index = 1; index < source.length; index++) {
    const x = Number(source[index]?.lateralG), y = Number(source[index]?.longitudinalG);
    if (x < Number(source[minX]?.lateralG)) minX = index;
    if (x > Number(source[maxX]?.lateralG)) maxX = index;
    if (y < Number(source[minY]?.longitudinalG)) minY = index;
    if (y > Number(source[maxY]?.longitudinalG)) maxY = index;
  }
  const indexes = new Set([0, source.length - 1, minX, maxX, minY, maxY]);
  const slots = Math.max(1, limit - indexes.size), step = (source.length - 1) / Math.max(1, slots - 1);
  for (let index = 0; index < slots; index++) indexes.add(Math.round(index * step));
  return [...indexes].sort((a, b) => a - b).slice(0, limit).map((index) => source[index]);
};
const signalText = (field, t) => signalLabels[field] ? t(signalLabels[field]) : String(field || "").replaceAll("_", " ");
const numberFormatters = new Map(), dateFormatters = new Map(), timeFormatters = new Map(), secondTimeFormatters = new Map(), monthFormatters = new Map();
const num = (value, locale, digits = 1) => {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const key = `${locale}|${digits}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(locale, { maximumFractionDigits: digits }));
  return numberFormatters.get(key).format(Number(value));
};
const dateText = (value, locale) => {
  if (!value) return "—";
  if (!dateFormatters.has(locale)) dateFormatters.set(locale, new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }));
  return dateFormatters.get(locale).format(new Date(value));
};
const timeText = (value, locale) => {
  if (!value) return "—";
  if (!timeFormatters.has(locale)) timeFormatters.set(locale, new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }));
  return timeFormatters.get(locale).format(new Date(value));
};
const secondTimeText = (value, locale) => {
  if (!value) return "—";
  if (!secondTimeFormatters.has(locale)) secondTimeFormatters.set(locale, new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  return secondTimeFormatters.get(locale).format(new Date(value));
};
const journeyClockText = (startedAtUtc, elapsedMinutes, locale) => {
  const startedAt = new Date(startedAtUtc).getTime(), elapsed = Number(elapsedMinutes);
  return Number.isFinite(startedAt) && Number.isFinite(elapsed) ? timeText(startedAt + elapsed * 60_000, locale) : "—";
};
const localHour = (value) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.getHours() : null; };
const duration = (minutes, t) => minutes == null ? "—" : minutes >= 60 ? `${Math.floor(minutes / 60)} ${t("hourShort")} ${Math.round(minutes % 60)} ${t("minuteShort")}` : `${Math.round(minutes)} ${t("minuteShort")}`;
const monthText = (value, locale) => {
  if (!value) return "—";
  if (!monthFormatters.has(locale)) monthFormatters.set(locale, new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }));
  return monthFormatters.get(locale).format(new Date(`${value}-01T00:00:00Z`));
};

const telemetrySyncProps = (data) => safe(data).some((row) => Object.hasOwn(row, "elapsed")) ? { syncId: "journey-telemetry", syncMethod: "value" } : safe(data).some((row) => Object.hasOwn(row, "elapsedMinutes")) ? { syncId: "charging-telemetry", syncMethod: "value" } : {};
const JourneyTimelineContext = React.createContext(null);
function journeyChartHandlers(data, timeline, onMouseMove, onMouseLeave) {
  if (!timeline || !safe(data).some((row) => Object.hasOwn(row, "elapsed"))) return { onMouseMove, onMouseLeave };
  return {
    onMouseMove: (state, event) => { onMouseMove?.(state, event); timeline.update(telemetryPointFromChart(state, data)); },
    onMouseLeave: (state, event) => { onMouseLeave?.(state, event); timeline.update(null); },
  };
}
function Area(props) { return <RechartsArea {...props} isAnimationActive={false} />; }
function Bar(props) { return <RechartsBar {...props} isAnimationActive={false} />; }
function Line(props) { return <RechartsLine {...props} isAnimationActive={false} />; }
function Pie(props) { return <RechartsPie {...props} isAnimationActive={false} />; }
function Scatter(props) { return <RechartsScatter {...props} isAnimationActive={false} />; }
function XAxis({ dataKey, hide, tick, ...props }) {
  const isTelemetry = dataKey === "elapsed" || dataKey === "elapsedMinutes";
  const timeline = React.useContext(JourneyTimelineContext);
  const telemetryTickFormatter = dataKey === "elapsed" && timeline?.formatTime ? timeline.formatTime : (value) => `${Math.round(Number(value) || 0)}m`;
  return <RechartsXAxis
    {...props}
    dataKey={dataKey}
    hide={isTelemetry ? false : hide}
    tick={isTelemetry ? { fill: "var(--muted)", fontSize: 9 } : tick}
    tickFormatter={isTelemetry ? telemetryTickFormatter : props.tickFormatter}
    type={isTelemetry ? "number" : props.type}
    domain={isTelemetry ? ["dataMin", "dataMax"] : props.domain}
    tickCount={isTelemetry ? 6 : props.tickCount}
    minTickGap={isTelemetry ? 35 : props.minTickGap}
    axisLine={isTelemetry ? false : props.axisLine}
    tickLine={isTelemetry ? false : props.tickLine}
  />;
}
function LineChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsLineChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }
function AreaChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsAreaChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }
function ComposedChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsComposedChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }

function Icon({ name }) { return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name]} /></svg>; }
function inPeriod(date, period, maxDate, customRange) { const value = String(date || "").slice(0,10); if (!value) return false; if (period === "all") return true; if (period === "custom") { const first = customRange?.start && customRange?.end && customRange.start > customRange.end ? customRange.end : customRange?.start; const last = customRange?.start && customRange?.end && customRange.start > customRange.end ? customRange.start : customRange?.end; return (!first || value >= first) && (!last || value <= last); } const boundary = new Date(`${maxDate}T00:00:00Z`); boundary.setUTCDate(boundary.getUTCDate() - Number(period) + 1); return value >= boundary.toISOString().slice(0, 10) && value <= maxDate; }
function PeriodBar({ period, setPeriod, customRange, setCustomRange, minDate, maxDate, t }) { const update=(field)=>(event)=>{const value=event.currentTarget.value;setCustomRange((current)=>({...current,[field]:value}));}; return <div className="period-bar"><span>{t("period")}</span>{[["7",t("sevenDays")],["15",t("fifteenDays")],["30",t("thirtyDays")],["all",t("allData")],["custom",t("customPeriod")]].map(([value,label])=><button key={value} className={period===value?"is-active":""} onClick={()=>setPeriod(value)}>{label}</button>)}{period==="custom"?<div className="custom-period"><label>{t("startDate")}<input type="date" min={minDate} max={maxDate} value={customRange.start} onInput={update("start")} onChange={update("start")}/></label><span>—</span><label>{t("endDate")}<input type="date" min={minDate} max={maxDate} value={customRange.end} onInput={update("end")} onChange={update("end")}/></label></div>:null}</div>; }
function Tip({ locale, suffix = "" }) { const timeline=React.useContext(JourneyTimelineContext); return <Tooltip cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "4 4" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} labelFormatter={timeline?.formatTime || undefined} formatter={(value, name) => [`${num(value, locale, 2)}${suffix}`, name]} />; }
function ChargingTooltip({ active, label, series, locale, t, units }) {
  if (!active || label == null) return null;
  const point = safe(series).reduce((closest, row) => Math.abs(Number(row.elapsedMinutes) - Number(label)) < Math.abs(Number(closest?.elapsedMinutes ?? Infinity) - Number(label)) ? row : closest, null);
  if (!point) return null;
  const rows = [
    [t("power"), point.powerKw, "kW"], [t("peakPower"), point.powerPeakKw, "kW"], [t("soc"), point.socPct, "%"],
    [t("voltage"), point.voltageV, "V"], [t("current"), point.currentA, "A"],
    [t("batteryTemperature"), temperatureValue(point.batteryTempC, units.system), temperatureUnit(units.system)],
  ].filter(([, value]) => Number.isFinite(Number(value)));
  return <div className="telemetry-tooltip"><strong>{t("elapsedTime")}: {num(point.elapsedMinutes, locale, 1)} {t("minuteShort")}</strong>{rows.map(([name,value,unit])=><span key={name}><i/>{name}<b>{num(value,locale,2)} {unit}</b></span>)}</div>;
}
function ChargingTip({ series, locale, t, units }) { return <Tooltip cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "4 4" }} content={<ChargingTooltip series={series} locale={locale} t={t} units={units}/>} />; }
function Chart({ children, height = 285 }) { return <div className="chart-wrap" style={{ height }}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:800,height}}>{children}</ResponsiveContainer></div>; }
function Metric({ label, value, unit, note, tone = "", onActivate = null, ariaLabel = null }) {
  const activateFromKeyboard = (event) => {
    if (!onActivate || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onActivate();
  };
  return <article className={`dash-metric ${tone ? `tone-${tone}` : ""} ${onActivate ? "is-secret-trigger" : ""}`} onClick={onActivate || undefined} onKeyDown={activateFromKeyboard} role={onActivate ? "button" : undefined} tabIndex={onActivate ? 0 : undefined} aria-label={ariaLabel || undefined}><span>{label}</span><strong>{value}{unit ? <small>{unit}</small> : null}</strong>{note ? <em>{note}</em> : null}</article>;
}
function Panel({ title, subtitle, action, children }) { return <section className="dash-panel"><header><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</header>{children}</section>; }

const DRIVING_PERSONALITY_AVATARS = {
  smoothOperator: "smooth-operator.png",
  efficiencyHunter: "efficiency-hunter.png",
  regenerationMaster: "regeneration-master.png",
  highwayCruiser: "highway-cruiser.png",
  urbanNavigator: "urban-navigator.png",
  roadTripper: "road-tripper.png",
  dynamicDriver: "dynamic-driver.png",
  nightOwl: "night-owl.png",
  earlyBird: "early-bird.png",
  weekendExplorer: "weekend-explorer.png",
  onePedalArtist: "one-pedal-artist.png",
  allRounder: "all-rounder.png",
};

function drivingPersonalityAvatar(key) {
  const file = DRIVING_PERSONALITY_AVATARS[key] || DRIVING_PERSONALITY_AVATARS.allRounder;
  return `${import.meta.env.BASE_URL}assets/personalities/${file}`;
}

function DrivingPersonalityDialog({ personality, t, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const name = (key) => t(`drivingPersonality_${key}`), description = (key) => t(`drivingPersonality_${key}_description`);
  return <div className="driving-personality-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="driving-personality-card" role="dialog" aria-modal="true" aria-labelledby="driving-personality-title"><button className="driving-personality-close" type="button" onClick={onClose} aria-label={t("close")}>×</button><div className="driving-personality-mark" aria-hidden="true"><img src={drivingPersonalityAvatar(personality.primary.key)} alt="" /></div><span>{t("drivingPersonalityUnlocked")}</span><h2 id="driving-personality-title">{name(personality.primary.key)}</h2><p>{description(personality.primary.key)}</p>{personality.secondary.length ? <div className="driving-personality-traits"><small>{t("drivingPersonalitySecondary")}</small><div>{personality.secondary.map((trait) => <span key={trait.key}><img src={drivingPersonalityAvatar(trait.key)} alt="" aria-hidden="true" />{name(trait.key)}</span>)}</div></div> : null}<footer><strong>{t("drivingPersonalityPeriod")}</strong></footer></section></div>;
}
function DrivingPersonalityMetric({ personality, profileKey, t }) {
  const [open, setOpen] = useState(false), tap = useRef(0);
  const traitKey = [personality.primary.key, ...personality.secondary.map((trait) => trait.key)].join("|");
  useEffect(() => {
    const preload = () => traitKey.split("|").forEach((key) => { const image = new Image(); image.decoding = "async"; image.src = drivingPersonalityAvatar(key); });
    if (typeof window.requestIdleCallback === "function") { const id = window.requestIdleCallback(preload, { timeout: 1200 }); return () => window.cancelIdleCallback(id); }
    const id = window.setTimeout(preload, 200); return () => window.clearTimeout(id);
  }, [traitKey]);
  const unlock = () => { const now = Date.now(); if (now - tap.current <= 650) { tap.current = 0; setOpen(true); } else tap.current = now; };
  const value = profileKey ? t(`drivingProfile_${profileKey}`) : "—";
  return <><Metric tone={profileKey === "aggressive" ? "coral" : profileKey === "dynamic" ? "amber" : "mint"} label={t("estimatedDrivingProfile")} value={value} note={<>{t("softwareEstimate")}<small className="secret-tease">{t("drivingPersonalityTease")}</small></>} onActivate={unlock} ariaLabel={`${t("estimatedDrivingProfile")}: ${value}`}/>{open ? <DrivingPersonalityDialog personality={personality} t={t} onClose={() => setOpen(false)}/> : null}</>;
}
function ProgressiveChartGrid({ children, resetKey, className = "" }) {
  const items = React.Children.toArray(children), containerRef = useRef(null);
  const [inRange, setInRange] = useState(false), [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    setInRange(false); setVisibleCount(0);
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInRange(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInRange(true); observer.disconnect(); } }, { rootMargin: "280px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [resetKey]);
  useEffect(() => {
    if (!inRange || visibleCount >= items.length) return undefined;
    const showNext = () => setVisibleCount((count) => Math.min(items.length, count + 1));
    if (typeof window.requestIdleCallback === "function") { const id = window.requestIdleCallback(showNext, { timeout: 250 }); return () => window.cancelIdleCallback(id); }
    const id = window.setTimeout(showNext, 16); return () => window.clearTimeout(id);
  }, [inRange, items.length, visibleCount]);
  return <div ref={containerRef} className={`dashboard-grid two technical-grid progressive-chart-grid ${className}`.trim()}>{items.map((item, index) => index < visibleCount ? item : <div className="progressive-chart-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}</div>;
}
function Empty({ t }) { return <div className="section-empty"><strong>{t("noResults")}</strong><p>{t("changePeriod")}</p></div>; }
function ChartEmpty({ t, message }) { return <div className="chart-empty-state"><strong>{t("noChartData")}</strong><p>{message || t("noChartDataHelp")}</p></div>; }

function Overview({ data, locale, t, period, maxDate, customRange, openSection, openRecord, units }) {
  const daily = safe(data.daily).filter((row) => inPeriod(row.date, period, maxDate, customRange));
  const trips = safe(data.trips).filter((row) => inPeriod(row.date, period, maxDate, customRange));
  const journeys = newestFirst(safe(data.journeys).filter((row) => inPeriod(row.date, period, maxDate, customRange)));
  const charges = newestFirst(safe(data.charges).filter((row) => inPeriod(row.date, period, maxDate, customRange)));
  const distance = sum(daily, "distanceKm"), net = sum(daily, "netEnergyKwh"), wall = sum(charges, "wallEnergyKwh"), battery = sum(charges, "batteryEnergyKwh");
  const displayDistanceUnit=distanceUnit(units.system), displayConsumptionUnit=consumptionUnit(units.system);
  const chart = daily.slice(-30).map((row) => ({ ...row, distanceKm:distanceValue(row.distanceKm,units.system), label: row.date?.slice(5) }));
  const energyBalance = [
    { label: t("tractionEnergy"), energyKwh: sum(trips, "energyUsedKwh"), fill: C.teal },
    { label: t("regeneratedEnergy"), energyKwh: sum(trips, "regeneratedKwh"), fill: C.amber },
    { label: t("gridEnergy"), energyKwh: wall, fill: C.cyan },
    { label: t("batteryEnergy"), energyKwh: battery, fill: C.mint },
  ];
  return <><div className="metric-grid overview-metrics"><Metric tone="mint" label={t("distance")} value={num(distanceValue(distance,units.system), locale)} unit={` ${displayDistanceUnit}`} note={`${journeys.length} ${t("journeysLower")}`} /><Metric tone="cyan" label={t("averageConsumption")} value={num(consumptionValue(distance ? net / distance * 100 : null,units.system), locale)} unit={` ${displayConsumptionUnit}`} note={`${num(sum(daily, "regeneratedKwh"), locale)} kWh ${t("regeneratedLower")}`} /><Metric tone="violet" label={t("drivingTime")} value={num(sum(daily, "drivingHours"), locale)} unit={` ${t("hourShort")}`} note={`${trips.length} ${t("tripsLower")}`} /><Metric tone="amber" label={t("chargedEnergy")} value={num(battery, locale)} unit=" kWh" note={`${charges.length} ${t("chargesLower")}`} /><Metric tone="coral" label={t("chargeEfficiency")} value={num(wall ? battery / wall * 100 : null, locale)} unit="%" note={`${num(wall, locale)} kWh ${t("fromGrid")}`} /></div>
    <div className="dashboard-grid two"><Panel title={t("dailyDistance")} subtitle={t("lastDaysInPeriod")}><Chart><BarChart data={chart} margin={{ top: 18, right: 12, left: -16 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tip locale={locale} suffix={` ${displayDistanceUnit}`} /><Bar dataKey="distanceKm" name={t("distance")} fill={C.mint} radius={[5, 5, 0, 0]} maxBarSize={28} /></BarChart></Chart></Panel><Panel title={t("energyTrend")} subtitle={t("netVsRegenerated")}><Chart><ComposedChart data={chart} margin={{ top: 18, right: 12, left: -14 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tip locale={locale} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="netEnergyKwh" name={t("netEnergy")} stroke={C.teal} fill="rgba(58,181,174,.14)" /><Line type="monotone" dataKey="regeneratedKwh" name={t("regenerated")} stroke={C.amber} dot={false} strokeWidth={2} /></ComposedChart></Chart></Panel></div>
    <Panel title={t("totalEnergyBalance")} subtitle={t("totalEnergyBalanceHelp")}><Chart height={245}><BarChart data={energyBalance} layout="vertical" margin={{ top: 10, right: 24, left: 24 }}><CartesianGrid stroke="var(--grid)" horizontal={false}/><XAxis type="number" unit=" kWh" tick={{ fill: "var(--muted)", fontSize: 10 }}/><YAxis type="category" dataKey="label" width={145} tick={{ fill: "var(--muted)", fontSize: 10 }}/><Tip locale={locale} suffix=" kWh"/><Bar dataKey="energyKwh" name={t("energy")} radius={[0,5,5,0]}>{energyBalance.map((row)=><Cell key={row.label} fill={row.fill}/>)}</Bar></BarChart></Chart></Panel>
    <div className="dashboard-grid two"><Panel title={t("recentJourneys")} action={<button className="text-action" onClick={() => openSection("journeys")}>{t("viewAll")}</button>}><div className="compact-records">{journeys.slice(0,5).map((row) => <button type="button" className="compact-record-button" key={row.journeyId} onClick={() => openRecord("journeys", row.journeyId)} aria-label={`${t("openJourney")} ${dateText(row.startedAtUtc, locale)}`}><span><strong>{dateText(row.startedAtUtc, locale)}</strong><small>{timeText(row.startedAtUtc, locale)} · {duration(row.durationMinutes, t)}</small></span><span><strong>{num(distanceValue(row.distanceKm,units.system), locale)} {displayDistanceUnit}</strong><small>{num(consumptionValue(row.consumptionKwh100,units.system), locale)} {displayConsumptionUnit}</small></span></button>)}</div></Panel><Panel title={t("recentCharges")} action={<button className="text-action" onClick={() => openSection("charging")}>{t("viewAll")}</button>}><div className="compact-records">{charges.slice(0,5).map((row) => <button type="button" className="compact-record-button" key={row.chargeId} onClick={() => openRecord("charging", row.chargeId)} aria-label={`${t("openCharge")} ${dateText(row.startedAtUtc, locale)}`}><span><strong>{dateText(row.startedAtUtc, locale)}</strong><small>{row.chargeType} · {duration(row.durationMinutes, t)}</small></span><span><strong>{num(row.batteryEnergyKwh, locale)} kWh</strong><small>{num(row.socStartPct, locale, 0)} → {num(row.socEndPct, locale, 0)}%</small></span></button>)}</div></Panel></div></>;
}

function RouteMap({ gps, timeline, t, locale }) {
  const containerRef = useRef(null), statusRef = useRef(null);
  const mapRef = useRef(null), leafletRef = useRef(null), activeMarkerRef = useRef(null);
  const [tileError,setTileError]=useState(false);
  const routePoints=useMemo(()=>safe(gps?.segments).flatMap((segment)=>safe(segment)).filter((point)=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon)),[gps]);
  const routeLookup=useMemo(()=>createTimestampLookup(routePoints),[routePoints]);
  useEffect(() => {
    let disposed = false, map = null;
    const draw = async () => {
      const module = await import("leaflet");
      if (disposed || !containerRef.current) return;
      const L = module.default || module;
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current=map;leafletRef.current=L;
      const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      tiles.on("tileerror",()=>setTileError(true));tiles.on("load",()=>setTileError(false));tiles.addTo(map);
      const lines = safe(gps?.segments).map((segment) => safe(segment).map((point) => [point.lat, point.lon])).filter((segment) => segment.length > 1);
      const layers = lines.map((line) => L.polyline(line, { color: "#159a75", weight: 5, opacity: .9 }).addTo(map));
      const points = lines.flat();
      if (points.length) {
        L.circleMarker(points[0], { radius: 6, color: "#0d785c", fillColor: "#20a983", fillOpacity: 1 }).bindTooltip(t("routeStart")).addTo(map);
        L.circleMarker(points.at(-1), { radius: 6, color: "#b55340", fillColor: "#e27b66", fillOpacity: 1 }).bindTooltip(t("routeEnd")).addTo(map);
        const group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 17 });
      } else map.setView([0, 0], 2);
    };
    draw();
    return () => { disposed = true; activeMarkerRef.current=null; mapRef.current=null; leafletRef.current=null; map?.remove(); };
  }, [gps, t, locale]);
  useEffect(()=>{
    let frame=null,pending=null;
    const update=(telemetry)=>{
      pending=telemetry?.timestampUtc||null;
      if(frame!==null)return;
      frame=requestAnimationFrame(()=>{
        frame=null;
        const map=mapRef.current,L=leafletRef.current,activePoint=nearestTimestampPoint(routeLookup,pending),status=statusRef.current;
        if(!map||!L)return;
        if(!activePoint){activeMarkerRef.current?.remove();activeMarkerRef.current=null;if(status){status.textContent=t("mapChartHint");status.classList.remove("is-active");}return;}
        const position=[activePoint.lat,activePoint.lon],label=`${t("mapChartPosition")} · ${secondTimeText(activePoint.timestampUtc,locale)}`;
        if(!activeMarkerRef.current)activeMarkerRef.current=L.circleMarker(position,{radius:8,color:"#ffffff",weight:3,fillColor:"#8a82d5",fillOpacity:1,className:"route-live-marker"}).addTo(map).bindTooltip(label,{direction:"top",offset:[0,-8]});
        else activeMarkerRef.current.setLatLng(position).setTooltipContent(label);
        activeMarkerRef.current.bringToFront();
        if(status){status.textContent=t("mapChartPosition");status.classList.add("is-active");}
      });
    };
    timeline.update=update;
    return()=>{if(frame!==null)cancelAnimationFrame(frame);if(timeline.update===update)timeline.update=()=>{};};
  },[locale,routeLookup,t,timeline]);
  return <div className="route-map-wrap">
    <div className="route-map-toolbar"><div><strong>{t("routeMap")}</strong><small>{t("routeMapLocalTrace")}</small></div><span ref={statusRef} className="route-map-sync">{t("mapChartHint")}</span></div>
    <div ref={containerRef} className="route-map has-tiles" aria-label={t("routeMap")}/>
    <div className="route-map-meta"><span>{t("gpsSource")}: <strong>{gps.sourceName}</strong></span><span>{t("matchConfidence")}: <strong>{num(gps.confidenceScore,locale,0)}%</strong></span><span>{num(gps.points,locale,0)} {t("gpsPointsLower")}</span>{gps.trimMeters?<span>{t("trimmedRouteEnds")}: {num(gps.trimMeters,locale,0)} m</span>:null}</div>
    {tileError?<p className="route-map-privacy is-error">{t("mapTilesError")}</p>:null}
  </div>;
}

function JourneyDetail({ selected, trips, locale, t, units }) {
  const timeline=useRef({update:()=>{},formatTime:null}).current;
  timeline.formatTime=(elapsed)=>journeyClockText(selected.startedAtUtc,elapsed,locale);
  useEffect(()=>timeline.update(null),[selected.journeyId,timeline]);
  const segments = useMemo(() => {
    const tripById = new Map(safe(trips).map((trip) => [trip.tripId, trip]));
    return safe(selected.tripIds).map((id) => tripById.get(id)).filter(Boolean);
  }, [selected.tripIds, trips]);
  const series = useMemo(() => {
    const journeyStartedAt = new Date(selected.startedAtUtc).getTime();
    const source = segments.flatMap((trip, segment) => safe(trip.series).map((point) => ({ point, segment })));
    return sampleTimeline(source, 420).map(({ point, segment }) => {
      const timestamp = new Date(point.timestampUtc).getTime();
      const elapsed = Number.isFinite(timestamp) && Number.isFinite(journeyStartedAt) ? (timestamp - journeyStartedAt) / 60000 : segment * 1000 + Number(point.elapsedMinutes || 0);
      return { ...point, speedKmh:speedValue(point.speedKmh,units.system), speedPeakKmh:speedValue(point.speedPeakKmh,units.system), displayedRangeKm:distanceValue(point.displayedRangeKm,units.system), batteryTempC:temperatureValue(point.batteryTempC,units.system), tyreFrontLeftKpa:pressureValue(point.tyreFrontLeftKpa,units.pressure), tyreFrontRightKpa:pressureValue(point.tyreFrontRightKpa,units.pressure), tyreRearLeftKpa:pressureValue(point.tyreRearLeftKpa,units.pressure), tyreRearRightKpa:pressureValue(point.tyreRearRightKpa,units.pressure), elapsed: Math.max(0, Math.round(elapsed * 100) / 100) };
    });
  }, [segments, selected.startedAtUtc, units.pressure, units.system]);
  const maxOf = (field) => maximum(segments, field);
  const hasSeries = (fields) => series.some((row) => fields.some((field) => Number.isFinite(Number(row[field]))));
  return <JourneyTimelineContext.Provider value={timeline}><div className="detail-stack journey-detail-stack"><Panel title={`${dateText(selected.startedAtUtc, locale)} · ${timeText(selected.startedAtUtc, locale)}`} subtitle={`${duration(selected.durationMinutes, t)} · ${segments.length} ${t("segmentsLower")}`}><div className="metric-grid detail-metrics"><Metric label={t("distance")} value={num(distanceValue(selected.distanceKm,units.system), locale)} unit={` ${distanceUnit(units.system)}`} /><Metric label={t("consumption")} value={num(consumptionValue(selected.consumptionKwh100,units.system), locale)} unit={` ${consumptionUnit(units.system)}`} /><Metric label={t("netEnergy")} value={num(selected.netEnergyKwh, locale)} unit=" kWh" /><Metric label={t("regenerated")} value={num(selected.regeneratedKwh, locale)} unit=" kWh" note={`${num(selected.regenerationSharePct,locale)}% ${t("grossEnergy")}`} /><Metric label={t("maximumSpeed")} value={num(speedValue(selected.maxSpeedKmh,units.system), locale)} unit={` ${speedUnit(units.system)}`} /></div></Panel>
    {segments.some((row)=>row.peakDrivePowerKw!=null)?<Panel title={t("technicalHighlights")} subtitle={t("technicalHighlightsHelp")}><div className="metric-grid detail-metrics"><Metric label={t("peakDrivePower")} value={num(maxOf("peakDrivePowerKw"),locale)} unit=" kW"/><Metric label={t("peakRegeneration")} value={num(maxOf("peakRegenPowerKw"),locale)} unit=" kW"/><Metric label={t("maximumAcceleration")} value={num(maxOf("maxAccelerationG"),locale,2)} unit=" g"/><Metric label={t("maximumBraking")} value={num(maxOf("maxBrakingG"),locale,2)} unit=" g"/><Metric label={t("maximumCornering")} value={num(maxOf("maxLateralG"),locale,2)} unit=" g"/><Metric label={t("maximumSteeringAngle")} value={num(maxOf("maxSteeringAngleDeg"),locale,0)} unit="°"/><Metric label={t("rearMotorSpeed")} value={num(maxOf("maxRearMotorRpm"),locale,0)} unit=" rpm"/><Metric label={t("rearMotorTorque")} value={num(maxOf("maxRearTorqueNm"),locale,0)} unit=" Nm"/><Metric label={t("rearRotorTemperature")} value={num(temperatureValue(maxOf("maxRearRotorTempC"),units.system),locale)} unit={` ${temperatureUnit(units.system)}`}/><Metric label={t("tyrePressureRange")} value={`${num(pressureValue(Math.min(...segments.map((row)=>row.tyrePressureMinKpa).filter(Number.isFinite)),units.pressure),locale)}–${num(pressureValue(maxOf("tyrePressureMaxKpa"),units.pressure),locale)}`} unit={` ${pressureUnitLabel(units.pressure)}`}/></div></Panel>:null}
    {selected.gps?<Panel title={t("journeyRoute")} subtitle={t("journeyRouteHelp")}><RouteMap gps={selected.gps} timeline={timeline} t={t} locale={locale}/></Panel>:null}
    <ProgressiveChartGrid key={`primary-${selected.journeyId}`} resetKey={selected.journeyId}><Panel title={t("speedProfile")} subtitle={t("speedProfileHelp")}><Chart><LineChart data={series} margin={{ top: 15, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsed" hide /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tip locale={locale} suffix={` ${speedUnit(units.system)}`} /><Line type="monotone" dataKey="speedKmh" name={t("speed")} stroke={C.teal} dot={false} strokeWidth={2} /><Line type="monotone" dataKey="speedPeakKmh" name={t("peak")} stroke={C.cyan} dot={false} /></LineChart></Chart></Panel><Panel title={t("powerProfile")} subtitle={t("powerProfileHelp")}><Chart><AreaChart data={series} margin={{ top: 15, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsed" hide /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><ReferenceLine y={0} stroke="var(--muted)" /><Tip locale={locale} suffix=" kW"/><Area type="monotone" dataKey="powerKw" name={t("power")} stroke={C.amber} fill="rgba(227,166,47,.18)" /></AreaChart></Chart></Panel><Panel title={t("socAndRange")} subtitle={t("socAndRangeHelp")}><Chart><LineChart data={series} margin={{ top: 15, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsed" hide /><YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis yAxisId="b" orientation="right" tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" type="monotone" dataKey="socPct" name="SOC %" stroke={C.mint} dot={false} strokeWidth={2} /><Line yAxisId="b" type="monotone" dataKey="displayedRangeKm" name={`${t("displayedRange")} ${distanceUnit(units.system)}`} stroke={C.violet} dot={false} strokeWidth={2} /></LineChart></Chart></Panel><Panel title={t("temperatureProfile")} subtitle={t("temperatureProfileHelp")}><Chart><LineChart data={series} margin={{ top: 15, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsed" hide /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} suffix={` ${temperatureUnit(units.system)}`} /><Line type="monotone" dataKey="batteryTempC" name={t("batteryTemperature")} stroke={C.coral} dot={false} strokeWidth={2} /></LineChart></Chart></Panel></ProgressiveChartGrid>
    <ProgressiveChartGrid key={`secondary-${selected.journeyId}`} resetKey={selected.journeyId}>
      <Panel title={t("drivingForces")} subtitle={t("drivingForcesHelp")}>{hasSeries(["longitudinalG","lateralG"])?<Chart><LineChart data={series} margin={{top:15,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis unit=" g" tick={{fill:"var(--muted)",fontSize:10}}/><ReferenceLine y={0} stroke="var(--muted)"/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="longitudinalG" name={t("longitudinalAcceleration")} stroke={C.teal} dot={false}/><Line type="monotone" dataKey="lateralG" name={t("lateralAcceleration")} stroke={C.violet} dot={false}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("pedalProfile")} subtitle={t("pedalProfileHelp")}>{hasSeries(["acceleratorPct","acceleratorPeakPct","brakePct"])?<Chart><ComposedChart data={series} margin={{top:15,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis domain={[0,100]} unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Area dataKey="acceleratorPct" name={t("averageAccelerator")} stroke={C.cyan} fill="rgba(99,183,212,.16)"/><Line dataKey="acceleratorPeakPct" name={t("peakAccelerator")} stroke={C.teal} dot={false}/><Line dataKey="brakePct" name={t("brakeActive")} stroke={C.coral} dot={false}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("rearMotorProfile")} subtitle={t("rearMotorProfileHelp")}>{hasSeries(["rearMotorTorqueNm","rearMotorRpm"])?<Chart><LineChart data={series} margin={{top:15,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis yAxisId="torque" unit=" Nm" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="rpm" orientation="right" unit=" rpm" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line yAxisId="torque" dataKey="rearMotorTorqueNm" name={t("rearMotorTorque")} stroke={C.amber} dot={false}/><Line yAxisId="rpm" dataKey="rearMotorRpm" name={t("rearMotorSpeed")} stroke={C.teal} dot={false}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("journeyTyrePressure")} subtitle={t("journeyTyrePressureHelp")}>{hasSeries(["tyreFrontLeftKpa","tyreFrontRightKpa","tyreRearLeftKpa","tyreRearRightKpa"])?<Chart><LineChart data={series} margin={{top:15,right:12,left:4}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis width={48} domain={["auto","auto"]} tickFormatter={(value)=>num(value,locale,units.pressure==="bar"?2:1)} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureUnitLabel(units.pressure)}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="tyreFrontLeftKpa" name={t("frontLeftShort")} stroke={C.mint} dot={false}/><Line dataKey="tyreFrontRightKpa" name={t("frontRightShort")} stroke={C.cyan} dot={false}/><Line dataKey="tyreRearLeftKpa" name={t("rearLeftShort")} stroke={C.amber} dot={false}/><Line dataKey="tyreRearRightKpa" name={t("rearRightShort")} stroke={C.coral} dot={false}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </ProgressiveChartGrid>
    <Panel title={t("journeyStructure")} subtitle={t("journeyStructureHelp")}><div className="detail-table">{segments.map((row, index) => <div key={row.tripId}><span className="segment-number">{index + 1}</span><strong>{timeText(row.startedAtUtc, locale)}</strong><span>{num(distanceValue(row.distanceKm,units.system), locale)} {distanceUnit(units.system)}</span><span>{duration(row.durationMinutes, t)}</span><span>{num(consumptionValue(row.consumptionKwh100,units.system), locale)} {consumptionUnit(units.system)}</span><span>{num(row.socStartPct, locale, 0)} → {num(row.socEndPct, locale, 0)}%</span></div>)}</div></Panel></div></JourneyTimelineContext.Provider>;
}

const JourneyDetailSection = memo(JourneyDetail);

function Journeys({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units }) {
  const rows = useMemo(() => newestFirst(safe(data.journeys).filter((row) => inPeriod(row.date, period, maxDate, customRange))), [data.journeys, period, maxDate, customRange]);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) => `${row.date} ${row.distanceKm}`.toLowerCase().includes(query.toLowerCase())), [query, rows]);
  const selected = visible.find((row) => row.journeyId === selectedId) ?? visible[0];
  const deferredSelected = useDeferredValue(selected);
  if (!selected) return <Empty t={t} />;
  const detailSelected = deferredSelected ?? selected, detailPending = detailSelected.journeyId !== selected.journeyId;
  return <><div className="list-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchJourneys")} /><span>{visible.length} {t("journeysLower")}</span></div><div className="master-detail"><Panel title={t("journeyList")}><div className="record-list">{visible.map((row) => <button key={row.journeyId} className={`record-button ${row.journeyId === selected.journeyId ? "is-active" : ""}`} onClick={() => setSelectedId(row.journeyId)}><span><strong>{dateText(row.startedAtUtc, locale)} {row.gps?<i className="route-available" title={t("routeAvailable")} aria-label={t("routeAvailable")}>GPS</i>:null}</strong><small>{timeText(row.startedAtUtc, locale)} · {safe(row.tripIds).length} {t("segmentsLower")}</small></span><span><strong>{num(distanceValue(row.distanceKm,units.system), locale)} {distanceUnit(units.system)}</strong><small>{num(consumptionValue(row.consumptionKwh100,units.system), locale)} {consumptionUnit(units.system)}</small></span></button>)}</div></Panel><div className={`journey-detail-shell ${detailPending?"is-updating":""}`} aria-busy={detailPending}><JourneyDetailSection selected={detailSelected} trips={safe(data.trips)} locale={locale} t={t} units={units}/></div></div></>;
}

function Driving({ data, locale, t, period, maxDate, customRange }) {
  const model = useMemo(() => {
    const filter = (row) => inPeriod(row.date,period,maxDate,customRange);
    const trips=safe(data.trips).filter(filter), speed=safe(data.driving?.speed).filter(filter), pedal=safe(data.driving?.pedal).filter(filter), gg=safe(data.driving?.gg).filter(filter), events=safe(data.driving?.events).filter(filter);
    const aggregate=(rows)=>[...rows.reduce((map,row)=>map.set(row.band,(map.get(row.band)||0)+Number(row.seconds||0)),new Map())].map(([band,seconds])=>({band,minutes:seconds/60}));
    const speedRows=aggregate(speed), pedalRows=aggregate(pedal), drivingMinutes=speedRows.reduce((total,row)=>total+row.minutes,0), regenerated=sum(trips,"regeneratedKwh"), used=sum(trips,"energyUsedKwh"), fast=speedRows.filter((row)=>row.band.startsWith("120")||row.band.startsWith("150")).reduce((total,row)=>total+row.minutes,0);
    const pedalMinutes=pedalRows.reduce((total,row)=>total+row.minutes,0), highPedal=pedalRows.filter((row)=>row.band.startsWith("50")||row.band.startsWith("75")).reduce((total,row)=>total+row.minutes,0);
    const forceSamples=trips.flatMap((trip)=>safe(trip.series)).filter((row)=>Number(row.speedKmh)>=1&&Number.isFinite(Number(row.longitudinalG))&&Number.isFinite(Number(row.lateralG)));
    const dynamicSamples=forceSamples.filter((row)=>Math.max(Math.abs(Number(row.longitudinalG)),Math.abs(Number(row.lateralG)))>=.18).length;
    const profileInputs=[
      {available:pedalMinutes>0,value:highPedal/pedalMinutes,reference:.12,weight:35},
      {available:drivingMinutes>0,value:fast/drivingMinutes,reference:.08,weight:25},
      {available:forceSamples.length>0,value:dynamicSamples/forceSamples.length,reference:.15,weight:40},
    ].filter((row)=>row.available);
    const profileWeight=profileInputs.reduce((total,row)=>total+row.weight,0), profileScore=profileWeight?profileInputs.reduce((total,row)=>total+Math.min(1,row.value/row.reference)*row.weight,0)/profileWeight*100:null;
    const profileKey=profileScore==null?null:profileScore<25?"calm":profileScore<55?"normal":profileScore<75?"dynamic":"aggressive";
    return { trips, speedRows, pedalRows, gg:sampleScatter(gg), events:events.slice().sort((a,b)=>b.valueG-a.valueG), drivingMinutes, regenerated, used, fast, profileKey, personality:calculateDrivingPersonality({trips,speedRows,pedalRows,events,profileScore}) };
  }, [data.trips, data.driving?.speed, data.driving?.pedal, data.driving?.gg, data.driving?.events, period, maxDate, customRange]);
  const { trips, speedRows, pedalRows, gg, events, drivingMinutes, regenerated, used, fast, profileKey, personality } = model;
  const peak=(kind)=>maximum(events.filter((row)=>row.kind===kind),"valueG");
  if(!trips.length)return <Empty t={t}/>;
  return <><div className="metric-grid activity-metrics"><Metric tone="mint" label={t("regeneratedEnergy")} value={num(regenerated,locale)} unit=" kWh" note={`${num(used+regenerated?regenerated/(used+regenerated)*100:null,locale)}% ${t("grossEnergy")}`}/><Metric tone="cyan" label={t("movingTime")} value={duration(drivingMinutes,t)} note={`${trips.length} ${t("segmentsLower")}`}/><Metric tone="violet" label={t("maximumAcceleration")} value={num(peak("acceleration"),locale,2)} unit=" g"/><Metric tone="amber" label={t("maximumBraking")} value={num(peak("braking"),locale,2)} unit=" g"/><Metric tone="coral" label={t("maximumCornering")} value={num(peak("cornering"),locale,2)} unit=" g"/><Metric tone="violet" label={t("timeAbove120")} value={duration(fast,t)} note={`${num(drivingMinutes?fast/drivingMinutes*100:null,locale)}%`}/><DrivingPersonalityMetric personality={personality} profileKey={profileKey} t={t}/></div>
    <div className="method-note"><strong>{t("observationalMetrics")}</strong><p>{t("drivingDisclaimer")}</p></div>
    <div className="dashboard-grid two"><Panel title={t("speedDistribution")} subtitle={t("speedDistributionHelp")}><Chart><BarChart data={speedRows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="band" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${t("minuteShort")}`}/><Bar dataKey="minutes" fill={C.mint} radius={[4,4,0,0]}/></BarChart></Chart></Panel><Panel title={t("acceleratorUse")} subtitle={t("acceleratorUseHelp")}><Chart><BarChart data={pedalRows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="band" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${t("minuteShort")}`}/><Bar dataKey="minutes" fill={C.cyan} radius={[4,4,0,0]}/></BarChart></Chart></Panel><Panel title={t("ggDiagram")} subtitle={t("ggDiagramHelp")}><Chart><ScatterChart margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="lateralG" name={t("lateralAcceleration")} unit=" g" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="longitudinalG" name={t("longitudinalAcceleration")} unit=" g" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Scatter data={gg} fill={C.violet}/></ScatterChart></Chart></Panel><Panel title={t("dynamicEvents")} subtitle={t("dynamicEventsHelp")}><div className="compact-records">{events.slice(0,12).map((row,index)=><div key={`${row.timestampUtc}-${index}`}><span><strong>{t(`event_${row.kind}`)}</strong><small>{dateText(row.timestampUtc,locale)} · {timeText(row.timestampUtc,locale)}</small></span><span><strong>{num(row.valueG,locale,2)} g</strong><small>{num(row.speedKmh,locale)} km/h</small></span></div>)}</div></Panel></div></>;
}

function ChargeTechnicalSummary({ selected, locale, t, units }) {
  const rangeAdded = Number.isFinite(Number(selected.rangeStartKm)) && Number.isFinite(Number(selected.rangeEndKm)) ? Number(selected.rangeEndKm) - Number(selected.rangeStartKm) : null;
  return <Panel title={t("chargingTechnicalDetails")} subtitle={t("chargingTechnicalDetailsHelp")}><div className="metric-grid detail-metrics"><Metric label={t("voltageRange")} value={`${num(selected.voltageMinV,locale)}–${num(selected.voltageMaxV,locale)}`} unit=" V"/><Metric label={t("peakCurrent")} value={num(selected.peakCurrentA,locale)} unit=" A"/><Metric label={t("batteryTemperatureRange")} value={`${num(temperatureValue(selected.batteryTempStartC,units.system),locale)}–${num(temperatureValue(selected.batteryTempMaxC,units.system),locale)}`} unit={` ${temperatureUnit(units.system)}`}/><Metric label={t("displayedRangeAdded")} value={num(distanceValue(rangeAdded,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric label={t("cellTemperaturePositions")} value={`${num(selected.coldestCellIndex,locale,0)} / ${num(selected.hottestCellIndex,locale,0)}`} note={t("coldestHottest")}/><Metric label={t("odometer")} value={num(distanceValue(selected.odometerKm,units.system),locale,0)} unit={` ${distanceUnit(units.system)}`}/></div></Panel>;
}

function Charging({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units }) {
  const rows = newestFirst(safe(data.charges).filter((row) => inPeriod(row.date, period, maxDate, customRange))); const selected = rows.find((row) => row.chargeId === selectedId) ?? rows[0]; if (!selected) return <Empty t={t} />;
  const summary = rows.slice().reverse().map((row) => ({ ...row, label: row.date?.slice(5), acEnergyKwh: row.chargeType === "AC" ? row.batteryEnergyKwh : 0, dcEnergyKwh: row.chargeType === "DC" ? row.batteryEnergyKwh : 0 })), series = safe(selected.series), temperatureSeries=series.map((row)=>({...row,batteryTemperatureDisplay:temperatureValue(row.batteryTempC,units.system)}));
  const hourCounts=rows.reduce((map,row)=>{const hour=localHour(row.startedAtUtc);if(Number.isFinite(hour))map.set(hour,(map.get(hour)||0)+1);return map;},new Map()), common=[...hourCounts].sort((a,b)=>b[1]-a[1])[0], hourShare=common?common[1]/rows.length:0;
  const chargeTypes=["AC","DC"].map((type)=>{const sessions=rows.filter((row)=>row.chargeType===type);return {type,sessions:sessions.length,batteryEnergyKwh:sum(sessions,"batteryEnergyKwh"),wallEnergyKwh:sum(sessions,"wallEnergyKwh"),durationMinutes:sum(sessions,"durationMinutes")};});
  const totalTypedEnergy=sum(chargeTypes,"batteryEnergyKwh");
  const limitCounts=rows.filter((row)=>(row.socEndPct??100)<99&&((row.socEndPct??0)-(row.socStartPct??0))>=5).reduce((map,row)=>{const value=Math.round(row.socEndPct);map.set(value,(map.get(value)||0)+1);return map;},new Map()), recurring=[...limitCounts].filter(([,count])=>count>=3).sort((a,b)=>b[1]-a[1])[0], typicalGain=median(rows.map((row)=>(row.socEndPct??0)-(row.socStartPct??0)));
  return <><div className="metric-grid charging-metrics"><Metric tone="mint" label={t("chargedEnergy")} value={num(sum(rows, "batteryEnergyKwh"), locale)} unit=" kWh" note={`${rows.length} ${t("chargesLower")}`} /><Metric tone="cyan" label={t("gridEnergy")} value={num(sum(rows, "wallEnergyKwh"), locale)} unit=" kWh" /><Metric tone="amber" label={t("chargeEfficiency")} value={num(sum(rows, "wallEnergyKwh") ? sum(rows, "batteryEnergyKwh") / sum(rows, "wallEnergyKwh") * 100 : null, locale)} unit="%" /><Metric tone="violet" label={t("totalChargingTime")} value={duration(sum(rows,"durationMinutes"),t)} /><Metric tone="mint" label={t("maximumPower")} value={num(maximum(rows,"maxPowerKw"),locale)} unit=" kW" /><Metric tone="coral" label={t("losses")} value={num(sum(rows, "lossKwh"), locale)} unit=" kWh" note={t("totalEstimatedLosses")} /></div>
    <Panel title={t("chargingHabits")} subtitle={t("chargingHabitsHelp")}><div className="metric-grid detail-metrics"><Metric tone="mint" label={t("mostCommonHour")} value={common?`${String(common[0]).padStart(2,"0")}:00`:"—"} note={common?`${common[1]} ${t("ofLower")} ${rows.length} ${t("chargesLower")}`:null}/><Metric tone="cyan" label={t("possibleSchedule")} value={common&&common[1]>=3&&hourShare>=.35?`${String(common[0]).padStart(2,"0")}:00`:t("noStrongPattern")} note={`${num(hourShare*100,locale)}% ${t("ofSample")}`}/><Metric tone="amber" label={t("recurringLimit")} value={recurring?`${recurring[0]}%`:t("noStrongPattern")} note={recurring?`${recurring[1]} ${t("sessionsLower")}`:t("minimumThreeSessions")}/><Metric tone="violet" label={t("typicalSocGain")} value={num(typicalGain,locale)} unit=" pp" note={`${rows.length} ${t("sessionsLower")}`}/></div></Panel>
    <Panel title={t("chargingByType")} subtitle={t("chargingByTypeHelp")}><div className="charging-type-layout"><div className="metric-grid charge-type-metrics">{chargeTypes.map((row)=><Metric key={row.type} tone={row.type==="AC"?"cyan":"violet"} label={t(`chargeType_${row.type}`)} value={num(row.batteryEnergyKwh,locale)} unit=" kWh" note={`${row.sessions} ${t("sessionsLower")} · ${num(row.wallEnergyKwh,locale)} kWh ${t("fromGrid")}`}/>)}</div>{totalTypedEnergy>0?<Chart height={230}><PieChart><Pie data={chargeTypes} dataKey="batteryEnergyKwh" nameKey="type" innerRadius={52} outerRadius={82} paddingAngle={3}>{chargeTypes.map((row)=><Cell key={row.type} fill={row.type==="AC"?C.cyan:C.violet}/>)}</Pie><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/></PieChart></Chart>:<ChartEmpty t={t}/>}</div></Panel>
    <div className="dashboard-grid two"><Panel title={t("energyByCharge")} subtitle={t("energyByChargeHelp")}><Chart><BarChart data={summary} margin={{ top: 15, right: 10, left: -8 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} suffix=" kWh" /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar stackId="energy" dataKey="acEnergyKwh" name="AC" fill={C.cyan} /><Bar stackId="energy" dataKey="dcEnergyKwh" name="DC" fill={C.violet} /><Bar stackId="energy" dataKey="lossKwh" name={t("losses")} fill={C.coral} radius={[4,4,0,0]} /></BarChart></Chart></Panel><Panel title={t("efficiencyTrend")}><Chart><LineChart data={summary} margin={{ top: 15, right: 10, left: -14 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis domain={[0,100]} tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} suffix="%" /><Line dataKey="efficiencyPct" name={t("efficiency")} stroke={C.amber} dot={{ r: 3 }} strokeWidth={2} /></LineChart></Chart></Panel></div>
    <div className="master-detail"><Panel title={t("chargeList")}><div className="record-list">{rows.map((row) => <button key={row.chargeId} className={`record-button ${row.chargeId === selected.chargeId ? "is-active" : ""}`} onClick={() => setSelectedId(row.chargeId)}><span><strong>{dateText(row.startedAtUtc, locale)}</strong><small>{timeText(row.startedAtUtc, locale)} · {row.chargeType}</small></span><span><strong>{num(row.batteryEnergyKwh, locale)} kWh</strong><small>{num(row.socStartPct, locale, 0)} → {num(row.socEndPct, locale, 0)}%</small></span></button>)}</div></Panel><div className="detail-stack"><Panel title={`${dateText(selected.startedAtUtc, locale)} · ${timeText(selected.startedAtUtc, locale)}`} subtitle={`${selected.chargeType} · ${duration(selected.durationMinutes, t)}`}><div className="metric-grid detail-metrics"><Metric label={t("batteryEnergy")} value={num(selected.batteryEnergyKwh, locale)} unit=" kWh" /><Metric label={t("gridEnergy")} value={num(selected.wallEnergyKwh, locale)} unit=" kWh" /><Metric label={t("efficiency")} value={num(selected.efficiencyPct, locale)} unit="%" /><Metric label={t("maximumPower")} value={num(selected.maxPowerKw, locale)} unit=" kW" /><Metric label={t("losses")} value={num(selected.lossKwh, locale)} unit=" kWh" /></div></Panel><ChargeTechnicalSummary selected={selected} locale={locale} t={t} units={units}/><div className="dashboard-grid two technical-grid"><Panel title={t("chargeCurve")} subtitle={t("powerAndSoc")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis yAxisId="b" orientation="right" domain={[0,100]} tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="powerKw" name={t("powerKw")} stroke={C.teal} dot={false} strokeWidth={2} /><Line yAxisId="b" dataKey="socPct" name={t("soc")} stroke={C.amber} dot={false} strokeWidth={2} /></LineChart></Chart></Panel><Panel title={t("voltageCurrent")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" hide /><YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis yAxisId="b" orientation="right" tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="voltageV" name={t("voltage")} stroke={C.violet} dot={false} /><Line yAxisId="b" dataKey="currentA" name={t("current")} stroke={C.cyan} dot={false} /></LineChart></Chart></Panel><Panel title={t("temperatureProfile")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Line dataKey="batteryTempC" name={t("batteryTemperature")} stroke={C.coral} dot={false} strokeWidth={2} /></LineChart></Chart></Panel><Panel title={t("powerPeakProfile")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Line dataKey="powerPeakKw" name={t("peakPower")} stroke={C.amber} dot={false} strokeWidth={2} /></LineChart></Chart></Panel></div></div></div></>;
}

function Battery({ data, locale, t, period, maxDate, customRange, units }) {
  const battery = data.battery || {};
  const daily = safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const charges = safe(data.charges).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const history = safe(battery.history).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const parking = safe(battery.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange));
  const capacity = median(history.map((row)=>row.capacityKwh));
  const distance = sum(daily,"distanceKm"), consumption = distance ? sum(daily,"netEnergyKwh") / distance * 100 : null;
  const range100 = capacity && consumption ? capacity / consumption * 100 : null, range70 = range100 == null ? null : range100 * .7;
  const observedSeconds = sum(parking,"observedSeconds"), parkedEnergy = sum(parking,"energyKwh");
  const parkedWatts = observedSeconds ? parkedEnergy / (observedSeconds / 3600) * 1000 : null;
  const longParking = parking.filter((row)=>Number(row.durationHours)>=6 && Number.isFinite(Number(row.socLossPerDay)));
  const parkedLoss = median(longParking.map((row)=>row.socLossPerDay));
  const parkedLossHour = parkedLoss == null ? null : parkedLoss / 24;
  const parkedRangeLoss = capacity && consumption && parkedLoss != null ? capacity * parkedLoss / consumption : null;
  const temp = charges.filter((row)=>row.batteryTempMaxC!=null && row.efficiencyPct!=null).map((row)=>({temperature:temperatureValue(row.batteryTempMaxC,units.system),efficiency:row.efficiencyPct}));
  const parkedPowerChart = parking.filter((row)=>Number.isFinite(Number(row.averageWatts))).slice(0,40).reverse();
  const parkedLossChart = longParking.slice(0,40).reverse();
  const dailyByDate = new Map(daily.map((row)=>[row.date,row]));
  const batteryDaily=safe(battery.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>{const activity=dailyByDate.get(row.date), dailyConsumption=activity?.distanceKm>0 ? Number(activity.netEnergyKwh)/Number(activity.distanceKm)*100 : null; return {...row,label:row.date?.slice(5),realRangeKm:capacity&&dailyConsumption>0?capacity/dailyConsumption*100:null};});
  const rangeSamples=safe(battery.rangeSamples).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const tripTemperatureConsumption=safe(data.trips).filter((row)=>inPeriod(row.date,period,maxDate,customRange)&&Number(row.distanceKm)>=5&&Number.isFinite(Number(row.batteryTempMaxC))&&Number.isFinite(Number(row.consumptionKwh100))).map((row)=>({temperature:temperatureValue(row.batteryTempMaxC,units.system),consumption:consumptionValue(row.consumptionKwh100,units.system),distance:distanceValue(row.distanceKm,units.system),date:row.date}));
  const xpengRange=median(rangeSamples.map((row)=>row.impliedFullRangeKm));
  return <>
    <div className="metric-grid battery-metrics"><Metric tone="mint" label={t("realRange100")} value={num(distanceValue(range100,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${num(consumptionValue(consumption,units.system),locale)} ${consumptionUnit(units.system)} ${t("inPeriodLower")}`} /><Metric tone="violet" label={t("range80to10")} value={num(distanceValue(range70,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={t("usableWindow70")} /><Metric tone="cyan" label={t("xpengPredictedRange100")} value={num(distanceValue(xpengRange,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${rangeSamples.length} ${t("eligibleSamples")}`}/><Metric tone="mint" label={t("estimatedCapacity")} value={num(capacity,locale)} unit=" kWh" note={`${history.length} ${t("qualifiedChargesLower")}`} /><Metric tone="amber" label={t("relativeSoh")} value={num(history.at(-1)?.relativeSohPct,locale)} unit="%" note={t("notBmsReading")} /><Metric tone="cyan" label={t("parkedObservedDraw")} value={num(parkedWatts,locale)} unit=" W" note={`${num(parkedEnergy,locale)} kWh ${t("measuredWhileParked")}`} /><Metric tone="coral" label={t("parkedLossPerDay")} value={num(parkedLoss,locale,2)} unit={`%/${t("dayShort")}`} note={`${num(parkedLossHour,locale,2)}%/h · ${num(distanceValue(parkedRangeLoss,units.system),locale)} ${distanceUnit(units.system)}/${t("dayShort")}`} /></div>
    <div className="method-note"><strong>{t("calculatedMetrics")}</strong><p>{t("calculatedMetricsHelp")}</p></div>
    <div className="dashboard-grid two">
      <Panel title={t("socBand")} subtitle={t("socBandHelp")}>{batteryDaily.length?<Chart><AreaChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis domain={[0,100]} unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Area dataKey="socMaxPct" name={t("maximumSoc")} stroke={C.mint} fill="rgba(32,169,131,.20)"/><Area dataKey="socMinPct" name={t("minimumSoc")} stroke={C.amber} fill="var(--panel)"/></AreaChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("thermalSpread")} subtitle={t("thermalSpreadHelp")}>{batteryDaily.length?<Chart><ComposedChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" °C" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="batteryTempMaxC" name={t("maximumTemperature")} stroke={C.coral} dot={false}/><Line dataKey="batteryTempMinC" name={t("minimumTemperature")} stroke={C.cyan} dot={false}/><Bar dataKey="temperatureSpreadMaxC" name={t("spread")} fill={C.amber}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("rangeComparison")} subtitle={t("rangeComparisonHelp")}>{batteryDaily.some((row)=>row.impliedRangeMedianKm!=null||row.realRangeKm!=null)?<Chart><LineChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" km" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="impliedRangeMedianKm" name={t("xpengPredictedRange100")} stroke={C.violet} dot={{r:2}} strokeWidth={2}/><Line dataKey="realRangeKm" name={t("realRange100")} stroke={C.mint} dot={{r:2}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("temperatureConsumption")} subtitle={t("temperatureConsumptionHelp")}>{tripTemperatureConsumption.length?<Chart><ScatterChart margin={{top:12,right:18,left:-8}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="temperature" name={t("maximumTemperature")} unit="°C" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="consumption" name={t("consumption")} unit=" kWh/100" tick={{fill:"var(--muted)",fontSize:10}}/><ZAxis type="number" dataKey="distance" name={t("distance")} unit=" km" range={[45,220]}/><Tip locale={locale}/><Scatter data={tripTemperatureConsumption} fill={C.coral}/></ScatterChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </div>
    <div className="dashboard-grid two"><Panel title={t("capacityAndSoh")} subtitle={t("notBmsSoh")}>{history.length?<Chart height={320}><LineChart data={history} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line yAxisId="a" dataKey="rollingCapacityKwh" name={t("rollingCapacity")} stroke={C.mint} dot={{r:3}} strokeWidth={2}/><Line yAxisId="b" dataKey="relativeSohPct" name={t("relativeSoh")} stroke={C.amber} dot={false} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("thermalEfficiency")} subtitle={t("thermalEfficiencyHelp")}>{temp.length?<Chart height={320}><ScatterChart margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="temperature" name={t("temperature")} unit="°C" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="efficiency" name={t("efficiency")} unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Scatter data={temp} fill={C.cyan}>{temp.map((_,index)=><Cell key={index} fill={index%2?C.cyan:C.teal}/>)}</Scatter></ScatterChart></Chart>:<ChartEmpty t={t}/>}</Panel></div>
    <div className="dashboard-grid two"><Panel title={t("energyBalance")} subtitle={t("energyBalanceHelp")}>{charges.length?<Chart><BarChart data={charges.slice(-20)} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar stackId="e" dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/><Bar stackId="e" dataKey="lossKwh" name={t("losses")} fill={C.coral}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("parkedPower")} subtitle={t("parkedPowerHelp")}>{parkedPowerChart.length?<Chart><BarChart data={parkedPowerChart} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="startedAtUtc" tickFormatter={(v)=>v?.slice(5,10)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" W" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" W"/><Bar dataKey="averageWatts" name={t("parkedPower")} fill={C.cyan} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel></div>
    <Panel title={t("parkedBatteryLoss")} subtitle={`${longParking.length} ${t("longIntervals")} · ${num(sum(longParking,"durationHours"),locale)} h ${t("analysedLower")}`}>{parkedLossChart.length?<Chart><BarChart data={parkedLossChart} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="startedAtUtc" tickFormatter={(v)=>v?.slice(5,10)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix="%"/><ReferenceLine y={parkedLoss} stroke={C.amber} strokeDasharray="5 4" label={{value:t("median"),fill:"var(--muted)",fontSize:10}}/><Bar dataKey="socLossPerDay" name={t("socLossPerDay")} fill={C.amber} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t} message={t("noParkingChartData")}/>}</Panel>
    <Panel title={t("parkingIntervals")} subtitle={t("parkingTableHelp")}><div className="data-table parking-table detailed"><div className="table-head"><span>{t("date")}</span><span>{t("duration")}</span><span>{t("socChange")}</span><span>{t("socLoss")}</span><span>{t("socLossPerHour")}</span><span>{t("socLossPerDay")}</span><span>{t("energy")}</span><span>{t("averagePower")}</span><span>{t("coverage")}</span><span>{t("confidence")}</span></div>{parking.slice(0,40).map((row)=><div key={row.stopId}><span>{dateText(row.startedAtUtc,locale)}</span><span>{num(row.durationHours,locale)} h</span><span>{num(row.socStartPct,locale,0)} → {num(row.socEndPct,locale,0)}%</span><span>{num(row.socLossPct,locale,1)}%</span><span>{num(row.socLossPerHour,locale,2)}%</span><span>{num(row.socLossPerDay,locale,2)}%</span><span>{num(row.energyKwh,locale,2)} kWh</span><span>{num(row.averageWatts,locale,0)} W</span><span>{num(row.coveragePct,locale)}%</span><span className={`confidence confidence-${row.confidence}`}>{t(`confidence_${row.confidence}`)}</span></div>)}</div></Panel>
  </>;
}

function Tyres({ data, locale, t, period, maxDate, customRange, units }) {
  const tyres=safe(data.battery?.tyres).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>({...row,label:row.date?.slice(5)}));
  if (!tyres.length) return <Empty t={t}/>;
  const latest=tyres.at(-1), first=tyres[0], pressureChange=Number.isFinite(Number(latest?.averageKpa))&&Number.isFinite(Number(first?.averageKpa))?Number(latest.averageKpa)-Number(first.averageKpa):null;
  const pressures=tyres.flatMap((row)=>[row.frontLeftKpa,row.frontRightKpa,row.rearLeftKpa,row.rearRightKpa]).map(Number).filter(Number.isFinite);
  const pressureLabel=pressureUnitLabel(units.pressure), displayTyres=tyres.map((row)=>({...row,frontLeftKpa:pressureValue(row.frontLeftKpa,units.pressure),frontRightKpa:pressureValue(row.frontRightKpa,units.pressure),rearLeftKpa:pressureValue(row.rearLeftKpa,units.pressure),rearRightKpa:pressureValue(row.rearRightKpa,units.pressure),frontImbalanceKpa:pressureValue(row.frontImbalanceKpa,units.pressure),rearImbalanceKpa:pressureValue(row.rearImbalanceKpa,units.pressure)}));
  const displayPressures=pressures.map((value)=>pressureValue(value,units.pressure)), padding=units.pressure==="psi"?1:.1;
  const pressureMin=displayPressures.length?Math.floor(Math.min(...displayPressures)/padding)*padding-padding:1, pressureMax=displayPressures.length?Math.ceil(Math.max(...displayPressures)/padding)*padding+padding:4;
  const maximumImbalance=maximum(tyres.flatMap((row)=>[{value:row.frontImbalanceKpa},{value:row.rearImbalanceKpa}]),"value");
  return <>
    <div className="metric-grid tyres-metrics"><Metric tone="mint" label={t("currentAveragePressure")} value={num(pressureValue(latest?.averageKpa,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`} note={latest?.date}/><Metric tone="cyan" label={t("pressureChange")} value={num(pressureValue(pressureChange,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`} note={t("fourTyreMedian")}/><Metric tone="amber" label={t("maximumTyreImbalance")} value={num(pressureValue(maximumImbalance,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`}/><Metric tone="violet" label={t("daysWithReadings")} value={num(tyres.length,locale,0)} note={`${num(sum(tyres,"samples"),locale,0)} ${t("samplesLower")}`}/></div>
    <div className="dashboard-grid two">
      <Panel title={t("tyrePressureTrend")} subtitle={t("tyrePressureTrendHelp")}><Chart><LineChart data={displayTyres} margin={{top:12,right:12,left:4}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis width={48} domain={[pressureMin,pressureMax]} tickFormatter={(value)=>num(value,locale,units.pressure==="bar"?1:0)} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureLabel}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="frontLeftKpa" name={t("frontLeftShort")} stroke={C.mint} dot={false}/><Line dataKey="frontRightKpa" name={t("frontRightShort")} stroke={C.cyan} dot={false}/><Line dataKey="rearLeftKpa" name={t("rearLeftShort")} stroke={C.amber} dot={false}/><Line dataKey="rearRightKpa" name={t("rearRightShort")} stroke={C.coral} dot={false}/></LineChart></Chart></Panel>
      <Panel title={t("tyreImbalanceTrend")} subtitle={t("tyreImbalanceTrendHelp")}><Chart><LineChart data={displayTyres} margin={{top:12,right:12,left:4}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis width={48} domain={[0,"auto"]} tickFormatter={(value)=>num(value,locale,units.pressure==="bar"?2:1)} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureLabel}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="frontImbalanceKpa" name={t("frontAxle")} stroke={C.cyan} dot={{r:2}}/><Line dataKey="rearImbalanceKpa" name={t("rearAxle")} stroke={C.amber} dot={{r:2}}/></LineChart></Chart></Panel>
    </div>
  </>;
}

function DrivingHeatmap({ rows, t }) {
  const labels=[t("mondayShort"),t("tuesdayShort"),t("wednesdayShort"),t("thursdayShort"),t("fridayShort"),t("saturdayShort"),t("sundayShort")], values=new Map();
  rows.forEach((row)=>{const key=`${row.weekdayIndex}|${row.hourIndex}`;values.set(key,(values.get(key)||0)+Number(row.drivingMinutes||0));});
  const maximumValue=Math.max(1,...values.values());
  return <div className="driving-heatmap"><div className="heatmap-hours"><span/>{Array.from({length:24},(_,hour)=><small key={hour}>{hour%3===0?String(hour).padStart(2,"0"):""}</small>)}</div>{labels.map((label,weekday)=><div className="heatmap-row" key={label}><strong>{label}</strong>{Array.from({length:24},(_,hour)=>{const value=values.get(`${weekday}|${hour}`)||0;return <i key={hour} title={`${label} ${String(hour).padStart(2,"0")}:00 · ${Math.round(value)} min`} style={{opacity:value?Math.max(.18,value/maximumValue):.04}}/>;})}</div>)}</div>;
}

function contextRows(data) {
  const calculated=safe(data.driving?.contexts);
  if(calculated.length)return calculated;
  return safe(data.trips).map((row)=>{
    const average=Number(row.avgSpeedKmh)||0, maximumSpeed=Number(row.maxSpeedKmh)||0;
    const context=average>=80||maximumSpeed>=110?"motorway":average>=40||maximumSpeed>=70?"road":"urban";
    return {segmentId:`fallback-${row.tripId}`,tripId:row.tripId,date:row.date,startedAtUtc:row.startedAtUtc,context,confidence:"low",confidenceScore:null,durationMinutes:row.durationMinutes,distanceKm:row.distanceKm,averageSpeedKmh:row.avgSpeedKmh,energyUsedKwh:row.energyUsedKwh,regeneratedKwh:row.regeneratedKwh,netEnergyKwh:row.netEnergyKwh,consumptionKwh100:row.consumptionKwh100,stopCount:0};
  });
}

function Trends({ data, locale, t, period, maxDate, customRange, units }) {
  const battery=data.battery||{}, monthMap=new Map();
  const month=(date)=>{const key=String(date||"").slice(0,7);if(!key)return null;if(!monthMap.has(key))monthMap.set(key,{month:key,distanceKm:0,netEnergyKwh:0,regeneratedKwh:0,drivingHours:0,wallEnergyKwh:0,batteryEnergyKwh:0,charges:0,capacity:[],soh:[],range:[],parkedEnergyKwh:0,parkedSeconds:0,parkedLoss:[],pressure:[]});return monthMap.get(key);};
  safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(!target)return;target.distanceKm+=Number(row.distanceKm)||0;target.netEnergyKwh+=Number(row.netEnergyKwh)||0;target.regeneratedKwh+=Number(row.regeneratedKwh)||0;target.drivingHours+=Number(row.drivingHours)||0;target.wallEnergyKwh+=Number(row.wallEnergyKwh)||0;target.batteryEnergyKwh+=Number(row.batteryEnergyKwh)||0;target.charges+=Number(row.charges)||0;});
  safe(battery.history).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(!target)return;if(Number.isFinite(Number(row.rollingCapacityKwh)))target.capacity.push(Number(row.rollingCapacityKwh));if(Number.isFinite(Number(row.relativeSohPct)))target.soh.push(Number(row.relativeSohPct));});
  safe(battery.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(target&&Number.isFinite(Number(row.impliedRangeMedianKm)))target.range.push(Number(row.impliedRangeMedianKm));});
  safe(battery.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange)).forEach((row)=>{const target=month(row.startedAtUtc);if(!target)return;target.parkedEnergyKwh+=Number(row.energyKwh)||0;target.parkedSeconds+=Number(row.observedSeconds)||0;if(Number.isFinite(Number(row.socLossPerDay)))target.parkedLoss.push(Number(row.socLossPerDay));});
  safe(battery.tyres).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(target&&Number.isFinite(Number(row.averageKpa)))target.pressure.push(Number(row.averageKpa));});
  const monthly=[...monthMap.values()].sort((a,b)=>a.month.localeCompare(b.month)).map((row)=>({
    ...row,label:monthText(row.month,locale),distanceDisplay:distanceValue(row.distanceKm,units.system),consumptionDisplay:consumptionValue(row.distanceKm?row.netEnergyKwh/row.distanceKm*100:null,units.system),rangeDisplay:distanceValue(median(row.range),units.system),capacityKwh:median(row.capacity),relativeSohPct:median(row.soh),parkedWatts:row.parkedSeconds?row.parkedEnergyKwh/(row.parkedSeconds/3600)*1000:null,parkedLossPct:median(row.parkedLoss),chargeEfficiencyPct:row.wallEnergyKwh?row.batteryEnergyKwh/row.wallEnergyKwh*100:null,pressureDisplay:pressureValue(median(row.pressure),units.pressure),
  }));
  const segments=contextRows(data).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const contextTotals=["urban","road","motorway"].map((context)=>{const rows=segments.filter((row)=>row.context===context),distance=sum(rows,"distanceKm"),used=sum(rows,"energyUsedKwh"),regenerated=sum(rows,"regeneratedKwh"),net=sum(rows,"netEnergyKwh"),minutes=sum(rows,"durationMinutes"),weightedConfidence=rows.reduce((total,row)=>total+(Number(row.confidenceScore)||0)*(Number(row.distanceKm)||0),0);return {context,rows:rows.length,distanceKm:distance,distanceDisplay:distanceValue(distance,units.system),minutes,energyUsedKwh:used,regeneratedKwh:regenerated,netEnergyKwh:net,consumptionDisplay:consumptionValue(distance?net/distance*100:null,units.system),confidenceScore:distance?weightedConfidence/distance:null};});
  const totalDistance=sum(contextTotals,"distanceKm"), totalMonths=monthly.length, latest=monthly.at(-1);
  if(!monthly.length&&!segments.length)return <Empty t={t}/>;
  const has=(field)=>monthly.some((row)=>Number.isFinite(Number(row[field])));
  return <>
    <div className="metric-grid trends-metrics"><Metric tone="mint" label={t("monthsTracked")} value={num(totalMonths,locale,0)} note={monthly.length?(monthly.length>1?`${monthly[0].label} — ${latest.label}`:latest.label):null}/><Metric tone="cyan" label={t("distance")} value={num(distanceValue(sum(monthly,"distanceKm"),units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="violet" label={t("averageConsumption")} value={num(consumptionValue(sum(monthly,"distanceKm")?sum(monthly,"netEnergyKwh")/sum(monthly,"distanceKm")*100:null,units.system),locale)} unit={` ${consumptionUnit(units.system)}`}/><Metric tone="amber" label={t("gridEnergy")} value={num(sum(monthly,"wallEnergyKwh"),locale)} unit=" kWh" note={`${num(sum(monthly,"charges"),locale,0)} ${t("sessionsLower")}`}/></div>
    <div className="method-note"><strong>{t("longTermTrends")}</strong><p>{t("longTermTrendsHelp")}</p></div>
    <div className="dashboard-grid two trends-grid">
      <Panel title={t("monthlyDistanceConsumption")} subtitle={t("monthlyDistanceConsumptionHelp")}>{has("distanceDisplay")?<Chart><ComposedChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar yAxisId="a" dataKey="distanceDisplay" name={`${t("distance")} (${distanceUnit(units.system)})`} fill={C.mint}/><Line yAxisId="b" dataKey="consumptionDisplay" name={consumptionUnit(units.system)} stroke={C.coral} strokeWidth={2}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyRangeTrend")} subtitle={t("monthlyRangeTrendHelp")}>{has("rangeDisplay")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${distanceUnit(units.system)}`}/><Line dataKey="rangeDisplay" name={t("xpengPredictedRange100")} stroke={C.violet} dot={{r:3}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyBatteryHealth")} subtitle={t("notBmsSoh")}>{has("capacityKwh")||has("relativeSohPct")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line yAxisId="a" dataKey="capacityKwh" name={t("estimatedCapacity")} stroke={C.mint} dot={{r:3}}/><Line yAxisId="b" dataKey="relativeSohPct" name={t("relativeSoh")} stroke={C.amber} dot={{r:3}}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyParkedUse")} subtitle={t("monthlyParkedUseHelp")}>{has("parkedWatts")||has("parkedLossPct")?<Chart><ComposedChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar yAxisId="a" dataKey="parkedWatts" name={t("parkedPower")} fill={C.cyan}/><Line yAxisId="b" dataKey="parkedLossPct" name={t("parkedLossPerDay")} stroke={C.coral}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyCharging")} subtitle={t("monthlyChargingHelp")}>{has("wallEnergyKwh")?<Chart><BarChart data={monthly} margin={{top:16,right:12,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="wallEnergyKwh" name={t("gridEnergy")} fill={C.cyan}/><Bar dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyTyrePressure")} subtitle={t("monthlyTyrePressureHelp")}>{has("pressureDisplay")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-2}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis domain={["auto","auto"]} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureUnitLabel(units.pressure)}`}/><Line dataKey="pressureDisplay" name={t("currentAveragePressure")} stroke={C.teal} dot={{r:3}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </div>
    <Panel title={t("estimatedDrivingContext")} subtitle={t("estimatedDrivingContextHelp")}>
      <div className="metric-grid context-metrics">{contextTotals.map((row,index)=><Metric key={row.context} tone={["mint","cyan","violet"][index]} label={t(`context_${row.context}`)} value={num(row.distanceDisplay,locale)} unit={` ${distanceUnit(units.system)}`} note={`${num(row.consumptionDisplay,locale)} ${consumptionUnit(units.system)} · ${duration(row.minutes,t)}`}/>)}</div>
      <div className="context-layout"><div>{totalDistance?<Chart height={250}><PieChart><Pie data={contextTotals} dataKey="distanceDisplay" nameKey="context" innerRadius={52} outerRadius={86} paddingAngle={3}>{contextTotals.map((row,index)=><Cell key={row.context} fill={[C.mint,C.cyan,C.violet][index]}/>)}</Pie><Tooltip formatter={(value,name)=>[`${num(value,locale)} ${distanceUnit(units.system)}`,t(`context_${name}`)]}/><Legend formatter={(value)=>t(`context_${value}`)} wrapperStyle={{fontSize:11}}/></PieChart></Chart>:<ChartEmpty t={t}/>}</div><div className="context-table"><div className="table-head"><span>{t("drivingContext")}</span><span>{t("distance")}</span><span>{t("time")}</span><span>{t("energyUsed")}</span><span>{t("regenerated")}</span><span>{t("confidence")}</span></div>{contextTotals.map((row)=><div key={row.context}><strong>{t(`context_${row.context}`)}</strong><span>{num(row.distanceDisplay,locale)} {distanceUnit(units.system)}</span><span>{duration(row.minutes,t)}</span><span>{num(row.energyUsedKwh,locale)} kWh</span><span>{num(row.regeneratedKwh,locale)} kWh</span><span>{row.confidenceScore==null?t("confidence_low"):`${num(row.confidenceScore,locale,0)}%`}</span></div>)}</div></div>
    </Panel>
    <div className="method-note context-disclaimer"><strong>{t("softwareEstimate")}</strong><p>{t("drivingContextDisclaimer")}</p></div>
  </>;
}

function Activity({ data, locale, t, period, maxDate, customRange, units }) {
  const weekdays = [t("mondayShort"),t("tuesdayShort"),t("wednesdayShort"),t("thursdayShort"),t("fridayShort"),t("saturdayShort"),t("sundayShort")];
  const daily = safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>({...row,consumptionDisplay:consumptionValue(row.consumptionKwh100,units.system),label:row.date?.slice(5)}));
  const trips = safe(data.trips).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const journeys = safe(data.journeys).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const weekdayTotals = Array.from({length:7},()=>({trips:0,distanceKm:0}));
  const hourTotals = Array.from({length:24},(_,hour)=>({hour,trips:0}));
  trips.forEach((row)=>{ const weekday=(new Date(`${row.date}T00:00:00Z`).getUTCDay()+6)%7; weekdayTotals[weekday].trips+=1; weekdayTotals[weekday].distanceKm+=Number(row.distanceKm)||0; const hour=localHour(row.startedAtUtc); if(Number.isFinite(hour)) hourTotals[hour].trips+=1; });
  const weekday = weekdayTotals.map((row,index)=>({...row,distanceKm:distanceValue(row.distanceKm,units.system),label:weekdays[index]}));
  const hours = hourTotals.map((row)=>({...row,label:`${String(row.hour).padStart(2,"0")}h`}));
  const monthlyMap = new Map(); daily.forEach((row)=>{ const key=row.date.slice(0,7), current=monthlyMap.get(key)||{month:key,distanceKm:0,journeys:0}; current.distanceKm+=Number(row.distanceKm)||0; current.journeys+=Number(row.journeys)||0; monthlyMap.set(key,current); });
  const monthly = [...monthlyMap.values()].map((row)=>({...row,distanceKm:distanceValue(row.distanceKm,units.system),label:row.month}));
  const heatmap=safe(data.activity?.heatmap).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const bar = (rows,key,color) => rows.some((row)=>Number(row[key]))?<Chart><BarChart data={rows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Bar dataKey={key} fill={color} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t}/>;
  if (!daily.length && !trips.length) return <Empty t={t}/>;
  return <><div className="metric-grid activity-metrics"><Metric tone="mint" label={t("activeDays")} value={num(daily.filter((row)=>row.trips||row.charges).length,locale,0)}/><Metric tone="cyan" label={t("distance")} value={num(distanceValue(sum(daily,"distanceKm"),units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="violet" label={t("drivingTime")} value={num(sum(daily,"drivingHours"),locale)} unit={` ${t("hourShort")}`}/><Metric tone="amber" label={t("journeys")} value={num(journeys.length,locale,0)} note={`${trips.length} ${t("segmentsLower")}`}/></div><Panel title={t("actualMovementHeatmap")} subtitle={t("actualMovementHeatmapHelp")}><DrivingHeatmap rows={heatmap} t={t}/></Panel><div className="dashboard-grid two activity-grid">
    <Panel title={t("dailyEnergy")} subtitle={t("dailyEnergyHelp")}><Chart><BarChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="energyUsedKwh" name={t("used")} fill={C.amber}/><Bar dataKey="regeneratedKwh" name={t("regenerated")} fill={C.mint}/></BarChart></Chart></Panel>
    <Panel title={t("dailyConsumption")} subtitle={t("dailyConsumptionHelp")}><Chart><LineChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${consumptionUnit(units.system)}`}/><Line dataKey="consumptionDisplay" name={t("consumption")} stroke={C.coral} dot={{r:2}} strokeWidth={2}/></LineChart></Chart></Panel>
    <Panel title={t("distanceByMonth")}>{bar(monthly,"distanceKm",C.mint)}</Panel><Panel title={t("journeysByMonth")} subtitle={t("journeysByMonthHelp")}>{bar(monthly,"journeys",C.cyan)}</Panel>
    <Panel title={t("weekdayActivity")}>{bar(weekday,"distanceKm",C.violet)}</Panel><Panel title={t("tripStartsByHour")} subtitle={t("localTimeZone")}>{bar(hours,"trips",C.amber)}</Panel>
    <Panel title={t("chargedEnergyPerDay")} subtitle={t("gridVsBattery")}><Chart><BarChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="wallEnergyKwh" name={t("gridEnergy")} fill={C.cyan}/><Bar dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/></BarChart></Chart></Panel>
    <Panel title={t("chargingSessionsPerDay")}>{bar(daily,"charges",C.teal)}</Panel>
  </div></>;
}

function Report({ data, locale, t, minDate, maxDate, units }) {
  const [startDate,setStartDate]=useState(minDate), [endDate,setEndDate]=useState(maxDate), [energyPrice,setEnergyPrice]=useState(""), [reference,setReference]=useState(""), [includeMaps,setIncludeMaps]=useState(false), [exporting,setExporting]=useState(false), [exportError,setExportError]=useState(false);
  const firstDate=startDate&&endDate&&startDate>endDate?endDate:startDate, lastDate=startDate&&endDate&&startDate>endDate?startDate:endDate;
  const range={start:firstDate,end:lastDate};
  const daily=safe(data.daily).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const journeys=safe(data.journeys).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const trips=safe(data.trips).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const charges=safe(data.charges).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const distance=sum(daily,"distanceKm"), netEnergy=sum(daily,"netEnergyKwh"), wallEnergy=sum(charges,"wallEnergyKwh"), batteryEnergy=sum(charges,"batteryEnergyKwh");
  const consumption=distance?netEnergy/distance*100:null, efficiency=wallEnergy?batteryEnergy/wallEnergy*100:null;
  const normalizedPrice=energyPrice.trim()?Number(energyPrice.replace(",",".")):null;
  const hasPrice=normalizedPrice!=null&&Number.isFinite(normalizedPrice)&&normalizedPrice>=0;
  const displayDistance=distanceValue(distance,units.system), displayDistanceUnit=distanceUnit(units.system), displayConsumption=consumptionValue(consumption,units.system), displayConsumptionUnit=consumptionUnit(units.system);
  const estimatedCost=hasPrice?wallEnergy*normalizedPrice:null, costPer100=hasPrice&&displayDistance?estimatedCost/displayDistance*100:null;
  const mostActiveDay=daily.reduce((best,row)=>Number(row.distanceKm)>Number(best?.distanceKm||0)?row:best,null), averageJourney=journeys.length?distance/journeys.length:null, longestJourney=journeys.reduce((best,row)=>Number(row.distanceKm)>Number(best?.distanceKm||0)?row:best,null);
  const usedEnergy=sum(trips,"energyUsedKwh"), regeneratedEnergy=sum(trips,"regeneratedKwh"), regenerationShare=usedEnergy+regeneratedEnergy?regeneratedEnergy/(usedEnergy+regeneratedEnergy)*100:null;
  const acEnergy=sum(charges.filter((row)=>row.chargeType==="AC"),"batteryEnergyKwh"), dcEnergy=sum(charges.filter((row)=>row.chargeType==="DC"),"batteryEnergyKwh");
  const mappedJourneys=journeys.filter((row)=>safe(row.gps?.segments).length);
  const hasRows=daily.length>0||charges.length>0;
  const exportPdf=async()=>{if(!hasRows||exporting)return;setExporting(true);setExportError(false);try{const {downloadReportPdf}=await import("./report-pdf.js");await downloadReportPdf({data,locale,t,startDate,endDate,energyPrice:hasPrice?normalizedPrice:null,reference,units,includeMaps});}catch(error){console.error(error);setExportError(true);}finally{setExporting(false);}};
  return <div className="report-page">
    <Panel title={t("reportSettings")} subtitle={t("reportSettingsHelp")}>
      <div className="report-form">
        <label><span>{t("startDate")}</span><input type="date" min={minDate} max={maxDate} value={startDate} onChange={(event)=>setStartDate(event.currentTarget.value)}/></label>
        <label><span>{t("endDate")}</span><input type="date" min={minDate} max={maxDate} value={endDate} onChange={(event)=>setEndDate(event.currentTarget.value)}/></label>
        <label><span>{t("reportEnergyPrice")}</span><div className="input-with-unit"><input type="text" inputMode="decimal" placeholder="0,20" value={energyPrice} onChange={(event)=>setEnergyPrice(event.currentTarget.value)}/><small>€/kWh</small></div></label>
        <label><span>{t("reportReference")}</span><input type="text" maxLength="80" placeholder={t("reportReferencePlaceholder")} value={reference} onChange={(event)=>setReference(event.currentTarget.value)}/></label>
        <label className="report-map-option"><span>{t("includeRouteMaps")}</span><span className="report-checkbox"><input type="checkbox" checked={includeMaps} disabled={!mappedJourneys.length} onChange={(event)=>setIncludeMaps(event.currentTarget.checked)}/><small>{mappedJourneys.length?t("includeRouteMapsHelp"):t("noRouteMapsInPeriod")}</small></span></label>
        <button className="report-export" type="button" disabled={!hasRows||exporting||(energyPrice.trim()&&!hasPrice)} onClick={exportPdf}><Icon name="report"/><span><strong>{exporting?t("reportGenerating"):t("reportExportPdf")}</strong><small>{t("reportExportHelp")}</small></span></button>
      </div>
      <div className="report-local-note"><strong>{t("privacyTitle")}</strong><span>{t("reportLocalHelp")}</span></div>
      {energyPrice.trim()&&!hasPrice?<div className="report-error">{t("reportInvalidPrice")}</div>:null}
      {exportError?<div className="report-error">{t("reportExportError")}</div>:null}
    </Panel>
    {!hasRows?<Empty t={t}/>:<>
      <div className="report-period"><span>{t("reportPreview")}</span><strong>{dateText(firstDate,locale)} — {dateText(lastDate,locale)}</strong>{reference?<small>{reference}</small>:null}</div>
      <div className="metric-grid report-metrics">
        <Metric tone="mint" label={t("distance")} value={num(displayDistance,locale)} unit={` ${displayDistanceUnit}`} note={`${journeys.length} ${t("journeysLower")}`} />
        <Metric tone="cyan" label={t("averageConsumption")} value={num(displayConsumption,locale)} unit={` ${displayConsumptionUnit}`} note={`${num(sum(daily,"drivingHours"),locale)} ${t("hourShort")}`} />
        <Metric tone="violet" label={t("charges")} value={num(charges.length,locale,0)} note={`${num(wallEnergy,locale)} kWh ${t("fromGrid")}`} />
        <Metric tone="amber" label={t("chargeEfficiency")} value={num(efficiency,locale)} unit="%" note={`${num(sum(charges,"lossKwh"),locale)} kWh ${t("losses").toLowerCase()}`} />
        <Metric label={t("reportEstimatedCost")} value={hasPrice?num(estimatedCost,locale,2):"—"} unit={hasPrice?" €":""} note={hasPrice?`${num(normalizedPrice,locale,2)} €/kWh`:t("reportPriceNeeded")} />
        <Metric tone="coral" label={`${t("reportCostPer100")} ${displayDistanceUnit}`} value={hasPrice?num(costPer100,locale,2):"—"} unit={hasPrice?" €":""} note={`${trips.length} ${t("tripsLower")}`} />
      </div>
      <Panel title={t("reportInsights")} subtitle={t("reportInsightsHelp")}><div className="metric-grid report-insights"><Metric label={t("reportMostActiveDay")} value={mostActiveDay?dateText(mostActiveDay.date,locale):"—"} note={mostActiveDay?`${num(distanceValue(mostActiveDay.distanceKm,units.system),locale)} ${displayDistanceUnit}`:null}/><Metric label={t("reportAverageJourney")} value={num(distanceValue(averageJourney,units.system),locale)} unit={` ${displayDistanceUnit}`}/><Metric label={t("reportLongestJourney")} value={num(distanceValue(longestJourney?.distanceKm,units.system),locale)} unit={` ${displayDistanceUnit}`}/><Metric label={t("reportRegenerationShare")} value={num(regenerationShare,locale)} unit="%"/><Metric label={t("reportAcDcSplit")} value={`${num(acEnergy,locale)} / ${num(dcEnergy,locale)}`} unit=" kWh" note="AC / DC"/><Metric label={t("reportPeakChargingPower")} value={num(maximum(charges,"maxPowerKw"),locale)} unit=" kW"/></div></Panel>
      <div className="method-note"><strong>{t("reportEstimateTitle")}</strong><p>{t("reportDisclaimer")}</p></div>
      <div className="dashboard-grid two report-tables">
        <Panel title={t("reportDailyBreakdown")} subtitle={t("reportDailyBreakdownHelp")}><div className="report-mini-table"><div className="table-head"><span>{t("date")}</span><span>{t("distance")}</span><span>{t("consumption")}</span><span>{t("gridEnergy")}</span></div>{daily.slice(-14).reverse().map((row)=><div key={row.date}><strong>{dateText(row.date,locale)}</strong><span>{num(distanceValue(row.distanceKm,units.system),locale)} {displayDistanceUnit}</span><span>{num(consumptionValue(row.consumptionKwh100,units.system),locale)} {displayConsumptionUnit}</span><span>{num(row.wallEnergyKwh,locale)} kWh</span></div>)}</div></Panel>
        <Panel title={t("reportChargingDetails")} subtitle={t("reportChargingDetailsHelp")}><div className="report-mini-table"><div className="table-head"><span>{t("date")}</span><span>{t("chargeType")}</span><span>{t("batteryEnergy")}</span><span>{t("gridEnergy")}</span></div>{charges.slice(-14).reverse().map((row)=><div key={row.chargeId}><strong>{dateText(row.startedAtUtc,locale)}</strong><span>{row.chargeType||"—"}</span><span>{num(row.batteryEnergyKwh,locale)} kWh</span><span>{num(row.wallEnergyKwh,locale)} kWh</span></div>)}</div></Panel>
      </div>
    </>}
  </div>;
}

function Quality({ data, locale, t }) {
  const coverage = safe(data.quality?.coverage), events = safe(data.quality?.events);
  return <>
    <div className="quality-summary"><div><span>{t("qualityStatus")}</span><strong>{events.length ? t("reviewRecommended") : t("noCriticalIssues")}</strong><p>{t("qualityStatusHelp")}</p></div><div className="quality-count"><strong>{events.length}</strong><span>{t("qualityEvents")}</span></div></div>
    <div className="metric-grid quality-metrics">{coverage.map((row) => <Metric key={row.family} label={t(`family_${row.family}`)} value={num(row.rows, locale,0)} note={`${dateText(row.firstUtc,locale)} — ${dateText(row.lastUtc,locale)}`} />)}</div>
    <Panel title={t("signalAvailability")} subtitle={t("signalAvailabilityHelp")}>
      <div className="signal-availability">{coverage.map((row)=>{const available=safe(row.availableColumns),empty=safe(row.emptyColumns),unknown=safe(row.unknownColumns),total=Number(row.totalColumns)||available.length+empty.length,share=total?available.length/total*100:0;return <article key={row.family}><header><strong>{t(`family_${row.family}`)}</strong><span>{available.length}/{total} {t("signalsAvailable")}</span></header><div className="signal-bar" aria-label={`${num(share,locale,0)}%`}><i style={{width:`${share}%`}}/></div><div className="signal-group"><span>{t("availableMetrics")}</span><div>{available.map((field)=><small key={field} className="is-available">{signalText(field,t)}</small>)}</div></div>{empty.length?<div className="signal-group"><span>{t("noDataSignals")}</span><div>{empty.map((field)=><small key={field} className="is-empty">{signalText(field,t)}</small>)}</div></div>:null}{unknown.length?<details><summary>{unknown.length} {t("newFieldsFound")}</summary><p>{t("newFieldsHelp")}</p></details>:null}</article>;})}</div>
    </Panel>
    <Panel title={t("qualityEvents")} subtitle={t("qualityEventsHelp")}><div className="data-table"><div className="table-head"><span>{t("severity")}</span><span>{t("family")}</span><span>{t("rule")}</span><span>{t("affected")}</span><span>{t("field")}</span></div>{events.map((row,index)=><div key={`${row.rule}-${index}`}><span><i className={`severity severity-${row.severity}`}>{t(`severity_${row.severity}`)}</i></span><span>{t(`family_${row.family}`)}</span><span>{t(`rule_${row.rule}`)}</span><span>{num(row.affectedRows,locale,0)}</span><span>{row.field || "—"}</span></div>)}</div>{!events.length?<div className="inline-success">{t("noQualityEvents")}</div>:null}</Panel>
    <div className="threshold-note"><strong>{t("interpretationRules")}</strong><p>{t("interpretationRulesHelp")}</p></div>
  </>;
}

function DataSection({ data, locale, t, busy, onChooseAdditional, onChooseHistory, onExport, onReset, persistence, onToggleRememberHistory, onToggleImportReminder, onSetImportReminderDays, onForgetSavedHistory, drive, onConnectDrive, onSaveDrive, onOpenDrive, onDisconnectDrive, onToggleDriveAutoSync }) {
  const [trimMeters,setTrimMeters]=useState(0);
  const [dragging,setDragging]=useState(false);
  return <div className="dashboard-grid two data-layout">
    <Panel title={t("addMoreData")} subtitle={t("addMoreHelp")}><div className="data-actions"><label className={`dashboard-upload ${busy ? "is-disabled" : ""} ${dragging ? "is-dragging" : ""}`} onDragEnter={(event)=>{event.preventDefault();if(!busy)setDragging(true);}} onDragOver={(event)=>event.preventDefault()} onDragLeave={(event)=>{event.preventDefault();if(!event.currentTarget.contains(event.relatedTarget))setDragging(false);}} onDrop={(event)=>{event.preventDefault();setDragging(false);if(!busy)onChooseAdditional(event.dataTransfer.files,{trimMeters});}}><input type="file" multiple accept=".zip,.gpx,application/zip,application/gpx+xml" disabled={busy} onChange={(event)=>{onChooseAdditional(event.target.files,{trimMeters});event.target.value="";}}/><Icon name="data"/><strong>{busy?t("importing"):dragging?t("dropActive"):t("chooseFiles")}</strong><small>{t("additionalDropHint")}</small></label><label className="gps-trim-control unified-route-privacy"><span>{t("routePrivacyTrim")}</span><select value={trimMeters} disabled={busy} onChange={(event)=>setTrimMeters(Number(event.currentTarget.value))}><option value="0">{t("trimNone")}</option><option value="100">100 m</option><option value="250">250 m</option><option value="500">500 m</option></select><small>{t("routePrivacyTrimHelp")}</small></label><label className="secondary-action"><input type="file" accept=".xpeng,.json.gz,.gz,application/octet-stream,application/gzip" disabled={busy} onChange={(event)=>{onChooseHistory(event.target.files);event.target.value="";}}/><strong>{t("replaceFromHistory")}</strong></label><button className="primary-action" type="button" disabled={busy} onClick={onExport}>{t("exportHistory")}</button><p className="export-help">{t("exportHistoryHelp")}</p><p className="history-warning">{t("historySensitiveWarning")}</p><button className="danger-link" type="button" disabled={busy} onClick={onReset}>{t("reset")}</button></div></Panel>
    <Panel title={t("importHistory")} subtitle={`${safe(data.imports).length} ${t("filesLower")}`}><div className="import-history">{safe(data.imports).map((row)=><div key={row.sha256}><span><strong>{row.name}</strong><small>{dateText(row.completedAtUtc,locale)} · {num(row.rows,locale,0)} {t("rowsLower")}</small></span><code>{row.sha256?.slice(0,10)}…</code></div>)}</div></Panel>
    <div className="gps-management-panel">
      <Panel title={t("gpsRoutes")} subtitle={t("gpsRoutesHelp")}>
        <div className="gps-summary"><span><strong>{num(safe(data.gpsImports).length,locale,0)}</strong>{t("gpsSources")}</span><span><strong>{num(data.gps?.matchedCount||0,locale,0)}</strong>{t("matchedRoutes")}</span><span><strong>{num(data.gps?.matchedTripCount||0,locale,0)}</strong>{t("matchedTripRoutes")}</span><span><strong>{num(data.gps?.duplicateCount||0,locale,0)}</strong>{t("duplicateRoutesIgnored")}</span></div>
        <div className="gps-auto-note"><strong>{t("automaticGpsMatching")}</strong><p>{t("automaticGpsMatchingHelp")}</p></div>
        <p className="history-warning gps-sensitive-warning">{t("gpsSensitiveWarning")}</p>
        {!data.gps?.matchedCount?<div className="section-empty gps-empty"><strong>{t("noGpsTracks")}</strong><p>{t("noGpsTracksHelp")}</p></div>:null}
      </Panel>
    </div>
    <div className="persistent-history-panel">
      <Panel title={t("persistentHistoryTitle")} subtitle={t("persistentHistoryHelp")}>
        <div className="persistent-history-settings">
          {!persistence.supported ? <div className="persistent-history-error">{t("persistentHistoryUnsupported")}</div> : <>
            <label className="setting-toggle"><span><strong>{t("rememberHistory")}</strong><small>{t("rememberHistoryHelp")}</small></span><input type="checkbox" checked={persistence.enabled} disabled={busy || persistence.loading} onChange={(event)=>onToggleRememberHistory(event.currentTarget.checked)}/></label>
            {persistence.enabled ? <>
              <div className="persistent-history-status">
                <span><small>{t("savedHistoryStatus")}</small><strong>{persistence.hasSavedHistory ? t("savedHistoryReady") : t("savedHistoryPending")}</strong></span>
                <span><small>{t("savedHistorySize")}</small><strong>{formatStoredBytes(persistence.byteLength, locale)}</strong></span>
                <span><small>{t("savedHistoryDate")}</small><strong>{dateText(persistence.savedAtUtc, locale)}</strong></span>
                <span><small>{t("lastDataImport")}</small><strong>{dateText(persistence.lastImportAtUtc, locale)}</strong></span>
              </div>
              <label className="setting-toggle is-secondary"><span><strong>{t("monthlyImportReminder")}</strong><small>{t("monthlyImportReminderHelp")}</small></span><input type="checkbox" checked={persistence.reminderEnabled} disabled={busy} onChange={(event)=>onToggleImportReminder(event.currentTarget.checked)}/></label>
              {persistence.reminderEnabled ? <div className="reminder-schedule">
                <label><span>{t("importReminderInterval")}</span><select value={persistence.reminderDays} disabled={busy} onChange={(event)=>onSetImportReminderDays(Number(event.currentTarget.value))}>{IMPORT_REMINDER_DAY_OPTIONS.map((days)=><option value={days} key={days}>{days} {t("daysLower")}</option>)}</select></label>
                <span><small>{t("nextImportReminder")}</small><strong>{dateText(nextReminderAt(persistence.lastImportAtUtc, persistence.reminderDays), locale)}</strong></span>
              </div> : null}
              {persistence.reminderDue ? <div className="persistent-history-reminder"><strong>{t("importReminderDue")}</strong><p>{t("importReminderDueHelp")}</p></div> : null}
              <p className="history-warning persistent-warning">{t("persistentHistoryWarning")}</p>
              <button className="danger-link" type="button" disabled={busy || !persistence.hasSavedHistory} onClick={onForgetSavedHistory}>{t("forgetSavedHistory")}</button>
            </> : null}
            {persistence.error ? <div className="persistent-history-error">{t(persistence.error)}</div> : null}
          </>}
        </div>
      </Panel>
    </div>
    <div className="google-drive-panel">
      <Panel title={t("driveBackupTitle")} subtitle={t("driveBackupHelp")}>
        <div className="drive-backup-settings">
          {!drive.configured ? <div className="persistent-history-error">{t("driveNotConfigured")}</div> : <>
            <div className="drive-privacy-note"><strong>{t("driveOptionalTitle")}</strong><p>{t("drivePrivacyHelp")}</p></div>
            <div className="drive-status-grid">
              <span><small>{t("driveConnection")}</small><strong>{drive.connected ? t("driveConnected") : t("driveDisconnected")}</strong></span>
              <span><small>{t("driveBackupStatus")}</small><strong>{drive.hasBackup ? t("driveBackupReady") : t("driveBackupMissing")}</strong></span>
              <span><small>{t("savedHistorySize")}</small><strong>{formatStoredBytes(drive.byteLength, locale)}</strong></span>
              <span><small>{t("savedHistoryDate")}</small><strong>{dateText(drive.modifiedTime, locale)}</strong></span>
            </div>
            {!drive.connected ? <button className="primary-action" type="button" disabled={busy || drive.busy} onClick={onConnectDrive}>{drive.busy ? t("driveWorking") : t("driveConnect")}</button> : <>
              <div className="drive-actions"><button className="primary-action" type="button" disabled={busy || drive.busy} onClick={onSaveDrive}>{drive.busy ? t("driveWorking") : drive.hasBackup ? t("driveUpdate") : t("driveSave")}</button><button className="secondary-button" type="button" disabled={busy || drive.busy || !drive.hasBackup} onClick={onOpenDrive}>{t("driveOpen")}</button></div>
              <label className="setting-toggle is-secondary"><span><strong>{t("driveAutoSync")}</strong><small>{t("driveAutoSyncHelp")}</small></span><input type="checkbox" checked={drive.autoSync} disabled={busy || drive.busy} onChange={(event)=>onToggleDriveAutoSync(event.currentTarget.checked)}/></label>
              <button className="danger-link" type="button" disabled={busy || drive.busy} onClick={onDisconnectDrive}>{t("driveDisconnect")}</button>
            </>}
            {drive.error ? <div className="persistent-history-error" role="alert">{t(drive.error)}</div> : null}
          </>}
        </div>
      </Panel>
    </div>
  </div>;
}

const OverviewSection = memo(Overview);
const JourneysSection = memo(Journeys);
const DrivingSection = memo(Driving);
const ChargingSection = memo(Charging);
const BatterySection = memo(Battery);
const TyresSection = memo(Tyres);
const ActivitySection = memo(Activity);
const TrendsSection = memo(Trends);
const ReportSection = memo(Report);
const QualitySection = memo(Quality);

export default function Dashboard({ data, locale, setLocale, t, busy, progress, error, onChooseAdditional, onChooseHistory, onExport, onSaveCustomCharts, onReset, onCancel, canCancel, persistence, onToggleRememberHistory, onToggleImportReminder, onSetImportReminderDays, onForgetSavedHistory, drive, onConnectDrive, onSaveDrive, onOpenDrive, onDisconnectDrive, onToggleDriveAutoSync, theme, onToggleTheme, onStartTutorial }) {
  const [section,setSection]=useState("overview"), [period,setPeriod]=useState("all"), [selectedJourneyId,setSelectedJourneyId]=useState(null), [selectedChargeId,setSelectedChargeId]=useState(null), [measurementSystem,setMeasurementSystem]=useState("metric"), [pressureUnit,setPressureUnit]=useState("bar"), [settingsOpen,setSettingsOpen]=useState(false), [compactNavigation,setCompactNavigation]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 850px)").matches);
  const settingsRef=useRef(null);
  const [minDate,maxDate]=useMemo(()=>{
    const availableDates=[...safe(data.daily).map((row)=>row.date),...safe(data.trips).map((row)=>row.date),...safe(data.journeys).map((row)=>row.date),...safe(data.charges).map((row)=>row.date),...safe(data.battery?.history).map((row)=>row.date),...safe(data.battery?.parking).map((row)=>String(row.startedAtUtc||"").slice(0,10))].filter(Boolean).sort();
    return [availableDates.at(0)??"",availableDates.at(-1)??new Date().toISOString().slice(0,10)];
  },[data]);
  const [customRange,setCustomRange]=useState(()=>({start:minDate,end:maxDate}));
  const dataCoverage=useMemo(()=>formatTelemetryCoverage(data,locale),[data,locale]);
  const units=useMemo(()=>({system:measurementSystem,pressure:pressureUnit}),[measurementSystem,pressureUnit]);
  const shared={data,locale,t,period,maxDate,customRange,units};
  useEffect(()=>{
    if(!settingsOpen)return undefined;
    const dismiss=(event)=>{if(!settingsRef.current?.contains(event.target))setSettingsOpen(false);};
    const escape=(event)=>{if(event.key==="Escape")setSettingsOpen(false);};
    document.addEventListener("pointerdown",dismiss);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};
  },[settingsOpen]);
  useEffect(()=>{
    const media=window.matchMedia("(max-width: 850px)"),sync=()=>{setCompactNavigation(media.matches);setSettingsOpen(false);};
    sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);
  },[]);
  const openSection=useCallback((target)=>{setSection(target);setSettingsOpen(false);requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));},[]);
  const openRecord=useCallback((target,id)=>{if(target==="journeys")setSelectedJourneyId(id);if(target==="charging")setSelectedChargeId(id);openSection(target);},[openSection]);
  let content;
  if(section==="overview")content=<OverviewSection {...shared} openSection={openSection} openRecord={openRecord}/>;
  else if(section==="journeys")content=<JourneysSection {...shared} selectedId={selectedJourneyId} setSelectedId={setSelectedJourneyId}/>;
  else if(section==="driving")content=<DrivingSection {...shared}/>;
  else if(section==="charging")content=<ChargingSection {...shared} selectedId={selectedChargeId} setSelectedId={setSelectedChargeId}/>;
  else if(section==="battery")content=<BatterySection {...shared}/>;
  else if(section==="tyres")content=<TyresSection {...shared}/>;
  else if(section==="activity")content=<ActivitySection {...shared}/>;
  else if(section==="trends")content=<TrendsSection {...shared}/>;
  else if(section==="replay")content=<React.Suspense fallback={<div className="section-empty"><strong>{t("replayLoading")}</strong></div>}><Replay data={data} locale={locale} t={t} units={units}/></React.Suspense>;
  else if(section==="mycharts")content=<React.Suspense fallback={<div className="section-empty"><strong>{t("loadingEngine")}</strong></div>}><MyCharts data={data} locale={locale} t={t} units={units} onSave={onSaveCustomCharts}/></React.Suspense>;
  else if(section==="report")content=<ReportSection data={data} locale={locale} t={t} minDate={minDate} maxDate={maxDate} units={units}/>;
  else if(section==="quality")content=<QualitySection data={data} locale={locale} t={t}/>;
  else content=<DataSection data={data} locale={locale} t={t} busy={busy} onChooseAdditional={onChooseAdditional} onChooseHistory={onChooseHistory} onExport={onExport} onReset={onReset} persistence={persistence} onToggleRememberHistory={onToggleRememberHistory} onToggleImportReminder={onToggleImportReminder} onSetImportReminderDays={onSetImportReminderDays} onForgetSavedHistory={onForgetSavedHistory} drive={drive} onConnectDrive={onConnectDrive} onSaveDrive={onSaveDrive} onOpenDrive={onOpenDrive} onDisconnectDrive={onDisconnectDrive} onToggleDriveAutoSync={onToggleDriveAutoSync}/>;
  const filteredSections=["overview","journeys","driving","charging","battery","tyres","activity","trends"];
  const utilityActions=<div className={`dashboard-utility-actions ${compactNavigation?"is-mobile":"is-sidebar"}`}><button className={`topbar-data-action ${section==="data"?"is-active":""}`} type="button" onClick={()=>openSection("data")}><Icon name="data"/><span>{t("addMoreData")}</span></button><div className="settings-popover" ref={settingsRef}><button className={`settings-trigger ${settingsOpen?"is-active":""}`} type="button" aria-expanded={settingsOpen} aria-controls="dashboard-settings" onClick={()=>setSettingsOpen((current)=>!current)}>{t("settings")}</button>{settingsOpen?<div className="settings-panel" id="dashboard-settings" role="dialog" aria-label={t("settings")}><header><span><strong>{t("settings")}</strong><small>{t("settingsHelp")}</small></span><button type="button" onClick={()=>setSettingsOpen(false)}>{t("close")}</button></header><button className="settings-theme-button" type="button" onClick={onToggleTheme} aria-label={theme==="light"?t("darkTheme"):t("lightTheme")}><span><strong>{t("theme")}</strong><small>{theme==="light"?t("light"):t("dark")}</small></span><i className={theme==="dark"?"is-dark":""}/></button><label><span>{t("language")}</span><select value={locale} onChange={(event)=>setLocale(event.target.value)}><option value="pt-PT">Português</option><option value="en">English</option></select></label><label><span>{t("measurementUnits")}</span><select value={measurementSystem} onChange={(event)=>setMeasurementSystem(event.currentTarget.value)}><option value="metric">{t("metricUnits")}</option><option value="imperial">{t("imperialUnits")}</option></select></label><label><span>{t("tyrePressureUnit")}</span><select value={pressureUnit} onChange={(event)=>setPressureUnit(event.currentTarget.value)}><option value="bar">bar</option><option value="psi">psi</option></select></label><button className="settings-tutorial-button" type="button" onClick={()=>{setSettingsOpen(false);onStartTutorial?.();}}><span><strong>{t("tutorialOpen")}</strong><small>{t("tutorialRestartHelp")}</small></span><b aria-hidden="true">→</b></button></div>:null}</div></div>;
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <button className="dashboard-brand" type="button" onClick={()=>openSection("overview")} aria-label={t("nav_overview")}><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}assets/xpeng-analytics-mark-minimal.png`} alt="" /></span><span className="dashboard-brand-copy"><strong>XPENG</strong><small>Analytics</small>{dataCoverage?<span className="brand-data-range" title={`${t("dataCoverage")}: ${dataCoverage}`}>{dataCoverage}</span>:null}</span></button>
      <nav aria-label={t("navigation")}>{navGroups.map((group)=><div className={`nav-group ${group.key?"":"nav-group-primary"}`} data-tutorial={group.key||"overview"} key={group.key||"primary"}>{group.key?<span className="nav-group-label">{t(`navGroup_${group.key}`)}</span>:null}{group.items.map((item)=><button key={item} type="button" className={section===item?"is-active":""} aria-current={section===item?"page":undefined} onClick={()=>openSection(item)}><Icon name={item}/><span>{t(`nav_${item}`)}</span></button>)}</div>)}</nav>
      <div className="sidebar-bottom">{!compactNavigation?utilityActions:null}<a className="sidebar-kofi" href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">{t("supportCta")}</a><div className="privacy-mini"><i/><span><strong>{t("localOnly")}</strong><small>{persistence.enabled ? t("savedOnThisDevice") : t("sessionOnly")}</small></span></div><small className="sidebar-version">XPENG Analytics · v{APP_VERSION}</small></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-topbar"><div><span className="dashboard-eyebrow">{t("dashboard")}</span><h1>{t(`section_${section}`)}</h1><p>{t(`section_${section}_help`)}</p></div>{compactNavigation?utilityActions:null}</header>
      <label className="mobile-nav"><span>{t("navigation")}</span><select value={section} onChange={(event)=>openSection(event.currentTarget.value)}><option value="overview">{t("nav_overview")}</option>{navGroups.filter((group)=>group.key).map((group)=><optgroup key={group.key} label={t(`navGroup_${group.key}`)}>{group.items.map((item)=><option key={item} value={item}>{t(`nav_${item}`)}</option>)}</optgroup>)}</select>{dataCoverage?<small className="mobile-data-range" title={t("dataCoverage")}>{dataCoverage}</small>:null}</label>
      {filteredSections.includes(section)?<PeriodBar period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} minDate={minDate} maxDate={maxDate} t={t}/>:null}
      {busy?<div className="dashboard-progress"><div className="dashboard-progress-heading"><strong>{Math.round(progress.percent||0)}%</strong><span>{t(phaseKeys[progress.phase]||"loadingEngine")}{progress.detail?` · ${progress.detail}`:""}</span>{canCancel?<button className="cancel-processing" type="button" onClick={onCancel}>{t("cancelProcessing")}</button>:null}</div><div><i style={{width:`${Math.max(3,progress.percent||0)}%`}}/></div></div>:null}
      {error?<div className="dashboard-error">{t(`error_${error}`)}</div>:null}<div className="dashboard-content">{content}</div><footer className="site-footer dashboard-footer"><span>{t("unofficial")}</span><span>{t("ownerLabel")}: Miguel Pinto</span><span>v{APP_VERSION}</span><a href={`${import.meta.env.BASE_URL}about.html`} target="_blank" rel="noreferrer">{t("aboutProject")}</a><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{t("privacyPolicy")}</a><a href="https://github.com/josepinto1989/xpeng-analytics/issues" target="_blank" rel="noreferrer">{t("reportIssue")}</a><a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">Ko-fi</a></footer>
    </main>
  </div>;
}
