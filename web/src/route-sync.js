const safe = (rows) => Array.isArray(rows) ? rows : [];

export function telemetryPointFromChart(state, data) {
  const direct = safe(state?.activePayload).map((row) => row?.payload).find((row) => row?.timestampUtc);
  if (direct) return direct;
  const label = Number(state?.activeLabel);
  if (!Number.isFinite(label)) return null;
  return safe(data).reduce((closest, row) => Math.abs(Number(row.elapsed) - label) < Math.abs(Number(closest?.elapsed ?? Infinity) - label) ? row : closest, null);
}

export function nearestTimestampPoint(points, timestampUtc) {
  const target = Date.parse(timestampUtc || ""), rows = safe(points);
  if (!Number.isFinite(target) || !rows.length) return null;
  let closest = null, smallestDelta = Infinity;
  for (const point of rows) {
    const timestamp = Date.parse(point?.timestampUtc || "");
    if (!Number.isFinite(timestamp)) continue;
    const delta = Math.abs(timestamp - target);
    if (delta < smallestDelta) { closest = point; smallestDelta = delta; }
  }
  return closest;
}
