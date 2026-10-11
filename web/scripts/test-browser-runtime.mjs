import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(webRoot, "public", "processor");
const workerSource = await readFile(join(webRoot, "public", "import-worker.js"), "utf8");
for (const forbidden of ["/api/", "XMLHttpRequest", "indexedDB", "localStorage", "sessionStorage"]) {
  if (workerSource.includes(forbidden)) throw new Error(`Browser processor contains forbidden persistence/network API: ${forbidden}`);
}

const pyodide = await loadPyodide({ indexURL: "./node_modules/pyodide/" });

function ensureDirectory(path) {
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current += `/${part}`;
    try {
      pyodide.FS.mkdir(current);
    } catch (error) {
      if (!pyodide.FS.analyzePath(current).exists) throw error;
    }
  }
}

const manifest = JSON.parse(await readFile(join(publicRoot, "python-files.json"), "utf8"));
for (const name of manifest.files) {
  const destination = `/app/${name}`;
  ensureDirectory(destination.slice(0, destination.lastIndexOf("/")));
  pyodide.FS.writeFile(destination, new Uint8Array(await readFile(join(publicRoot, "python", name))));
}

const result = await pyodide.runPythonAsync(`
import csv
import io
import json
import os
import sys
import zipfile
from pathlib import Path

os.makedirs('/session/uploads', exist_ok=True)
os.chdir('/app')
os.environ['XPENG_DATA_ROOT'] = '/session'
os.environ['XPENG_DB_PATH'] = '/session/xpeng.db'
os.environ['XPENG_TIMEZONE'] = 'Europe/Lisbon'
for entry in ('/app', '/app/src'):
    if entry not in sys.path:
        sys.path.insert(0, entry)

from xpeng_data.analytics import rebuild_all
from xpeng_data.config import Settings
from xpeng_data.dashboard import build_dashboard_snapshot
from xpeng_data.db import connect, initialise
from xpeng_data.importer import SPECS, import_xpeng_archive
from xpeng_data.portable import export_portable_history, import_portable_history
from xpeng_data.validation import summary, validate_database

settings = Settings.from_env()
settings.ensure_directories()
archive_path = Path('/session/uploads/synthetic.zip')
timers = list(range(1000, 1041)) + list(range(2000, 2061))
synthetic_vin = 'SYNTHETIC' + ('0' * 8)
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    markers = {'operation': 'driving_operation', 'energy': 'driving_power_energy', 'status': 'driving_status'}
    for family, spec in SPECS.items():
        fields = ['vin', 'vmodel', 'timer', 'ds', *[source for source, _ in spec.source_to_target]]
        stream = io.StringIO(newline='')
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for timer in timers:
            row = {field: '' for field in fields}
            row.update({'vin': synthetic_vin, 'vmodel': 'SYNTHETIC', 'timer': timer, 'ds': '19700101'})
            if family == 'operation':
                row['esp_vehspd'] = 36 if timer < 1100 else 0
                row['cdcu_totalodometer'] = 100 + max(0, timer - 1000) / 100
            elif family == 'energy':
                row.update({'bms_battvolt': 500, 'bms_battcurr': 20 if timer < 1100 else -10,
                            'ldcu_chrgpwr': 0 if timer < 1100 else 5, 'ldcu_bms_soc_disp': 80,
                            'bms_batttempmax_gb': 30, 'bms_batttempmin_gb': 29})
            else:
                row.update({'ldcu_tpmsprfl': 250, 'ldcu_tpmsprfr': 250,
                            'ldcu_tpmsprrl': 260, 'ldcu_tpmsprrr': 260})
            writer.writerow(row)
        archive.writestr(f'synthetic_{markers[family]}.csv', stream.getvalue())

first = import_xpeng_archive(archive_path, settings=settings)
second = import_xpeng_archive(archive_path, settings=settings)
connection = connect(settings.database_path)
initialise(connection)
try:
    analytics = rebuild_all(connection, settings.timezone)
    validation = validate_database(connection)
    safe_summary = summary(connection)
    dashboard = build_dashboard_snapshot(connection, settings.timezone)
finally:
    connection.close()

history_path = Path('/session/history.json.gz')
exported_history = export_portable_history(history_path, settings)
for candidate in (settings.database_path, Path(f'{settings.database_path}-wal'), Path(f'{settings.database_path}-shm')):
    candidate.unlink(missing_ok=True)
(settings.private_root / 'vehicle_hmac.key').unlink(missing_ok=True)
restored_history = import_portable_history(history_path, settings)
third = import_xpeng_archive(archive_path, settings=settings)
connection = connect(settings.database_path)
initialise(connection)
try:
    restored_validation = validate_database(connection)
    restored_dashboard = build_dashboard_snapshot(connection, settings.timezone)
finally:
    connection.close()

json.dumps({
    'firstSkipped': first.skipped,
    'secondSkipped': second.skipped,
    'validation': validation['ok'],
    'trips': analytics['trips'],
    'imports': safe_summary['source']['imports'],
    'dashboardFormat': dashboard['format'],
    'dashboardTrips': len(dashboard['trips']),
    'dashboardCharges': len(dashboard['charges']),
    'historyFormat': exported_history['format'],
    'historyVersion': restored_history['version'],
    'duplicateAfterRestore': third.skipped,
    'restoredValidation': restored_validation['ok'],
    'restoredTrips': len(restored_dashboard['trips']),
})
`);

const parsed = JSON.parse(result);
if (parsed.firstSkipped || !parsed.secondSkipped || !parsed.validation || parsed.trips < 1 || parsed.imports !== 1
    || parsed.dashboardFormat !== "xpeng-analytics-dashboard/v1" || parsed.dashboardTrips < 1 || parsed.dashboardCharges < 1
    || parsed.historyFormat !== "xpeng-analytics-history" || parsed.historyVersion !== 1 || !parsed.duplicateAfterRestore
    || !parsed.restoredValidation || parsed.restoredTrips < 1) {
  throw new Error(`Unexpected browser runtime result: ${result}`);
}
console.log(`Browser runtime passed: ${result}`);
