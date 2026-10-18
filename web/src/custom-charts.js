import { consumptionUnit, consumptionValue, distanceUnit, distanceValue, pressureUnitLabel, pressureValue, speedUnit, speedValue, temperatureUnit, temperatureValue } from "./units.js";

export const CUSTOM_CHARTS_VERSION = 1;
export const CUSTOM_CHART_LIMITS = Object.freeze({ charts: 24, series: 3, title: 80, description: 240 });
export const CHART_TYPES = Object.freeze(["line", "area", "bar", "scatter", "histogram"]);
export const CHART_PERIODS = Object.freeze(["7", "15", "30", "all", "custom"]);
export const CHART_GROUPS = Object.freeze(["none", "day", "month"]);

const metric = (key, label, unit = "number", aggregate = "average") => ({ key, label, unit, aggregate });
const time = (key, label) => ({ key, label, temporal: true });

export const CHART_DATASETS = Object.freeze({
  telemetry: {
    label: "chartDatasetTelemetry", path: ["trips"], defaultX: "timestampUtc",
    x: [time("timestampUtc", "dateAndTime"), metric("elapsedMinutes", "elapsedTime", "minutes"), metric("speedKmh", "speed", "speed"), metric("powerKw", "power", "power")],
    y: [metric("speedKmh", "speed", "speed"), metric("speedPeakKmh", "peakSpeed", "speed", "max"), metric("powerKw", "power", "power"), metric("powerPeakKw", "peakPower", "power", "max"), metric("socPct", "soc", "percent"), metric("displayedRangeKm", "displayedRange", "distance"), metric("batteryTempC", "batteryTemperature", "temperature"), metric("acceleratorPct", "averageAccelerator", "percent"), metric("acceleratorPeakPct", "peakAccelerator", "percent", "max"), metric("brakePct", "brakeActive", "percent"), metric("longitudinalG", "longitudinalAcceleration", "g"), metric("lateralG", "lateralAcceleration", "g"), metric("rearMotorRpm", "rearMotorSpeed", "number"), metric("rearMotorTorqueNm", "rearMotorTorque", "number")],
  },
  daily: {
    label: "chartDatasetDaily", path: ["daily"], defaultX: "date",
    x: [time("date", "date")],
    y: [metric("distanceKm", "distance", "distance", "sum"), metric("drivingHours", "drivingTime", "hours", "sum"), metric("energyUsedKwh", "energyUsed", "energy", "sum"), metric("netEnergyKwh", "netEnergy", "energy", "sum"), metric("regeneratedKwh", "regeneratedEnergy", "energy", "sum"), metric("consumptionKwh100", "averageConsumption", "consumption"), metric("wallEnergyKwh", "gridEnergy", "energy", "sum"), metric("batteryEnergyKwh", "batteryEnergy", "energy", "sum"), metric("trips", "trips", "count", "sum"), metric("journeys", "journeys", "count", "sum"), metric("charges", "chargingSessions", "count", "sum")],
  },
  trips: {
    label: "chartDatasetTrips", path: ["trips"], defaultX: "startedAtUtc",
    x: [time("startedAtUtc", "dateAndTime"), metric("distanceKm", "distance", "distance"), metric("durationMinutes", "duration", "minutes"), metric("maxSpeedKmh", "maximumSpeed", "speed")],
    y: [metric("distanceKm", "distance", "distance", "sum"), metric("durationMinutes", "duration", "minutes", "sum"), metric("maxSpeedKmh", "maximumSpeed", "speed", "max"), metric("avgSpeedKmh", "averageSpeed", "speed"), metric("energyUsedKwh", "energyUsed", "energy", "sum"), metric("netEnergyKwh", "netEnergy", "energy", "sum"), metric("regeneratedKwh", "regeneratedEnergy", "energy", "sum"), metric("regenerationSharePct", "regenerationShare", "percent"), metric("consumptionKwh100", "averageConsumption", "consumption"), metric("socStartPct", "startSoc", "percent"), metric("socEndPct", "endSoc", "percent"), metric("batteryTempMaxC", "maximumTemperature", "temperature", "max"), metric("maxAccelerationG", "maximumAcceleration", "g", "max"), metric("maxBrakingG", "maximumBraking", "g", "max"), metric("maxLateralG", "maximumCornering", "g", "max")],
  },
  journeys: {
    label: "chartDatasetJourneys", path: ["journeys"], defaultX: "startedAtUtc",
    x: [time("startedAtUtc", "dateAndTime"), metric("distanceKm", "distance", "distance"), metric("durationMinutes", "duration", "minutes")],
    y: [metric("distanceKm", "distance", "distance", "sum"), metric("durationMinutes", "duration", "minutes", "sum"), metric("drivingMinutes", "drivingTime", "minutes", "sum"), metric("stoppedMinutes", "stoppedTime", "minutes", "sum"), metric("maxSpeedKmh", "maximumSpeed", "speed", "max"), metric("energyUsedKwh", "energyUsed", "energy", "sum"), metric("netEnergyKwh", "netEnergy", "energy", "sum"), metric("regeneratedKwh", "regeneratedEnergy", "energy", "sum"), metric("regenerationSharePct", "regenerationShare", "percent"), metric("consumptionKwh100", "averageConsumption", "consumption")],
  },
  charges: {
    label: "chartDatasetCharges", path: ["charges"], defaultX: "startedAtUtc",
    x: [time("startedAtUtc", "dateAndTime"), metric("durationMinutes", "duration", "minutes"), metric("batteryEnergyKwh", "batteryEnergy", "energy")],
    y: [metric("batteryEnergyKwh", "batteryEnergy", "energy", "sum"), metric("wallEnergyKwh", "gridEnergy", "energy", "sum"), metric("lossKwh", "estimatedLosses", "energy", "sum"), metric("efficiencyPct", "chargeEfficiency", "percent"), metric("durationMinutes", "duration", "minutes", "sum"), metric("maxPowerKw", "maximumPower", "power", "max"), metric("socStartPct", "startSoc", "percent"), metric("socEndPct", "endSoc", "percent"), metric("batteryTempMaxC", "maximumTemperature", "temperature", "max")],
  },
  battery: {
    label: "chartDatasetBattery", path: ["battery", "history"], defaultX: "date",
    x: [time("date", "date")],
    y: [metric("capacityKwh", "estimatedCapacity", "energy"), metric("rollingCapacityKwh", "rollingCapacity", "energy"), metric("relativeSohPct", "relativeSoh", "percent"), metric("socGainPct", "socGain", "percent")],
  },
  tyres: {
    label: "chartDatasetTyres", path: ["battery", "tyres"], defaultX: "date",
    x: [time("date", "date")],
    y: [metric("frontLeftKpa", "frontLeftTyre", "pressure"), metric("frontRightKpa", "frontRightTyre", "pressure"), metric("rearLeftKpa", "rearLeftTyre", "pressure"), metric("rearRightKpa", "rearRightTyre", "pressure"), metric("averageKpa", "averagePressure", "pressure"), metric("frontImbalanceKpa", "frontAxleImbalance", "pressure"), metric("rearImbalanceKpa", "rearAxleImbalance", "pressure"), metric("batteryTempMinC", "minimumTemperature", "temperature")],
  },
  parking: {
    label: "chartDatasetParking", path: ["battery", "parking"], defaultX: "startedAtUtc",
    x: [time("startedAtUtc", "dateAndTime"), metric("durationHours", "duration", "hours")],
    y: [metric("durationHours", "duration", "hours", "sum"), metric("socLossPct", "socLoss", "percent", "sum"), metric("socLossPerDay", "parkedLossPerDay", "percent"), metric("energyKwh", "energy", "energy", "sum"), metric("averageWatts", "parkedPower", "watts"), metric("coveragePct", "coverage", "percent")],
  },
  monthly: {
    label: "chartDatasetMonthly", path: ["activity", "monthly"], defaultX: "month",
    x: [time("month", "month")],
    y: [metric("distanceKm", "distance", "distance", "sum"), metric("netEnergyKwh", "netEnergy", "energy", "sum"), metric("trips", "trips", "count", "sum"), metric("journeys", "journeys", "count", "sum"), metric("charges", "chargingSessions", "count", "sum")],
  },
});

