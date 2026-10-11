let runtimePromise;
let commandQueue = Promise.resolve();

const emitProgress = (percent, phase) => self.postMessage({ type: "progress", percent, phase });
const assetUrl = (path) => new URL(path, self.location.href).href;

function ensureDirectory(FS, path) {
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current += `/${part}`;
    try {
      FS.mkdir(current);
    } catch (error) {
      if (!FS.analyzePath(current).exists) throw error;
    }
  }
}

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (typeof WebAssembly === "undefined") throw new Error("webassembly_unavailable");
      emitProgress(3, "runtime_load");
      const { loadPyodide } = await import(assetUrl("processor/pyodide/pyodide.mjs"));
      const pyodide = await loadPyodide({ indexURL: assetUrl("processor/pyodide/") });
      const manifestResponse = await fetch(assetUrl("processor/python-files.json"), { cache: "force-cache" });
      if (!manifestResponse.ok) throw new Error("processor_manifest_unavailable");
      const manifest = await manifestResponse.json();
      ensureDirectory(pyodide.FS, "/app");
      for (const name of manifest.files) {
        const response = await fetch(assetUrl(`processor/python/${name}`), { cache: "force-cache" });
        if (!response.ok) throw new Error("processor_component_unavailable");
        const destination = `/app/${name}`;
        ensureDirectory(pyodide.FS, destination.slice(0, destination.lastIndexOf("/")));
        pyodide.FS.writeFile(destination, new Uint8Array(await response.arrayBuffer()));
      }
      return pyodide;
    })();
  }
  return runtimePromise;
}

async function initialiseSession() {
  const pyodide = await runtime();
  emitProgress(82, "engine_init");
  await pyodide.runPythonAsync(`
import os
import shutil
import sys

shutil.rmtree('/session', ignore_errors=True)
os.makedirs('/session/uploads', exist_ok=True)
os.chdir('/app')
os.environ['XPENG_DATA_ROOT'] = '/session'
os.environ['XPENG_DB_PATH'] = '/session/xpeng.db'
os.environ['XPENG_TIMEZONE'] = 'Europe/Lisbon'
for entry in ('/app', '/app/src'):
    if entry not in sys.path:
        sys.path.insert(0, entry)

from xpeng_data.config import Settings
from xpeng_data.db import connect, initialise

settings = Settings.from_env()
settings.ensure_directories()
connection = connect(settings.database_path)
try:
    initialise(connection)
finally:
    connection.close()
`);
  return pyodide;
}

function errorCode(error) {
  const message = String(error?.message ?? error).toLowerCase();
  if (message.includes("history_version")) return "history_version";
  if (message.includes("history_integrity")) return "history_integrity";
  if (message.includes("history_")) return "invalid_history";
  if (message.includes("not a zip") || message.includes("badzip") || message.includes("invalid zip")) return "invalid_archive";
  if (message.includes("missing xpeng families")) return "missing_families";
  if (message.includes("memory") || message.includes("allocation")) return "out_of_memory";
  if (message.includes("webassembly") || message.includes("processor_")) return "engine_error";
  if (message.includes("invalid") || message.includes("missing required columns")) return "invalid_data";
  return "unknown_error";
}

async function dashboardSnapshot(pyodide) {
  return pyodide.runPythonAsync(`
import json

from xpeng_data.analytics import rebuild_all
from xpeng_data.dashboard import build_dashboard_snapshot
from xpeng_data.db import connect, initialise
from xpeng_data.validation import validate_database

connection = connect(settings.database_path)
initialise(connection)
try:
    analytics = rebuild_all(connection, settings.timezone)
    validation = validate_database(connection)
    if not validation['ok']:
        raise RuntimeError('database_validation_failed')
    snapshot = build_dashboard_snapshot(connection, settings.timezone)
    snapshot['validation'] = validation
    snapshot['analytics'] = analytics
finally:
    connection.close()

json.dumps(snapshot, ensure_ascii=False)
`);
}

