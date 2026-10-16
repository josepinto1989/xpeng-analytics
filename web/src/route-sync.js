const safe = (rows) => Array.isArray(rows) ? rows : [];

export function telemetryPointFromChart(state, data) {
  const direct = safe(state?.activePayload).map((row) => row?.payload).find((row) => row?.timestampUtc);
  if (direct) return direct;
  const label = Number(state?.activeLabel);
  if (!Number.isFinite(label)) return null;
  return safe(data).reduce((closest, row) => Math.abs(Number(row.elapsed) - label) < Math.abs(Number(closest?.elapsed ?? Infinity) - label) ? row : closest, null);
}

export function createTimestampLookup(points) {
  return safe(points)
    .map((point) => ({ point, timestamp: Date.parse(point?.timestampUtc || "") }))
    .filter((entry) => Number.isFinite(entry.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function nearestTimestampPoint(pointsOrLookup, timestampUtc) {
  const target = Date.parse(timestampUtc || "");
  if (!Number.isFinite(target)) return null;
  const entries = safe(pointsOrLookup).length && Object.hasOwn(pointsOrLookup[0], "point")
    ? pointsOrLookup
    : createTimestampLookup(pointsOrLookup);
  if (!entries.length) return null;
  let low = 0, high = entries.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (entries[middle].timestamp < target) low = middle + 1;
    else if (entries[middle].timestamp > target) high = middle - 1;
    else return entries[middle].point;
  }
  const before = entries[Math.max(0, high)], after = entries[Math.min(entries.length - 1, low)];
  return (target - before.timestamp <= after.timestamp - target ? before : after).point;
}