const cleanText = (value, max) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const finite = (value) => Number.isFinite(Number(value));
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function defaultCustomChart(dataset = "daily") {
  const source = CHART_DATASETS[dataset] || CHART_DATASETS.daily;
  return { id: "", title: "", description: "", dataset, type: "line", x: source.defaultX, y: source.y.slice(0, 2).map((field) => field.key), period: "all", start: "", end: "", groupBy: "none" };
}

export function validateCustomCharts(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set(), output = [];
  for (const raw of input.slice(0, CUSTOM_CHART_LIMITS.charts * 2)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const dataset = String(raw.dataset || ""), source = CHART_DATASETS[dataset];
    if (!source) continue;
    const type = CHART_TYPES.includes(raw.type) ? raw.type : "line";
    const allFields = [...source.x, ...source.y.filter((field) => !source.x.some((candidate) => candidate.key === field.key))];
    const allowedX = new Set(allFields.map((field) => field.key));
    const allowedY = new Set(source.y.map((field) => field.key));
    const numericFields = allFields.filter((field) => !field.temporal);
    const requestedX = allowedX.has(raw.x) ? raw.x : source.defaultX;
    const x = (type === "scatter" || type === "histogram") && allFields.find((field) => field.key === requestedX)?.temporal ? numericFields[0]?.key || requestedX : requestedX;
    let y = Array.isArray(raw.y) ? [...new Set(raw.y.filter((key) => allowedY.has(key)))].slice(0, CUSTOM_CHART_LIMITS.series) : [];
    if (type === "histogram") y = [];
    if (type !== "histogram" && !y.length) y = source.y.slice(0, type === "scatter" ? 1 : 2).map((field) => field.key);
    if (type === "scatter") y = y.slice(0, 1);
    const requestedId = cleanText(raw.id, 64) || `chart-${output.length + 1}`;
    let id = requestedId, suffix = output.length + 1;
    while (seen.has(id)) id = `${requestedId}-${suffix++}`;
    seen.add(id);
    output.push({
      id,
      title: cleanText(raw.title, CUSTOM_CHART_LIMITS.title),
      description: cleanText(raw.description, CUSTOM_CHART_LIMITS.description),
      dataset,
      type,
      x,
      y,
      period: CHART_PERIODS.includes(raw.period) ? raw.period : "all",
      start: validDate(raw.start) ? raw.start : "",
      end: validDate(raw.end) ? raw.end : "",
      groupBy: CHART_GROUPS.includes(raw.groupBy) ? raw.groupBy : "none",
    });
    if (output.length >= CUSTOM_CHART_LIMITS.charts) break;
  }
  return output;
}

