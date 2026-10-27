const DAY_MS = 24 * 60 * 60 * 1000;

export function rawSourcesCoverBackup(files, metadata, toleranceMs = DAY_MS) {
  const backupStart = Date.parse(metadata?.coverageStartUtc || "");
  const backupEnd = Date.parse(metadata?.coverageEndUtc || "");
  const ranges = (files || [])
    .map((file) => ({
      start: Date.parse(file.coverageStartUtc || ""),
      end: Date.parse(file.coverageEndUtc || ""),
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end >= range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (!Number.isFinite(backupStart) || !Number.isFinite(backupEnd) || backupEnd < backupStart || !ranges.length) return false;

  let coveredUntil = backupStart;
  for (const range of ranges) {
    if (range.end < coveredUntil - toleranceMs) continue;
    if (range.start > coveredUntil + toleranceMs) return false;
    coveredUntil = Math.max(coveredUntil, range.end);
    if (coveredUntil >= backupEnd - toleranceMs) return true;
  }
  return false;
}
