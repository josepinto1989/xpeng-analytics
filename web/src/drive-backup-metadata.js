const rows = (value) => Array.isArray(value) ? value : [];

function iso(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function telemetryCoverage(snapshot) {
  const starts = [];
  const ends = [];
  for (const item of rows(snapshot?.quality?.coverage)) {
    const start = iso(item?.firstUtc);
    const end = iso(item?.lastUtc);
    if (start) starts.push(start);
    if (end) ends.push(end);
  }
  const overviewStart = iso(snapshot?.overview?.firstUtc);
  const overviewEnd = iso(snapshot?.overview?.lastUtc);
  if (overviewStart) starts.push(overviewStart);
  if (overviewEnd) ends.push(overviewEnd);
  if (!starts.length || !ends.length) return { startUtc: null, endUtc: null };
  return {
    startUtc: starts.sort().at(0),
    endUtc: ends.sort().at(-1),
  };
}

export function buildDriveBackupMetadata(snapshot, historyVersion = 0) {
  const coverage = telemetryCoverage(snapshot);
  return {
    coverageStartUtc: coverage.startUtc,
    coverageEndUtc: coverage.endUtc,
    historyVersion: Math.max(0, Number(historyVersion || 0)),
    importCount: rows(snapshot?.imports).length,
    generatedAtUtc: iso(snapshot?.generatedAtUtc) || new Date().toISOString(),
  };
}

export function detectLikelyImportGaps(imports, thresholdHours = 48) {
  const thresholdMs = Math.max(1, Number(thresholdHours || 48)) * 3600_000;
  const periods = rows(imports)
    .map((item) => ({
      startUtc: iso(item?.sourceStartUtc),
      endUtc: iso(item?.sourceEndUtc),
    }))
    .filter((item) => item.startUtc && item.endUtc && item.endUtc >= item.startUtc)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  if (periods.length < 2) return [];
  const merged = [];
  for (const period of periods) {
    const previous = merged.at(-1);
    if (!previous || period.startUtc > previous.endUtc) merged.push({ ...period });
    else if (period.endUtc > previous.endUtc) previous.endUtc = period.endUtc;
  }
  const gaps = [];
  for (let index = 1; index < merged.length; index += 1) {
    const before = merged[index - 1];
    const after = merged[index];
    const durationMs = new Date(after.startUtc).getTime() - new Date(before.endUtc).getTime();
    if (durationMs > thresholdMs) gaps.push({
      startUtc: before.endUtc,
      endUtc: after.startUtc,
      durationHours: Math.round(durationMs / 3600_000),
    });
  }
  return gaps;
}