export function datasetRows(data, dataset) {
  const source = CHART_DATASETS[dataset];
  if (dataset === "telemetry") return Array.isArray(data?.trips) ? data.trips.flatMap((trip) => Array.isArray(trip.series) ? trip.series : []) : [];
  return source?.path.reduce((value, key) => value?.[key], data) || [];
}

function dateKey(value) { return String(value || "").slice(0, 10); }
function periodFilter(rows, config) {
  if (config.period === "all") return rows;
  const source = CHART_DATASETS[config.dataset];
  const dateField = source.x.find((field) => field.temporal);
  if (!dateField) return rows;
  const dated = rows.map((row) => ({ row, date: dateKey(row[dateField.key]) })).filter((item) => validDate(item.date));
  const maxDate = dated.map((item) => item.date).sort().at(-1);
  if (!maxDate) return [];
  let start = config.start, end = config.end;
  if (config.period !== "custom") {
    const boundary = new Date(`${maxDate}T00:00:00Z`);
    boundary.setUTCDate(boundary.getUTCDate() - Number(config.period) + 1);
    start = boundary.toISOString().slice(0, 10); end = maxDate;
  }
  if (start && end && start > end) [start, end] = [end, start];
  return dated.filter((item) => (!start || item.date >= start) && (!end || item.date <= end)).map((item) => item.row);
}

