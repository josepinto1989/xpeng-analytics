const finite = (value) => Number.isFinite(Number(value));
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function daySpan(history) {
  const dates = history.map((row) => Date.parse(`${String(row?.date || "").slice(0, 10)}T12:00:00Z`)).filter(Number.isFinite);
  return dates.length > 1 ? Math.max(0, Math.round((Math.max(...dates) - Math.min(...dates)) / 86_400_000)) : 0;
}

export function assessBatteryHealth(history) {
  const rows = Array.isArray(history) ? history.filter((row) => finite(row?.capacityKwh)) : [];
  const sampleCount = rows.length;
  const spanDays = daySpan(rows);
  const capacities = rows.map((row) => Number(row.capacityKwh));
  const capacityMedianKwh = median(capacities);
  const absoluteDeviations = capacities.map((value) => Math.abs(value - capacityMedianKwh));
  const variabilityPct = capacityMedianKwh ? median(absoluteDeviations) / capacityMedianKwh * 100 : null;
  const medianSocGainPct = median(rows.map((row) => row.socGainPct));

  const sampleScore = clamp(sampleCount / 8) * 45;
  const spanScore = clamp(spanDays / 90) * 25;
  const gainScore = clamp(((medianSocGainPct || 20) - 20) / 40) * 15;
  const consistencyScore = variabilityPct == null ? 0 : clamp(1 - variabilityPct / 10) * 15;
  const score = Math.round(sampleScore + spanScore + gainScore + consistencyScore);
  const level = sampleCount < 3 ? "insufficient" : score >= 75 && sampleCount >= 8 && spanDays >= 60 ? "high" : score >= 50 ? "medium" : "low";
  const first = rows[0], latest = rows.at(-1);
  const relativeChangePct = finite(first?.rollingCapacityKwh) && finite(latest?.rollingCapacityKwh) && Number(first.rollingCapacityKwh)
    ? (Number(latest.rollingCapacityKwh) / Number(first.rollingCapacityKwh) - 1) * 100
    : null;
  const reasons = [];
  if (sampleCount < 3) reasons.push("fewSamples");
  else if (sampleCount < 8) reasons.push("growingSample");
  else reasons.push("enoughSamples");
  if (spanDays < 30) reasons.push("shortWindow");
  else if (spanDays < 90) reasons.push("mediumWindow");
  else reasons.push("longWindow");
  if (variabilityPct != null && variabilityPct > 7) reasons.push("highVariability");
  else if (variabilityPct != null && variabilityPct <= 3) reasons.push("stableEstimates");

  return { level, score, sampleCount, spanDays, capacityMedianKwh, variabilityPct, medianSocGainPct, relativeChangePct, reasons };
}