async function importArchive(message) {
  const pyodide = await runtime();
  const safeName = String(message.filename || "xpeng-data.zip")
    .replace(/[^\p{L}\p{N}._() -]/gu, "_")
    .slice(0, 160) || "xpeng-data.zip";
  const archivePath = `/session/uploads/${Date.now()}-${safeName}`;
  emitProgress(8, "archive_write");
  pyodide.FS.writeFile(archivePath, new Uint8Array(message.archive));
  pyodide.globals.set("browser_archive_path", archivePath);
  emitProgress(18, "archive_import");
  const importJson = await pyodide.runPythonAsync(`
import json
from pathlib import Path

from xpeng_data.importer import import_xpeng_archive

archive_path = Path(browser_archive_path)
try:
    imported = import_xpeng_archive(archive_path, settings=settings)
finally:
    archive_path.unlink(missing_ok=True)

json.dumps({
    'skipped': imported.skipped,
    'archiveSha256': imported.archive_sha256,
    'totalRows': imported.total_rows,
    'sourceStartUtc': imported.source_start_utc,
    'sourceEndUtc': imported.source_end_utc,
}, ensure_ascii=False)
`);
  emitProgress(68, "analytics_rebuild");
  const validatedSnapshotJson = await dashboardSnapshot(pyodide);
  emitProgress(92, "validation");
  emitProgress(100, "complete");
  self.postMessage({
    type: "imported",
    result: JSON.parse(importJson),
    snapshot: JSON.parse(validatedSnapshotJson),
  });
}

async function exportHistory() {
  const pyodide = await runtime();
  emitProgress(12, "history_export");
  const destination = "/session/xpeng-analytics-history.json.gz";
  pyodide.globals.set("browser_history_destination", destination);
  const metadataJson = await pyodide.runPythonAsync(`
import json
from pathlib import Path
from xpeng_data.portable import export_portable_history

history_metadata = export_portable_history(Path(browser_history_destination), settings)
json.dumps(history_metadata, ensure_ascii=False)
`);
  const bytes = pyodide.FS.readFile(destination);
  pyodide.FS.unlink(destination);
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const date = new Date().toISOString().slice(0, 10);
  emitProgress(100, "history_export_complete");
  self.postMessage({
    type: "history_exported",
    filename: `xpeng-analytics-history-${date}.json.gz`,
    metadata: JSON.parse(metadataJson),
    payload,
  }, [payload]);
}

async function importHistory(message) {
  const pyodide = await runtime();
  const historyPath = "/session/uploads/imported-history.json.gz";
  emitProgress(10, "history_read");
  pyodide.FS.writeFile(historyPath, new Uint8Array(message.archive));
  pyodide.globals.set("browser_history_path", historyPath);
  const metadataJson = await pyodide.runPythonAsync(`
import json
from pathlib import Path
from xpeng_data.portable import import_portable_history

try:
    history_metadata = import_portable_history(Path(browser_history_path), settings)
finally:
    Path(browser_history_path).unlink(missing_ok=True)
json.dumps(history_metadata, ensure_ascii=False)
`);
  emitProgress(62, "analytics_rebuild");
  const snapshotJson = await dashboardSnapshot(pyodide);
  emitProgress(100, "complete");
  self.postMessage({
    type: "history_imported",
    metadata: JSON.parse(metadataJson),
    snapshot: JSON.parse(snapshotJson),
  });
}

async function handle(message) {
  if (message?.type === "initialise") {
    await initialiseSession();
    self.postMessage({ type: "ready" });
    return;
  }
  if (message?.type === "reset") {
    await initialiseSession();
    self.postMessage({ type: "reset_complete" });
    return;
  }
  if (message?.type === "import") {
    await importArchive(message);
    return;
  }
  if (message?.type === "export_history") {
    await exportHistory();
    return;
  }
  if (message?.type === "import_history") {
    await importHistory(message);
  }
}

self.addEventListener("message", (event) => {
  commandQueue = commandQueue
    .then(() => handle(event.data))
    .catch((error) => self.postMessage({ type: "error", code: errorCode(error) }));
});
