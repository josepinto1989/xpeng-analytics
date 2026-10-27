const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const sum = (items, field) => items.reduce((total, item) => total + (Number(item?.[field]) || 0), 0);

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function seasonFor(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]);
  if (month === 12) return { key: `${year + 1}-winter`, year: year + 1, season: "winter", order: (year + 1) * 4 };
  if (month <= 2) return { key: `${year}-winter`, year, season: "winter", order: year * 4 };
  if (month <= 5) return { key: `${year}-spring`, year, season: "spring", order: year * 4 + 1 };
  if (month <= 8) return { key: `${year}-summer`, year, season: "summer", order: year * 4 + 2 };
  return { key: `${year}-autumn`, year, season: "autumn", order: year * 4 + 3 };
}

function ensure(map, value) {
  const meta = seasonFor(value);
  if (!meta) return null;
  if (!map.has(meta.key)) map.set(meta.key, { ...meta, dates: new Set(), distanceKm: 0, netEnergyKwh: 0, regeneratedKwh: 0, journeys: 0, gpsJourneys: 0, charges: 0, wallEnergyKwh: 0, batteryEnergyKwh: 0, temperatures: [], contexts: { urban: 0, road: 0, motorway: 0 }, contextDistanceKm: 0 });
  return map.get(meta.key);
}

export function buildSeasonalPeriods(data) {
  const periods = new Map();
  rows(data?.daily).forEach((row) => { const period = ensure(periods, row?.date); if (!period) return; period.dates.add(String(row.date).slice(0, 10)); period.distanceKm += Number(row.distanceKm) || 0; period.netEnergyKwh += Number(row.netEnergyKwh) || 0; period.regeneratedKwh += Number(row.regeneratedKwh) || 0; });
  rows(data?.journeys).forEach((row) => { const period = ensure(periods, row?.date || row?.startedAtUtc); if (!period) return; period.journeys += 1; if (rows(row?.gps?.segments).length) period.gpsJourneys += 1; });
  rows(data?.charges).forEach((row) => { const period = ensure(periods, row?.date || row?.startedAtUtc); if (!period) return; period.charges += 1; period.wallEnergyKwh += Number(row.wallEnergyKwh) || 0; period.batteryEnergyKwh += Number(row.batteryEnergyKwh) || 0; });
  rows(data?.battery?.daily).forEach((row) => { const period = ensure(periods, row?.date); if (period && finite(row?.batteryTempMaxC)) period.temperatures.push(Number(row.batteryTempMaxC)); });
  rows(data?.driving?.contexts).forEach((row) => { const period = ensure(periods, row?.date); if (!period || !Object.hasOwn(period.contexts, row?.context)) return; const seconds = Number(row.seconds) || 0; period.contexts[row.context] += seconds; period.contextDistanceKm += Number(row.distanceKm) || 0; });
  return [...periods.values()].sort((a, b) => a.order - b.order).map((period) => {
    const contextSeconds = Object.values(period.contexts).reduce((total, value) => total + value, 0);
    const observedDays = period.dates.size;
    const reasons = [];
    if (observedDays < 14) reasons.push("days");
    if (period.distanceKm < 100) reasons.push("distance");
    if (period.journeys < 5) reasons.push("journeys");
    return {
      key: period.key, year: period.year, season: period.season, order: period.order,
      observedDays, distanceKm: period.distanceKm, journeys: period.journeys,
      consumptionKwh100: period.distanceKm > 0 ? period.netEnergyKwh / period.distanceKm * 100 : null,
      regeneratedKwh: period.regeneratedKwh,
      charges: period.charges,
      chargingEfficiencyPct: period.wallEnergyKwh > 0 ? period.batteryEnergyKwh / period.wallEnergyKwh * 100 : null,
      temperatureC: median(period.temperatures), temperatureDays: period.temperatures.length,
      gpsCoveragePct: period.journeys ? period.gpsJourneys / period.journeys * 100 : null,
      contexts: Object.fromEntries(Object.entries(period.contexts).map(([key, value]) => [key, contextSeconds ? value / contextSeconds * 100 : null])),
      contextSamples: contextSeconds, sufficient: reasons.length === 0, insufficientReasons: reasons,
    };
  });
}

export function compareSeasonalPeriods(first, second) {
  if (!first || !second || first.key === second.key) return { comparable: false, strength: "none", reasons: ["periods"] };
  const reasons = [];
  if (!first.sufficient || !second.sufficient) reasons.push("samples");
  const dayRatio = first.observedDays && second.observedDays ? first.observedDays / second.observedDays : 0;
  if (dayRatio < .5 || dayRatio > 2) reasons.push("coverage");
  if (!finite(first.consumptionKwh100) || !finite(second.consumptionKwh100)) reasons.push("consumption");
  const comparable = reasons.length === 0;
  const sampleFloor = Math.min(first.observedDays, second.observedDays);
  const strength = comparable ? (sampleFloor >= 45 && Math.min(first.distanceKm, second.distanceKm) >= 500 ? "high" : "medium") : "low";
  const delta = (current, baseline) => finite(current) && finite(baseline) && Number(baseline) !== 0 ? (Number(current) / Number(baseline) - 1) * 100 : null;
  return { comparable, strength, reasons, deltas: {
    distancePerDay: delta(first.distanceKm / first.observedDays, second.distanceKm / second.observedDays),
    consumption: delta(first.consumptionKwh100, second.consumptionKwh100),
    regeneration: delta(first.regeneratedKwh / first.distanceKm, second.regeneratedKwh / second.distanceKm),
    chargingEfficiency: delta(first.chargingEfficiencyPct, second.chargingEfficiencyPct),
    temperature: finite(first.temperatureC) && finite(second.temperatureC) ? first.temperatureC - second.temperatureC : null,
  } };
}
