const DATABASE_NAME = "xpeng-analytics-local";
const DATABASE_VERSION = 1;
const HISTORY_STORE = "history";
const ACTIVE_HISTORY_KEY = "active";
const REMEMBER_KEY = "xpeng-analytics.remember-history";
const REMINDER_KEY = "xpeng-analytics.import-reminder";
const REMINDER_DAYS_KEY = "xpeng-analytics.import-reminder-days";
export const IMPORT_REMINDER_DAY_OPTIONS = [7, 15, 25, 30];

const hasWindow = () => typeof window !== "undefined";

export function supportsPersistentHistory() {
  return hasWindow() && "indexedDB" in window;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!supportsPersistentHistory()) {
      reject(new Error("persistent_history_unsupported"));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HISTORY_STORE)) database.createObjectStore(HISTORY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("persistent_history_open_failed"));
    request.onblocked = () => reject(new Error("persistent_history_blocked"));
  });
}

function transactionRequest(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE, mode);
    const store = transaction.objectStore(HISTORY_STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(result?.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || result?.error || new Error("persistent_history_transaction_failed"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("persistent_history_transaction_aborted"));
    };
  }));
}

export function rememberHistoryEnabled() {
  try {
    return hasWindow() && window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRememberHistoryEnabled(enabled) {
  try {
    if (hasWindow()) window.localStorage.setItem(REMEMBER_KEY, enabled ? "1" : "0");
  } catch {
    // The history itself still remains available through IndexedDB when allowed.
  }
}

export function importReminderEnabled() {
  try {
    return hasWindow() && window.localStorage.getItem(REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setImportReminderEnabled(enabled) {
  try {
    if (hasWindow()) window.localStorage.setItem(REMINDER_KEY, enabled ? "1" : "0");
  } catch {
    // A disabled preference store must not prevent vehicle-data processing.
  }
}

export function importReminderDays() {
  try {
    const value = Number(hasWindow() ? window.localStorage.getItem(REMINDER_DAYS_KEY) : 0);
    return IMPORT_REMINDER_DAY_OPTIONS.includes(value) ? value : 30;
  } catch {
    return 30;
  }
}

export function setImportReminderDays(days) {
  const value = Number(days);
  if (!IMPORT_REMINDER_DAY_OPTIONS.includes(value)) return 30;
  try {
    if (hasWindow()) window.localStorage.setItem(REMINDER_DAYS_KEY, String(value));
  } catch {
    // A disabled preference store must not prevent vehicle-data processing.
  }
  return value;
}

export async function requestDurableStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    return Boolean(await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function readPersistentHistory() {
  if (!supportsPersistentHistory()) return null;
  return transactionRequest("readonly", (store) => store.get(ACTIVE_HISTORY_KEY));
}

export async function savePersistentHistory(payload, metadata = {}) {
  const blob = payload instanceof Blob ? payload : new Blob([payload], { type: "application/octet-stream" });
  const record = {
    id: ACTIVE_HISTORY_KEY,
    blob,
    byteLength: blob.size,
    savedAtUtc: new Date().toISOString(),
    lastImportAtUtc: metadata.lastImportAtUtc || null,
    importCount: Number(metadata.importCount || 0),
    historyVersion: Number(metadata.historyVersion || 0),
  };
  await transactionRequest("readwrite", (store) => store.put(record));
  return record;
}

export async function deletePersistentHistory() {
  if (!supportsPersistentHistory()) return;
  await transactionRequest("readwrite", (store) => store.delete(ACTIVE_HISTORY_KEY));
}

export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return { usage: null, quota: null };
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? null, quota: estimate.quota ?? null };
  } catch {
    return { usage: null, quota: null };
  }
}

export function latestImportAt(snapshot) {
  return [...(snapshot?.imports || [])]
    .map((entry) => entry?.completedAtUtc)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

export function reminderDue(lastImportAtUtc, enabled, reminderDays = 30, now = Date.now()) {
  if (!enabled || !lastImportAtUtc) return false;
  const timestamp = Date.parse(lastImportAtUtc);
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp >= reminderDays * 86_400_000;
}

export function nextReminderAt(lastImportAtUtc, reminderDays = 30) {
  const timestamp = Date.parse(lastImportAtUtc);
  const days = Number(reminderDays);
  if (!Number.isFinite(timestamp) || !IMPORT_REMINDER_DAY_OPTIONS.includes(days)) return null;
  return new Date(timestamp + days * 86_400_000).toISOString();
}

export function formatStoredBytes(bytes, locale = "en") {
  const value = Number(bytes || 0);
  if (!value) return "0 MB";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1024 / 1024)} MB`;
}
