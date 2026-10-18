import React, { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createTimestampLookup, nearestTimestampPoint } from "./route-sync.js";
import { activeJourneyDates, buildReplayTimeline, estimatedLowBeam, replayDuration, replayFrame, REPLAY_SPEEDS, trunkPhase, trunkProgress, visualFrontWheelAngle } from "./replay.js";
import { distanceUnit, distanceValue, speedUnit, speedValue, temperatureUnit, temperatureValue } from "./units.js";

const safe = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const numberFormatters = new Map(), dateFormatters = new Map();
const numeric = (value, locale, digits = 1) => {
  if (!finite(value)) return "—";
  const key = `${locale}|${digits}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(locale, { maximumFractionDigits: digits }));
  return numberFormatters.get(key).format(Number(value));
};
const datePresets = {
  weekday: { weekday: "narrow", timeZone: "UTC" },
  month: { month: "long", year: "numeric", timeZone: "UTC" },
  longDate: { dateStyle: "long", timeZone: "UTC" },
  dateTime: { dateStyle: "long", timeStyle: "short" },
  time: { hour: "2-digit", minute: "2-digit" },
};
const formatDate = (value, locale, preset) => {
  const key = `${locale}|${preset}`;
  if (!dateFormatters.has(key)) dateFormatters.set(key, new Intl.DateTimeFormat(locale, datePresets[preset]));
  return dateFormatters.get(key).format(value instanceof Date ? value : new Date(value));
};
const dateKey = (value) => String(value || "").slice(0, 10);
const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const monthDate = (value) => new Date(`${value}-01T12:00:00Z`);
const shiftMonth = (value, amount) => { const date = monthDate(value); date.setUTCMonth(date.getUTCMonth() + amount); return monthKey(date); };
const formatDuration = (milliseconds) => { const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000)); const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; };

function MonthCalendar({ month, activeDates, selectedDate, onSelect, locale }) {
  const first = monthDate(month), year = first.getUTCFullYear(), monthIndex = first.getUTCMonth();
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const weekdays = Array.from({ length: 7 }, (_, index) => formatDate(new Date(Date.UTC(2024, 0, index + 1)), locale, "weekday"));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  return <section className="replay-month"><h3>{formatDate(first, locale, "month")}</h3><div className="replay-weekdays">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="replay-days">{cells.map((day, index) => {
    if (!day) return <span key={`blank-${index}`} />;
    const date = `${month}-${String(day).padStart(2, "0")}`, total = activeDates.get(date) || 0;
    return <button key={date} type="button" disabled={!total} className={`${total ? "has-journeys" : ""} ${selectedDate === date ? "is-selected" : ""}`} onClick={() => onSelect(date)} aria-label={`${date}: ${total}`}><b>{day}</b>{total ? <i>{total}</i> : null}</button>;
  })}</div></section>;
}

function ReplayCalendar({ journeys, selectedDate, onSelect, locale, t }) {
  const activeDates = useMemo(() => activeJourneyDates(journeys), [journeys]);
  const latest = [...activeDates.keys()].sort().at(-1) || new Date().toISOString().slice(0, 7);
  const [endMonth, setEndMonth] = useState(latest.slice(0, 7));
  useEffect(() => { if (selectedDate) setEndMonth(selectedDate.slice(0, 7)); }, [selectedDate]);
  const months = [shiftMonth(endMonth, -2), shiftMonth(endMonth, -1), endMonth];
  return <div className="replay-calendar-shell"><div className="replay-calendar-heading"><div><span>{t("replayChooseDate")}</span><strong>{selectedDate ? formatDate(`${selectedDate}T12:00:00Z`, locale, "longDate") : t("replayNoDate")}</strong></div><div><button type="button" onClick={() => setEndMonth((current) => shiftMonth(current, -1))} aria-label={t("replayPreviousMonth")}>←</button><button type="button" onClick={() => setEndMonth((current) => shiftMonth(current, 1))} aria-label={t("replayNextMonth")}>→</button></div></div><div className="replay-calendar-grid">{months.map((month) => <MonthCalendar key={month} month={month} activeDates={activeDates} selectedDate={selectedDate} onSelect={onSelect} locale={locale} />)}</div></div>;
}

function ReplayMap({ gps, timestampUtc, locale, t }) {
  const containerRef = useRef(null), mapRef = useRef(null), leafletRef = useRef(null), markerRef = useRef(null), lastPointRef = useRef(null), lastPanRef = useRef(0);
  const points = useMemo(() => safe(gps?.segments).flatMap((segment) => safe(segment)).filter((point) => finite(point?.lat) && finite(point?.lon)), [gps]);
  const lookup = useMemo(() => createTimestampLookup(points), [points]);
  useEffect(() => {
    let disposed = false, map;
    import("leaflet").then((module) => {
      if (disposed || !containerRef.current) return;
      const L = module.default || module;
      map = L.map(containerRef.current, { zoomControl: false, attributionControl: true, preferCanvas: true });
      mapRef.current = map; leafletRef.current = L;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      const lines = safe(gps?.segments).map((segment) => safe(segment).map((point) => [point.lat, point.lon])).filter((segment) => segment.length > 1);
      const layers = lines.map((line) => L.polyline(line, { color: "#20a983", weight: 4, opacity: .76 }).addTo(map));
      if (points.length) {
        const first = points[0], last = points.at(-1);
        L.circleMarker([first.lat, first.lon], { radius: 6, color: "#fff", weight: 3, fillColor: "#20a983", fillOpacity: 1 }).addTo(map);
        L.circleMarker([last.lat, last.lon], { radius: 6, color: "#fff", weight: 3, fillColor: "#0b2830", fillOpacity: 1 }).addTo(map);
      }
      if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [32, 32], maxZoom: 16 });
    });
    return () => { disposed = true; markerRef.current = null; mapRef.current = null; leafletRef.current = null; map?.remove(); };
  }, [gps, points]);
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current, point = nearestTimestampPoint(lookup, timestampUtc);
    if (!map || !L || !point || point === lastPointRef.current) return;
    lastPointRef.current = point;
    const position = [point.lat, point.lon];
    if (!markerRef.current) markerRef.current = L.circleMarker(position, { radius: 8, color: "#fff", weight: 3, fillColor: "#8a82d5", fillOpacity: 1 }).addTo(map);
    else markerRef.current.setLatLng(position);
    const now = performance.now();
    if (now - lastPanRef.current > 700) { map.panTo(position, { animate: true, duration: .35 }); lastPanRef.current = now; }
  }, [lookup, timestampUtc]);
  return <div ref={containerRef} className="replay-live-map" aria-label={t("replayLiveRoute")} />;
}

function ReplayMetric({ label, value, unit = "", tone = "neutral" }) {
  return <div className={`replay-analysis-metric tone-${tone}`}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;
}

function ReplayTelemetryRow({ label, value, unit = "", level = null, tone = "mint" }) {
  return <div className="replay-telemetry-row"><span>{label}</span><strong>{value}<small>{unit}</small></strong>{level == null ? <i /> : <div className={`replay-telemetry-level tone-${tone}`} aria-hidden="true"><b style={{ width: `${clamp(level, 0, 100)}%` }} /></div>}</div>;
}

function ReplayVehicleStatus({ point, playing, locale, t }) {
  const open = (field) => Number(point?.[field]) > 0;
  const currentTrunkState = finite(point?.trunkState) ? Number(point.trunkState) : null, currentTrunkProgress = trunkProgress(currentTrunkState), currentTrunkPhase = trunkPhase(currentTrunkState);
  const doors = { driver: open("driverDoorOpen"), passenger: open("passengerDoorOpen"), rearLeft: open("rearLeftDoorOpen"), rearRight: open("rearRightDoorOpen") };
  const anyDoorOpen = Object.values(doors).some(Boolean);
  const activeWindows = [
    ["frontLeftWindow", point?.frontLeftWindowPosition], ["frontRightWindow", point?.frontRightWindowPosition],
    ["rearLeftWindow", point?.rearLeftWindowPosition], ["rearRightWindow", point?.rearRightWindowPosition],
  ].filter(([, value]) => finite(value) && Number(value) >= 2 && Number(value) <= 5);
  const moving = playing && Number(point?.speedKmh) > 1;
  const braking = Number(point?.brakePct) > 0;
  const lowBeam = estimatedLowBeam(point?.timestampUtc);
  const steeringAngle = finite(point?.steeringAngleDeg) ? Number(point.steeringAngleDeg) : null;
  const frontWheelAngle = visualFrontWheelAngle(steeringAngle);
  return <section className="replay-vehicle-status"><header><strong>{t("replayVehicleStatus")}</strong><span className={moving ? "is-moving" : ""}><i />{moving ? t("replayInMotion") : t("replayStopped")}</span></header><div className="replay-vehicle-status-body"><div className={`replay-vehicle-asset ${lowBeam ? "is-low-beam" : ""} ${braking ? "is-braking" : ""}`} style={{ "--front-wheel-angle": `${frontWheelAngle}deg` }}><div className="replay-vehicle-frame">
    <img src={`${import.meta.env.BASE_URL}assets/replay/generic-suv-body.png`} alt={t("replayGenericVehicle")} />
    <span className="replay-front-lamp is-upper" aria-hidden="true"/><span className="replay-front-lamp is-lower" aria-hidden="true"/>
    <span className="replay-rear-lamp is-upper" aria-hidden="true"/><span className="replay-rear-lamp is-lower" aria-hidden="true"/>
    <span className="replay-front-wheel is-upper" aria-hidden="true"/><span className="replay-front-wheel is-lower" aria-hidden="true"/>
  </div></div><div className="replay-vehicle-status-list"><div><span>{t("replayDippedBeam")}</span><strong className={lowBeam ? "is-light" : "is-inactive"}><i />{lowBeam ? t("replayOn") : t("replayOff")}<small>{t("replayEstimatedTimeRule")}</small></strong></div><div><span>{t("replayBrakeLights")}</span><strong className={braking ? "is-braking" : "is-inactive"}><i />{braking ? t("replayOn") : t("replayOff")}</strong></div><div><span>{t("replayFrontWheelAngle")}</span><strong className="is-angle"><i />{steeringAngle == null ? "—" : `${numeric(steeringAngle, locale, 0)}°`}</strong></div><div><span>{t("replayRearDoors")}</span><strong className={anyDoorOpen ? "is-alert" : ""}><i />{anyDoorOpen ? t("replayOpen") : t("replayClosed")}</strong></div><div><span>{t("replayWindows")}</span><strong className={activeWindows.length ? "is-alert" : ""}><i />{activeWindows.length ? t("replayMoving") : t("replayNoMovement")}</strong></div><div><span>{t("replayBoot")}</span><strong className={currentTrunkProgress > 0 ? "is-alert" : ""}><i />{t(`replayTrunk_${currentTrunkPhase}`)}</strong></div></div></div></section>;
}

function ReplayTelemetry({ point, playing, locale, t, units }) {
  const speed = speedValue(point?.speedKmh, units.system), power = Number(point?.powerKw) || 0, steering = Number(point?.steeringAngleDeg) || 0;
  return <aside className="replay-telemetry-panel"><header><div><strong>{t("replayLiveTelemetry")}</strong><span>({formatDuration(point?.playbackMs)})</span></div><span className={playing && speed > 1 ? "is-moving" : ""}><i />{playing && speed > 1 ? t("replayInMotion") : t("replayStopped")}</span></header><div className="replay-telemetry-rows">
    <ReplayTelemetryRow label={t("speed")} value={numeric(speed, locale, 0)} unit={` ${speedUnit(units.system)}`} level={clamp(speed / (units.system === "imperial" ? 100 : 160) * 100, 0, 100)} tone="mint" />
    <ReplayTelemetryRow label={t("power")} value={numeric(power, locale)} unit=" kW" level={clamp((power + 50) / 2, 0, 100)} tone="violet" />
    <ReplayTelemetryRow label={t("soc")} value={numeric(point?.socPct, locale, 0)} unit="%" level={point?.socPct} tone="mint" />
    <ReplayTelemetryRow label={t("acceleratorPosition")} value={numeric(point?.acceleratorPct, locale, 0)} unit="%" level={point?.acceleratorPct} tone="cyan" />
    <ReplayTelemetryRow label={t("brakeSignal")} value={Number(point?.brakePct) > 0 ? t("replayActive") : t("replayInactive")} level={Number(point?.brakePct) > 0 ? 100 : 0} tone="coral" />
    <ReplayTelemetryRow label={t("steeringAngle")} value={numeric(steering, locale, 0)} unit="°" level={clamp((steering + 540) / 10.8, 0, 100)} tone="cyan" />
    <ReplayTelemetryRow label={t("replayBatteryTemperature")} value={numeric(temperatureValue(point?.batteryTempC, units.system), locale)} unit={` ${temperatureUnit(units.system)}`} level={clamp(((Number(point?.batteryTempC) || 0) + 20) / .8, 0, 100)} tone="coral" />
  </div><ReplayVehicleStatus point={point} playing={playing} locale={locale} t={t} /></aside>;
}

function replayEvents(timeline) {
  if (!timeline.length) return [];
  const total = Math.max(1, timeline.at(-1).playbackMs), events = [];
  const tracks = [
    ["acceleration", (point) => Number(point.acceleratorPct) >= 35 || Number(point.longitudinalG) >= .16],
    ["braking", (point) => Number(point.brakePct) > 0 || Number(point.longitudinalG) <= -.16],
    ["turns", (point) => Math.abs(Number(point.steeringAngleDeg) || 0) >= 35 || Math.abs(Number(point.lateralG) || 0) >= .16],
    ["doors", (point) => [point.driverDoorOpen, point.passengerDoorOpen, point.rearLeftDoorOpen, point.rearRightDoorOpen].some((value) => Number(value) > 0) || trunkProgress(point.trunkState) > 0],
    ["gaps", (point) => Number(point.sourceGapMs) > 60_000],
  ];
  for (const [type, matches] of tracks) {
    let previous = false;
    for (const point of timeline) {
      const active = matches(point);
      if (active && !previous) events.push({ type, position: clamp(point.playbackMs / total * 100, 0, 100) });
      previous = active;
    }
  }
  return events;
}

function signalPolyline(data, field, minimum, maximum) {
  const span = Math.max(.001, maximum - minimum);
  return data.map((entry) => {
    const x = clamp(entry.progress, 0, 1) * 1000;
    const y = 246 - clamp((Number(entry[field]) - minimum) / span, 0, 1) * 204;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function ReplayWithoutGps({ timeline, elapsedMs, journey, point, locale, t, units }) {
  const progress = timeline.at(-1)?.playbackMs ? clamp(elapsedMs / timeline.at(-1).playbackMs, 0, 1) : 0;
  const data = useMemo(() => {
    const step = Math.max(1, Math.ceil(timeline.length / 240));
    const rows = timeline.filter((_, index) => index % step === 0 || index === timeline.length - 1);
    const total = Math.max(1, timeline.at(-1)?.playbackMs || 1);
    return rows.map((entry) => ({
      progress: entry.playbackMs / total,
      speed: speedValue(entry.speedKmh, units.system),
      power: Number(entry.powerKw) || 0,
    }));
  }, [timeline, units.system]);
  const speedMaximum = Math.max(20, ...data.map((entry) => Number(entry.speed) || 0));
  const powerMinimum = Math.min(-10, ...data.map((entry) => Number(entry.power) || 0));
  const powerMaximum = Math.max(10, ...data.map((entry) => Number(entry.power) || 0));
  const events = useMemo(() => replayEvents(timeline).filter((event) => event.type !== "gaps"), [timeline]);
  const eventLabels = { acceleration: t("replayAcceleration"), braking: t("replayBraking"), turns: t("replayTurns"), doors: t("replayDoorActivity") };
  const currentPower = Number(point?.powerKw) || 0;
  const distance = distanceValue(journey.distanceKm, units.system);
  return <div className="replay-no-gps">
    <header><div><span>{t("replayNoGpsTitle")}</span><strong>{t("replayTelemetryJourney")}</strong><small>{t("replayTelemetryJourneyHelp")}</small></div><i>{t("replayWithoutGps")}</i></header>
    <div className="replay-no-gps-chart">
      <div className="replay-no-gps-legend"><span className="is-speed">{t("speed")} <b>{numeric(speedValue(point?.speedKmh, units.system), locale, 0)} {speedUnit(units.system)}</b></span><span className="is-power">{t("power")} <b>{numeric(currentPower, locale)} kW</b></span></div>
      <svg viewBox="0 0 1000 270" preserveAspectRatio="none" role="img" aria-label={t("replayTelemetryJourney")}>
        <g className="replay-no-gps-grid"><line x1="0" y1="42" x2="1000" y2="42"/><line x1="0" y1="110" x2="1000" y2="110"/><line x1="0" y1="178" x2="1000" y2="178"/><line x1="0" y1="246" x2="1000" y2="246"/></g>
        <polyline className="replay-no-gps-power" points={signalPolyline(data, "power", powerMinimum, powerMaximum)} />
        <polyline className="replay-no-gps-speed" points={signalPolyline(data, "speed", 0, speedMaximum)} />
      </svg>
      <div className="replay-no-gps-playhead" style={{ left: `${progress * 100}%` }}><i /></div>
    </div>
    <div className="replay-no-gps-events"><span>{t("replayEventTimeline")}</span><div>{events.map((event, index) => <i key={`${event.type}-${index}`} className={`is-${event.type}`} style={{ left: `${event.position}%` }} title={eventLabels[event.type]} />)}<b style={{ width: `${progress * 100}%` }} /></div></div>
    <div className="replay-no-gps-progress"><div><span>{t("replayJourneyProgress")}</span><strong>{numeric(progress * 100, locale, 0)}%</strong></div><div><span>{t("distance")}</span><strong>{numeric(distance, locale)} {distanceUnit(units.system)}</strong></div><div><span>{t("soc")}</span><strong>{numeric(point?.socPct, locale, 0)}%</strong></div></div>
    <p>{t("replayAddGpsHint")}</p>
  </div>;
}

function ReplayEventTimeline({ timeline, elapsedMs, totalMs, playing, rate, setRate, setPlaying, setElapsedMs, t }) {
  const events = useMemo(() => replayEvents(timeline), [timeline]);
  const tracks = [["acceleration", t("replayAcceleration")], ["braking", t("replayBraking")], ["turns", t("replayTurns")], ["doors", t("replayDoorActivity")], ["gaps", t("replayDataGaps")]];
  const progress = totalMs ? clamp(elapsedMs / totalMs * 100, 0, 100) : 0;
  return <section className="replay-event-workbench"><header><strong>{t("replayEventTimeline")}</strong><div className="replay-event-controls"><button className="replay-play" type="button" onClick={() => { if (elapsedMs >= totalMs) setElapsedMs(0); setPlaying((current) => !current || elapsedMs >= totalMs); }}><span>{playing ? t("replayPause") : t("replayPlay")}</span></button>{REPLAY_SPEEDS.map((speedOption) => <button key={speedOption} type="button" className={rate === speedOption ? "is-active" : ""} onClick={() => setRate(speedOption)}>{speedOption}×</button>)}</div></header><div className="replay-event-timeline"><div className="replay-event-labels"><i />{tracks.map(([, label]) => <span key={label}>{label}</span>)}</div><div className="replay-event-plot"><div className="replay-event-axis"><span>00:00</span><span>{formatDuration(totalMs / 2)}</span><span>{formatDuration(totalMs)}</span></div><div className="replay-event-playhead" style={{ left: `${progress}%` }}><b>{formatDuration(elapsedMs)}</b></div>{tracks.map(([type]) => <div className={`replay-event-track track-${type}`} key={type}>{events.filter((event) => event.type === type).map((event, index) => <i key={`${type}-${index}`} style={{ left: `${event.position}%` }} />)}</div>)}<input type="range" min="0" max={Math.max(1, totalMs)} step="100" value={elapsedMs} onChange={(event) => { setElapsedMs(Number(event.currentTarget.value)); setPlaying(false); }} aria-label={t("replayTimeline")} /></div></div></section>;
}

const StaticReplaySignalPlot = React.memo(function StaticReplaySignalPlot({ data, lines, unit, area, locale }) {
  const Plot = area ? AreaChart : LineChart;
  return <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 320, height: 143 }}><Plot data={data} margin={{ top: 6, right: 8, bottom: 0, left: -25 }}><CartesianGrid stroke="#e4ece9" vertical={false} /><XAxis dataKey="minute" tickFormatter={(value) => formatDuration(value * 60_000)} tick={{ fill: "#718783", fontSize: 7 }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis tick={{ fill: "#718783", fontSize: 7 }} axisLine={false} tickLine={false} unit={unit} width={54} /><Tooltip labelFormatter={(value) => formatDuration(value * 60_000)} formatter={(value, name) => [numeric(value, locale), lines.find((line) => line.key === name)?.label || name]} contentStyle={{ borderColor: "#dce7e3", borderRadius: 8, background: "#fff", color: "#183330", fontSize: 9 }} />{area ? <Area type="monotone" dataKey={lines[0].key} stroke={lines[0].color} fill={lines[0].color} fillOpacity={.12} strokeWidth={2} dot={false} isAnimationActive={false} /> : lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} isAnimationActive={false} />)}</Plot></ResponsiveContainer>;
});

function nearestChartPoint(data, minute) {
  if (!data.length) return { minute: 0 };
  let low = 0, high = data.length - 1;
  while (low <= high) { const middle = (low + high) >> 1; if (data[middle].minute < minute) low = middle + 1; else high = middle - 1; }
  const before = data[Math.max(0, high)], after = data[Math.min(data.length - 1, low)];
  return minute - before.minute <= after.minute - minute ? before : after;
}

function ReplaySignalChart({ title, data, lines, elapsedMs, unit = "", area = false, locale }) {
  const cursorMinute = elapsedMs / 60_000, current = nearestChartPoint(data, cursorMinute), totalMinutes = Number(data.at(-1)?.minute) || 1;
  const progress = clamp(cursorMinute / totalMinutes, 0, 1);
  return <section className="replay-signal-chart"><header><strong>{title}</strong><div>{lines.map((line) => <span key={line.key} style={{ "--signal-color": line.color }}>{line.label}<b>{numeric(current?.[line.key], locale)}{unit}</b></span>)}</div></header><div className="replay-signal-plot"><StaticReplaySignalPlot data={data} lines={lines} unit={unit} area={area} locale={locale}/><i className="replay-chart-cursor" style={{ left: `${progress * 100}%`, transform: `translateX(${34 - progress * 47}px)` }} aria-hidden="true" /></div></section>;
}

function ReplayAnalysisCharts({ timeline, elapsedMs, locale, t, units }) {
  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(timeline.length / 180));
    return timeline.filter((_, index) => index % step === 0 || index === timeline.length - 1).map((entry) => ({ minute: entry.playbackMs / 60_000, speed: speedValue(entry.speedKmh, units.system), power: Number(entry.powerKw) || 0, accelerator: Number(entry.acceleratorPct) || 0, brake: Number(entry.brakePct) > 0 ? 100 : 0, steering: Number(entry.steeringAngleDeg) || 0 }));
  }, [timeline, units.system]);
  const lines = useMemo(() => ({
    speed: [{ key: "speed", label: t("speed"), color: "#20a983" }],
    power: [{ key: "power", label: t("power"), color: "#7468e8" }],
    pedals: [{ key: "accelerator", label: t("acceleratorPosition"), color: "#5484f5" }, { key: "brake", label: t("brakeSignal"), color: "#f06658" }],
    steering: [{ key: "steering", label: t("steeringAngle"), color: "#27afe6" }],
  }), [t]);
  return <section className="replay-analysis-charts"><ReplaySignalChart title={`${t("speed")} (${speedUnit(units.system)})`} data={chartData} lines={lines.speed} elapsedMs={elapsedMs} locale={locale} area /><ReplaySignalChart title={`${t("power")} (kW)`} data={chartData} lines={lines.power} elapsedMs={elapsedMs} locale={locale} /><ReplaySignalChart title={t("replayPedalPosition")} data={chartData} lines={lines.pedals} elapsedMs={elapsedMs} unit="%" locale={locale} /><ReplaySignalChart title={`${t("steeringAngle")} (°)`} data={chartData} lines={lines.steering} elapsedMs={elapsedMs} locale={locale} /></section>;
}

function ReplayStage({ journey, trips, locale, t, units, onBack }) {
  const timeline = useMemo(() => buildReplayTimeline(journey, trips), [journey, trips]);
  const totalMs = replayDuration(timeline);
  const [elapsedMs, setElapsedMs] = useState(0), [playing, setPlaying] = useState(true), [rate, setRate] = useState(1);
  const lastFrameRef = useRef(null), lastPaintRef = useRef(0), pendingDeltaRef = useRef(0);
  useEffect(() => { setElapsedMs(0); setPlaying(true); lastFrameRef.current = null; pendingDeltaRef.current = 0; }, [journey?.journeyId]);
  useEffect(() => {
    if (!playing || !totalMs) return undefined;
    let frame;
    const tick = (now) => {
      if (lastFrameRef.current == null) lastFrameRef.current = now;
      const delta = Math.min(250, now - lastFrameRef.current); lastFrameRef.current = now; pendingDeltaRef.current += delta;
      if (now - lastPaintRef.current >= 80) {
        lastPaintRef.current = now;
        const accumulatedDelta = pendingDeltaRef.current; pendingDeltaRef.current = 0;
        setElapsedMs((current) => { const next = Math.min(totalMs, current + accumulatedDelta * rate); if (next >= totalMs) setPlaying(false); return next; });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); lastFrameRef.current = null; pendingDeltaRef.current = 0; };
  }, [playing, rate, totalMs]);
  const point = replayFrame(timeline, elapsedMs);
  const speed = speedValue(point?.speedKmh, units.system);
  const noTelemetry = !timeline.length;
  if (noTelemetry) return <div className="replay-empty"><strong>{t("replayNoTelemetry")}</strong><p>{t("replayNoTelemetryHelp")}</p><button type="button" onClick={onBack}>{t("replayBack")}</button></div>;
  return <div className="replay-experience"><div className="replay-experience-heading"><div><button type="button" onClick={onBack}>{t("replayBack")}</button><span><strong>{t("replayJourneyReplay")}</strong>{formatDate(journey.startedAtUtc, locale, "dateTime")}</span></div><strong>{numeric(distanceValue(journey.distanceKm, units.system), locale)} {distanceUnit(units.system)} · {numeric(journey.durationMinutes, locale, 0)} min</strong></div><div className="replay-mobile-notice"><strong>{t("replayDesktopRecommended")}</strong><span>{t("replayDesktopRecommendedHelp")}</span></div><div className="replay-studio">
    <section className={`replay-map-stage ${journey.gps ? "has-route" : "no-route"}`}>{journey.gps ? <ReplayMap gps={journey.gps} timestampUtc={point?.timestampUtc} locale={locale} t={t} /> : <ReplayWithoutGps timeline={timeline} elapsedMs={elapsedMs} journey={journey} point={point} locale={locale} t={t} units={units} />}<div className="replay-map-readout"><ReplayMetric label={t("speed")} value={numeric(speed, locale, 0)} unit={` ${speedUnit(units.system)}`} tone="mint" /><ReplayMetric label={t("elapsedTime")} value={formatDuration(elapsedMs)} tone="neutral" /></div></section>
    <ReplayTelemetry point={point} playing={playing} locale={locale} t={t} units={units} />
  </div><ReplayEventTimeline timeline={timeline} elapsedMs={elapsedMs} totalMs={totalMs} playing={playing} rate={rate} setRate={setRate} setPlaying={setPlaying} setElapsedMs={setElapsedMs} t={t} /><ReplayAnalysisCharts timeline={timeline} elapsedMs={elapsedMs} locale={locale} t={t} units={units} /><p className="replay-reconstruction-note">{point?.skippedGap ? t("replayGapCompressed") : t("replayReconstructionNotice")}</p></div>;
}

export default function Replay({ data, locale, t, units }) {
  const journeys = useMemo(() => safe(data.journeys).slice().sort((left, right) => String(right.startedAtUtc).localeCompare(String(left.startedAtUtc))), [data.journeys]);
  const initialDate = dateKey(journeys[0]?.startedAtUtc || journeys[0]?.date);
  const [selectedDate, setSelectedDate] = useState(initialDate), [selectedId, setSelectedId] = useState(journeys[0]?.journeyId || null), [started, setStarted] = useState(false);
  const stageRef = useRef(null);
  const dayJourneys = journeys.filter((journey) => dateKey(journey.startedAtUtc || journey.date) === selectedDate);
  const selected = dayJourneys.find((journey) => journey.journeyId === selectedId) || dayJourneys[0] || null;
  const chooseDate = (date) => { const first = journeys.find((journey) => dateKey(journey.startedAtUtc || journey.date) === date); setSelectedDate(date); setSelectedId(first?.journeyId || null); setStarted(false); };
  const start = () => { if (!selected) return; setStarted(true); requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  if (!journeys.length) return <div className="replay-empty"><strong>{t("replayNoJourneys")}</strong><p>{t("replayNoJourneysHelp")}</p></div>;
  return <div className="replay-page"><div className="replay-intro"><div><span>{t("replayKicker")}</span><h2>{t("replayTitle")}</h2><p>{t("replayIntro")}</p></div><span>{t("replayLocalBadge")}</span></div><ReplayCalendar journeys={journeys} selectedDate={selectedDate} onSelect={chooseDate} locale={locale} t={t} /><section className="replay-journey-picker"><header><div><span>{t("replayChooseJourney")}</span><strong>{dayJourneys.length} {t("journeysLower")}</strong></div>{selected ? <button type="button" onClick={start}>▶ {t("replayStart")}</button> : null}</header><div>{dayJourneys.map((journey) => <button key={journey.journeyId} type="button" className={selected?.journeyId === journey.journeyId ? "is-selected" : ""} onClick={() => { setSelectedId(journey.journeyId); setStarted(false); }}><span><strong>{formatDate(journey.startedAtUtc, locale, "time")}</strong><small>{numeric(journey.durationMinutes, locale, 0)} min · {safe(journey.tripIds).length} {t("segmentsLower")}</small></span><span><strong>{numeric(distanceValue(journey.distanceKm, units.system), locale)} {distanceUnit(units.system)}</strong><small>{journey.gps ? `⌖ ${t("routeAvailable")}` : t("replayWithoutGps")}</small></span></button>)}</div></section><div ref={stageRef}>{started && selected ? <ReplayStage journey={selected} trips={safe(data.trips)} locale={locale} t={t} units={units} onBack={() => setStarted(false)} /> : <div className="replay-ready"><div>▶</div><strong>{t("replayReadyTitle")}</strong><p>{t("replayReadyHelp")}</p></div>}</div></div>;
}