export function chartUnit(field, units) {
  if (!field) return "";
  return ({ distance: distanceUnit(units.system), speed: speedUnit(units.system), consumption: consumptionUnit(units.system), temperature: temperatureUnit(units.system), pressure: pressureUnitLabel(units.pressure), energy: "kWh", percent: "%", power: "kW", watts: "W", minutes: "min", hours: "h", g: "g" })[field.unit] || "";
}

function converted(value, field, units) {
  if (!finite(value)) return null;
  const number = Number(value);
  if (field.unit === "distance") return distanceValue(number, units.system);
  if (field.unit === "speed") return speedValue(number, units.system);
  if (field.unit === "consumption") return consumptionValue(number, units.system);
  if (field.unit === "temperature") return temperatureValue(number, units.system);
  if (field.unit === "pressure") return pressureValue(number, units.pressure);
  return number;
}

function aggregate(values, mode) {
  const valid = values.filter(finite).map(Number);
  if (!valid.length) return null;
  if (mode === "sum") return valid.reduce((total, value) => total + value, 0);
  if (mode === "max") return Math.max(...valid);
  if (mode === "min") return Math.min(...valid);
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function sampleRows(rows, limit = 700) {
  if (rows.length <= limit) return rows;
  const output = [], step = (rows.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index++) output.push(rows[Math.round(index * step)]);
  return output;
}

export function buildCustomChart(data, rawConfig, units, locale = "en") {
  const config = validateCustomCharts([{ ...rawConfig, id: rawConfig?.id || "preview" }])[0] || defaultCustomChart();
  const source = CHART_DATASETS[config.dataset], allFields = [...source.x, ...source.y.filter((field) => !source.x.some((candidate) => candidate.key === field.key))], xField = allFields.find((field) => field.key === config.x) || source.x[0];
  const yFields = config.y.map((key) => source.y.find((field) => field.key === key)).filter(Boolean);
  let rows = periodFilter(Array.isArray(datasetRows(data, config.dataset)) ? datasetRows(data, config.dataset) : [], config);
  rows = rows.filter((row) => xField.temporal ? Boolean(row[xField.key]) : finite(row[xField.key]));
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "2-digit" });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const labelFor = (value) => {
    if (!xField.temporal) return converted(value, xField, units);
    const normalized = String(value).length === 7 ? `${value}-01T00:00:00Z` : value;
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime())) return String(value);
    return String(value).length > 10 ? dateTimeFormatter.format(date) : dateFormatter.format(date);
  };
  if (config.type === "histogram") {
    const values = rows.map((row) => converted(row[xField.key], xField, units)).filter(finite).map(Number);
    if (!values.length) return { config, rows: [], series: [], xField, missing: true };
    const min = Math.min(...values), max = Math.max(...values), binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length)))), width = max === min ? 1 : (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({ __x: `${(min + index * width).toFixed(1)}–${(min + (index + 1) * width).toFixed(1)}`, __count: 0 }));
    values.forEach((value) => bins[Math.min(binCount - 1, Math.floor((value - min) / width))].__count++);
    return { config, rows: bins, series: [{ key: "__count", label: "chartFrequency", unit: "count" }], xField, xKey: "__x", missing: false };
  }
  if (config.groupBy !== "none" && xField.temporal) {
    const groups = new Map();
    rows.forEach((row) => { const date = dateKey(row[xField.key]); const key = config.groupBy === "month" ? date.slice(0, 7) : date; if (key) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); } });
    rows = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({ __x: labelFor(key), ...Object.fromEntries(yFields.map((field) => [field.key, aggregate(group.map((row) => converted(row[field.key], field, units)), field.aggregate)])) }));
  } else {
    if (xField.temporal) rows = rows.slice().sort((a, b) => String(a[xField.key]).localeCompare(String(b[xField.key])));
    rows = sampleRows(rows).map((row) => ({ __x: labelFor(row[xField.key]), ...Object.fromEntries(yFields.map((field) => [field.key, converted(row[field.key], field, units)])) }));
  }
  const available = yFields.filter((field) => rows.some((row) => finite(row[field.key])));
  return { config, rows, series: available, xField, xKey: "__x", missing: !rows.length || !available.length };
}
