const DAY_MS = 86_400_000;

const rows = (value) => Array.isArray(value) ? value : [];

function iso(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function time(value) {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function rawArchiveRecord(source = {}, defaults = {}) {
  const sha256 = String(source.sha256 || source.digest || defaults.sha256 || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;
  return {
    sha256,
    name: String(source.name || defaults.name || "XPENG Data Act export.zip"),
    byteLength: Math.max(0, Number(source.byteLength ?? source.size ?? defaults.byteLength ?? 0)),
    rows: Math.max(0, Number(source.rows ?? defaults.rows ?? 0)),
    sourceStartUtc: iso(source.sourceStartUtc || source.coverageStartUtc || defaults.sourceStartUtc),
    sourceEndUtc: iso(source.sourceEndUtc || source.coverageEndUtc || defaults.sourceEndUtc),
    importedAtUtc: iso(source.importedAtUtc || source.completedAtUtc || defaults.importedAtUtc) || new Date().toISOString(),
    driveStatus: ["pending", "retained", "retired", "not_archived"].includes(source.driveStatus) ? source.driveStatus : (defaults.driveStatus || "not_archived"),
    driveFileId: typeof source.driveFileId === "string" ? source.driveFileId : (defaults.driveFileId || null),
    replacedBySha256: typeof source.replacedBySha256 === "string" ? source.replacedBySha256 : (defaults.replacedBySha256 || null),
    driveUpdatedAtUtc: iso(source.driveUpdatedAtUtc || defaults.driveUpdatedAtUtc),
  };
}

export function normaliseRawArchiveRegistry(rawArchives, imports = []) {
  const byDigest = new Map();
  for (const source of [...rows(imports), ...rows(rawArchives)]) {
    const record = rawArchiveRecord(source, { driveStatus: "not_archived" });
    if (!record) continue;
    byDigest.set(record.sha256, { ...(byDigest.get(record.sha256) || {}), ...record });
  }
  return [...byDigest.values()].sort((left, right) => String(right.importedAtUtc).localeCompare(String(left.importedAtUtc)));
}

export function mergeRawArchiveRegistry(current, updates) {
  const byDigest = new Map(normaliseRawArchiveRegistry(current).map((record) => [record.sha256, record]));
  for (const source of rows(updates)) {
    const previous = byDigest.get(String(source?.sha256 || source?.digest || "").toLowerCase()) || {};
    const record = rawArchiveRecord({ ...previous, ...source }, previous);
    if (record) byDigest.set(record.sha256, record);
  }
  return [...byDigest.values()].sort((left, right) => String(right.importedAtUtc).localeCompare(String(left.importedAtUtc)));
}

function validCoverage(file) {
  const start = time(file.coverageStartUtc || file.sourceStartUtc);
  const end = time(file.coverageEndUtc || file.sourceEndUtc);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { file, start, end } : null;
}

function newest(left, right) {
  return String(right.file.createdTime || right.file.modifiedTime || "").localeCompare(String(left.file.createdTime || left.file.modifiedTime || ""));
}

function coveredBySelected(entry, selected) {
  const intervals = selected.map(validCoverage).filter(Boolean).sort((left, right) => left.start - right.start);
  let cursor = entry.start;
  for (const interval of intervals) {
    if (interval.end < cursor) continue;
    if (interval.start > cursor) return false;
    cursor = Math.max(cursor, interval.end);
    if (cursor >= entry.end) return true;
  }
  return false;
}

/**
 * Selects a small set of untouched source ZIPs that spans the same observed
 * time range. A four-day overlap is preferred, but continuity wins when the
 * available exports do not provide it. Files without trustworthy coverage are
 * always retained.
 */
export function planRawFileRetention(files, { overlapDays = 4 } = {}) {
  const input = rows(files), covered = input.map(validCoverage).filter(Boolean);
  const unmeasured = input.filter((file) => !validCoverage(file));
  if (covered.length <= 1) return { retained: [...input], retired: [], overlapDays };

  const overlapMs = Math.max(0, Number(overlapDays || 0)) * DAY_MS;
  const remaining = [...covered].sort((left, right) => left.start - right.start || right.end - left.end || newest(left, right));
  const selected = [];
  let cursor = -Infinity;

  while (remaining.length) {
    let candidates;
    if (!Number.isFinite(cursor)) {
      const firstStart = remaining[0].start;
      candidates = remaining.filter((entry) => entry.start === firstStart);
    } else {
      candidates = remaining.filter((entry) => entry.start <= cursor - overlapMs && entry.end > cursor);
      if (!candidates.length) candidates = remaining.filter((entry) => entry.start <= cursor && entry.end > cursor);
      if (!candidates.length) {
        const nextStart = remaining[0].start;
        candidates = remaining.filter((entry) => entry.start === nextStart);
      }
    }
    candidates.sort((left, right) => right.end - left.end || newest(left, right));
    const chosen = candidates[0];
    selected.push(chosen.file);
    cursor = Math.max(cursor, chosen.end);
    const index = remaining.indexOf(chosen);
    remaining.splice(index, 1);
    for (let position = remaining.length - 1; position >= 0; position -= 1) if (coveredBySelected(remaining[position], selected)) remaining.splice(position, 1);
  }

  const retainedIds = new Set([...selected, ...unmeasured].map((file) => file.id));
  return {
    retained: input.filter((file) => retainedIds.has(file.id)),
    retired: input.filter((file) => !retainedIds.has(file.id)),
    overlapDays,
  };
}

export function driveRegistryUpdates(files, retiredFiles = [], now = new Date().toISOString()) {
  const retiredIds = new Set(rows(retiredFiles).map((file) => file.id));
  const retained = rows(files).filter((file) => !retiredIds.has(file.id));
  const replacement = retained.slice().sort((left, right) => String(right.coverageEndUtc || "").localeCompare(String(left.coverageEndUtc || "")))[0]?.digest || null;
  return rows(files).map((file) => ({
    sha256: file.digest,
    name: file.name,
    byteLength: Number(file.size || 0),
    sourceStartUtc: file.coverageStartUtc,
    sourceEndUtc: file.coverageEndUtc,
    driveStatus: retiredIds.has(file.id) ? "retired" : "retained",
    driveFileId: retiredIds.has(file.id) ? null : file.id,
    replacedBySha256: retiredIds.has(file.id) ? replacement : null,
    driveUpdatedAtUtc: now,
  }));
}
