const PREFIX = "xpeng-analytics-dismissed-v1";

function storageKey(scope) { return `${PREFIX}:${scope}`; }

export function readDismissed(scope, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(storageKey(scope)) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch { return new Set(); }
}

export function writeDismissed(scope, values, storage = globalThis.localStorage) {
  const rows = [...new Set(Array.from(values || [], String))];
  try { storage?.setItem(storageKey(scope), JSON.stringify(rows)); } catch { /* Browser storage is optional. */ }
  return new Set(rows);
}

export function dismissObservation(scope, id, storage = globalThis.localStorage) {
  const values = readDismissed(scope, storage); values.add(String(id));
  return writeDismissed(scope, values, storage);
}

export function restoreObservations(scope, storage = globalThis.localStorage) {
  try { storage?.removeItem(storageKey(scope)); } catch { /* Browser storage is optional. */ }
  return new Set();
}

export function qualityObservationId(row = {}) {
  return [row.rule, row.family, row.field, row.startedAtUtc, row.endedAtUtc, row.severity].map((value)=>String(value ?? "")).join("|");
}

export function insightObservationId(row = {}) {
  return [row.metric, row.group, row.date, row.sourceId, row.direction].map((value)=>String(value ?? "")).join("|");
}
