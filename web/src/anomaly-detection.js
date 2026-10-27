const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const rows = (value) => Array.isArray(value) ? value : [];

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function detect(records, config) {
  const sorted = records
    .map((row) => ({ row, date: String(config.date(row) || "").slice(0, 10), value: Number(config.value(row)), group: config.group?.(row) || "all" }))
    .filter((item) => item.date && Number.isFinite(item.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const historyByGroup = new Map(), anomalies = [];
  for (const item of sorted) {
    const history = historyByGroup.get(item.group) || [], baselineRows = history.slice(-60);
    if (baselineRows.length >= config.minimum) {
      const baseline = median(baselineRows), mad = median(baselineRows.map((value) => Math.abs(value - baseline)));
      const scale = Math.max(config.minimumScale, (mad || 0) * 1.4826);
      const deviation = scale ? (item.value - baseline) / scale : 0;
      const flagged = config.direction === "high" ? deviation >= config.threshold : config.direction === "low" ? deviation <= -config.threshold : Math.abs(deviation) >= config.threshold;
      if (flagged) {
        const magnitude = Math.abs(deviation), baselineCount = baselineRows.length;
        anomalies.push({
          id: `${config.metric}-${item.group}-${item.date}-${anomalies.length}`,
          metric: config.metric,
          date: item.date,
          value: item.value,
          baseline,
          delta: item.value - baseline,
          changePct: baseline ? (item.value / baseline - 1) * 100 : null,
          direction: item.value >= baseline ? "high" : "low",
          comparisonSamples: baselineCount,
          comparisonStrength: baselineCount >= 15 && magnitude >= 4 ? "high" : baselineCount >= 10 || magnitude >= 3 ? "medium" : "low",
          group: item.group,
          sourceId: config.sourceId?.(item.row) || null,
        });
      }
    }
    history.push(item.value);
    historyByGroup.set(item.group, history);
  }
  return { anomalies, eligible: sorted.length, minimum: config.minimum };
}

export function detectPersonalAnomalies(data) {
  const dailyConsumption = rows(data?.daily).filter((row) => Number(row?.distanceKm) >= 10 && finite(row?.consumptionKwh100));
  const parkedLoss = rows(data?.battery?.parking).filter((row) => Number(row?.durationHours) >= 6 && Number(row?.coveragePct) >= 40 && row?.confidence !== "low" && finite(row?.socLossPerDay));
  const chargingEfficiency = rows(data?.charges).filter((row) => Number(row?.wallEnergyKwh) > 0 && finite(row?.efficiencyPct));
  const batteryTemperature = rows(data?.battery?.daily).filter((row) => finite(row?.batteryTempMaxC));
  const tyrePressure = rows(data?.battery?.tyres).filter((row) => finite(row?.averageKpa));
  const tyreImbalance = rows(data?.battery?.tyres).filter((row) => finite(row?.frontImbalanceKpa) || finite(row?.rearImbalanceKpa));
  const results = [
    detect(dailyConsumption, { metric: "consumption", date: (row) => row.date, value: (row) => row.consumptionKwh100, sourceId: (row) => row.date, minimum: 7, minimumScale: 2, threshold: 2.5, direction: "high" }),
    detect(parkedLoss, { metric: "parkedLoss", date: (row) => row.startedAtUtc, value: (row) => row.socLossPerDay, sourceId: (row) => row.stopId, minimum: 6, minimumScale: .25, threshold: 2.5, direction: "high" }),
    detect(chargingEfficiency, { metric: "chargingEfficiency", date: (row) => row.date || row.startedAtUtc, value: (row) => row.efficiencyPct, group: (row) => row.chargeType || "unknown", sourceId: (row) => row.chargeId, minimum: 5, minimumScale: 2.5, threshold: 2.5, direction: "low" }),
    detect(batteryTemperature, { metric: "batteryTemperature", date: (row) => row.date, value: (row) => row.batteryTempMaxC, sourceId: (row) => row.date, minimum: 7, minimumScale: 4, threshold: 2.5, direction: "high" }),
    detect(tyrePressure, { metric: "tyrePressure", date: (row) => row.date, value: (row) => row.averageKpa, sourceId: (row) => row.date, minimum: 7, minimumScale: 5, threshold: 2.5, direction: "both" }),
    detect(tyreImbalance, { metric: "tyreImbalance", date: (row) => row.date, value: (row) => Math.max(Number(row.frontImbalanceKpa) || 0, Number(row.rearImbalanceKpa) || 0), sourceId: (row) => row.date, minimum: 7, minimumScale: 3, threshold: 2.5, direction: "high" }),
  ];
  const anomalies = results.flatMap((result) => result.anomalies).sort((a, b) => b.date.localeCompare(a.date) || b.comparisonStrength.localeCompare(a.comparisonStrength));
  const coverage = Object.fromEntries(["consumption", "parkedLoss", "chargingEfficiency", "batteryTemperature", "tyrePressure", "tyreImbalance"].map((metric, index) => [metric, { eligible: results[index].eligible, minimum: results[index].minimum, ready: results[index].eligible > results[index].minimum }]));
  return { anomalies, coverage };
}
