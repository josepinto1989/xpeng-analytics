const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const monthOf = (value) => String(value || "").slice(0, 7);
const sum = (items, field) => items.reduce((total, item) => total + (Number(item?.[field]) || 0), 0);

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedRatio(items, numerator, denominator, multiplier = 1) {
  const top = sum(items, numerator), bottom = sum(items, denominator);
  return bottom > 0 ? top / bottom * multiplier : null;
}

function pctChange(current, previous) {
  return finite(current) && finite(previous) && Number(previous) !== 0
    ? (Number(current) / Number(previous) - 1) * 100
    : null;
}

function monthRows(data, month) {
  const daily = rows(data?.daily).filter((row) => monthOf(row?.date) === month);
  const journeys = rows(data?.journeys).filter((row) => monthOf(row?.date || row?.startedAtUtc) === month);
  const charges = rows(data?.charges).filter((row) => monthOf(row?.date || row?.startedAtUtc) === month);
  const parking = rows(data?.battery?.parking).filter((row) => monthOf(row?.startedAtUtc) === month);
  const health = rows(data?.battery?.history).filter((row) => monthOf(row?.date) === month);
  const batteryDaily = rows(data?.battery?.daily).filter((row) => monthOf(row?.date) === month);
  return { daily, journeys, charges, parking, health, batteryDaily };
}

function buildMonth(data, month, energyPrice) {
  const source = monthRows(data, month), observedDates = new Set();
  for (const row of source.daily) if (row?.date) observedDates.add(String(row.date).slice(0, 10));
  for (const row of source.batteryDaily) if (row?.date) observedDates.add(String(row.date).slice(0, 10));
  for (const row of source.parking) if (row?.startedAtUtc) observedDates.add(String(row.startedAtUtc).slice(0, 10));
  const distanceKm = sum(source.daily, "distanceKm"), netEnergyKwh = sum(source.daily, "netEnergyKwh");
  const wallEnergyKwh = sum(source.charges, "wallEnergyKwh"), batteryEnergyKwh = sum(source.charges, "batteryEnergyKwh");
  const gpsJourneys = source.journeys.filter((row) => rows(row?.gps?.segments).length > 0).length;
  const observedDays = observedDates.size;
  return {
    month,
    observedDays,
    distanceKm,
    distancePerObservedDay: observedDays ? distanceKm / observedDays : null,
    journeys: source.journeys.length,
    journeysPerObservedDay: observedDays ? source.journeys.length / observedDays : null,
    consumptionKwh100: distanceKm > 0 ? netEnergyKwh / distanceKm * 100 : null,
    regeneratedKwh: sum(source.daily, "regeneratedKwh"),
    charges: source.charges.length,
    wallEnergyKwh,
    wallEnergyPerObservedDay: observedDays ? wallEnergyKwh / observedDays : null,
    batteryEnergyKwh,
    chargingEfficiencyPct: wallEnergyKwh > 0 ? batteryEnergyKwh / wallEnergyKwh * 100 : null,
    estimatedCost: finite(energyPrice) && Number(energyPrice) >= 0 ? wallEnergyKwh * Number(energyPrice) : null,
    parkedEnergyKwh: sum(source.parking, "energyKwh"),
    parkedLossPctPerDay: median(source.parking.filter((row) => Number(row?.durationHours) >= 6 && finite(row?.socLossPerDay)).map((row) => row.socLossPerDay)),
    estimatedCapacityKwh: median(source.health.map((row) => row?.rollingCapacityKwh ?? row?.capacityKwh)),
    relativeSohPct: median(source.health.map((row) => row?.relativeSohPct)),
    batteryTemperatureMaxC: median(source.batteryDaily.map((row) => row?.batteryTempMaxC)),
    gpsJourneys,
    gpsCoveragePct: source.journeys.length ? gpsJourneys / source.journeys.length * 100 : null,
    sampleCounts: { health: source.health.length, parking: source.parking.length, batteryDays: source.batteryDaily.length },
  };
}

function comparison(current, previous) {
  if (!previous || current.observedDays < 3 || previous.observedDays < 3) return { comparable: false, changes: [] };
  const ratio = current.observedDays / previous.observedDays;
  if (ratio < .6 || ratio > 1.67) return { comparable: false, changes: [] };
  const candidates = [
    ["distance", current.distancePerObservedDay, previous.distancePerObservedDay],
    ["journeys", current.journeysPerObservedDay, previous.journeysPerObservedDay],
    ["consumption", current.consumptionKwh100, previous.consumptionKwh100],
    ["charging", current.wallEnergyPerObservedDay, previous.wallEnergyPerObservedDay],
    ["efficiency", current.chargingEfficiencyPct, previous.chargingEfficiencyPct],
    ["parkedLoss", current.parkedLossPctPerDay, previous.parkedLossPctPerDay],
  ];
  const changes = candidates.map(([metric, value, baseline]) => ({ metric, value: pctChange(value, baseline) }))
    .filter((item) => finite(item.value) && Math.abs(item.value) >= 10)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { comparable: true, changes: changes.slice(0, 4) };
}

function previousCalendarMonth(month) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthlySummaries(data, { energyPrice = null } = {}) {
  const months = new Set();
  const add = (value) => { const month = monthOf(value); if (/^\d{4}-\d{2}$/.test(month)) months.add(month); };
  rows(data?.daily).forEach((row) => add(row?.date));
  rows(data?.journeys).forEach((row) => add(row?.date || row?.startedAtUtc));
  rows(data?.charges).forEach((row) => add(row?.date || row?.startedAtUtc));
  rows(data?.battery?.parking).forEach((row) => add(row?.startedAtUtc));
  rows(data?.battery?.history).forEach((row) => add(row?.date));
  rows(data?.battery?.daily).forEach((row) => add(row?.date));
  const summaries = [...months].sort().map((month) => buildMonth(data, month, energyPrice));
  return summaries.map((summary, index) => {
    const candidate = summaries[index - 1], previous = candidate?.month === previousCalendarMonth(summary.month) ? candidate : null;
    return { ...summary, comparison: comparison(summary, previous), previousMonth: previous?.month || null };
  });
}
