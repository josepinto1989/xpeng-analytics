from __future__ import annotations

import csv
import gzip
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from xpeng_data.analytics import rebuild_all
from xpeng_data.config import Settings
from xpeng_data.dashboard import build_dashboard_snapshot
from xpeng_data.db import connect
from xpeng_data.importer import SPECS, import_xpeng_archive
from xpeng_data.portable import PortableHistoryError, export_portable_history, import_portable_history
from xpeng_data.validation import validate_database


SYNTHETIC_VIN = "SYNTHETIC" + ("0" * 8)


class PipelineTest(unittest.TestCase):
    def setUp(self) -> None:
        test_tmp = ROOT / "tmp"
        test_tmp.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=test_tmp)
        root = Path(self.temp.name)
        self.settings = Settings(
            project_root=root,
            data_root=root / "var",
            database_path=root / "var" / "test.db",
            raw_root=root / "var" / "raw",
            private_root=root / "var" / "private",
            timezone="Europe/Lisbon",
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def make_archive(self, name: str, *, corrected: bool = False, include_extra: bool = False) -> Path:
        path = Path(self.temp.name) / name
        timers = list(range(1000, 1021)) + list(range(2000, 2061))
        if include_extra:
            timers.append(3000)
        markers = {
            "operation": "driving_operation",
            "energy": "driving_power_energy",
            "status": "driving_status",
        }
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for family, spec in SPECS.items():
                fields = ["vin", "vmodel", "timer", "ds", *[source for source, _ in spec.source_to_target]]
                stream = io.StringIO(newline="")
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader()
                for timer in timers:
                    row = {field: "" for field in fields}
                    row.update({"vin": SYNTHETIC_VIN, "vmodel": "SYNTHETIC", "timer": timer, "ds": "19700101"})
                    if family == "operation":
                        row["esp_vehspd"] = 72 if corrected and timer == 1010 else (36 if timer <= 1020 else 0)
                        row["cdcu_totalodometer"] = 100 + max(0, timer - 1000) / 100
                    elif family == "energy":
                        row.update({
                            "bms_battvolt": 500,
                            "bms_battcurr": 20 if timer <= 1020 else -10,
                            "ldcu_chrgpwr": 0 if timer <= 1020 else 5,
                            "ldcu_bms_soc_disp": 80,
                            "bms_batttempmax_gb": 30,
                            "bms_batttempmin_gb": 29,
                        })
                    else:
                        row.update({
                            "ldcu_tpmsprfl": 250,
                            "ldcu_tpmsprfr": 250,
                            "ldcu_tpmsprrl": 260,
                            "ldcu_tpmsprrr": 260,
                        })
                    writer.writerow(row)
                archive.writestr(f"synthetic_{markers[family]}.csv", stream.getvalue())
        return path

    def test_import_is_idempotent_and_does_not_store_the_vin(self) -> None:
        archive = self.make_archive("synthetic.zip")
        first = import_xpeng_archive(archive, self.settings, batch_size=10)
        second = import_xpeng_archive(archive, self.settings, batch_size=10)
        self.assertFalse(first.skipped)
        self.assertTrue(second.skipped)
        connection = connect(self.settings.database_path)
        try:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM imports").fetchone()[0], 1)
            vehicle_id = connection.execute("SELECT vehicle_id FROM vehicles").fetchone()[0]
            self.assertNotEqual(vehicle_id, SYNTHETIC_VIN)
            self.assertNotIn(SYNTHETIC_VIN.encode(), self.settings.database_path.read_bytes())
        finally:
            connection.close()

    def test_overlaps_update_without_duplicates_and_rebuild_cleanly(self) -> None:
        import_xpeng_archive(self.make_archive("first.zip"), self.settings, batch_size=10)
        import_xpeng_archive(
            self.make_archive("second.zip", corrected=True, include_extra=True),
            self.settings,
            batch_size=10,
        )
        connection = connect(self.settings.database_path)
        try:
            counts = rebuild_all(connection, self.settings.timezone)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM xpeng_operation_seconds").fetchone()[0], 83)
            self.assertEqual(connection.execute("SELECT speed_kmh FROM xpeng_operation_seconds WHERE timer=1010").fetchone()[0], 72)
            self.assertGreaterEqual(counts["trips"], 1)
            self.assertGreaterEqual(counts["charge_sessions"], 1)
            self.assertTrue(validate_database(connection)["ok"])
            snapshot = build_dashboard_snapshot(connection, self.settings.timezone)
            self.assertEqual(snapshot["format"], "xpeng-analytics-dashboard/v1")
            self.assertGreaterEqual(len(snapshot["trips"]), 1)
            self.assertGreaterEqual(len(snapshot["charges"]), 1)
            self.assertNotIn("routes", snapshot)
            json.dumps(snapshot)
            keys = set()

            def collect_keys(value):
                if isinstance(value, dict):
                    keys.update(str(key).lower() for key in value)
                    for child in value.values():
                        collect_keys(child)
                elif isinstance(value, list):
                    for child in value:
                        collect_keys(child)

            collect_keys(snapshot)
            self.assertTrue({"vin", "vehicle_id", "latitude", "longitude", "route"}.isdisjoint(keys))
        finally:
            connection.close()

    def test_schema_contains_only_xpeng_sources(self) -> None:
        connection = connect(self.settings.database_path)
        try:
            tables = {
                row[0]
                for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            }
            self.assertFalse(any(name.startswith("ev" + "dash") for name in tables))
        finally:
            connection.close()

    def test_portable_history_restores_deduplication_state(self) -> None:
        archive = self.make_archive("portable-source.zip")
        imported = import_xpeng_archive(archive, self.settings, batch_size=10)
        connection = connect(self.settings.database_path)
        try:
            rebuild_all(connection, self.settings.timezone)
        finally:
            connection.close()

        portable = Path(self.temp.name) / "history.json.gz"
        exported = export_portable_history(portable, self.settings)
        self.assertEqual(exported["format"], "xpeng-analytics-history")

        restored_root = Path(self.temp.name) / "restored"
        restored = Settings(
            project_root=restored_root,
            data_root=restored_root / "var",
            database_path=restored_root / "var" / "restored.db",
            raw_root=restored_root / "var" / "raw",
            private_root=restored_root / "var" / "private",
            timezone="Europe/Lisbon",
        )
        metadata = import_portable_history(portable, restored)
        self.assertEqual(metadata["version"], 1)
        duplicate = import_xpeng_archive(archive, restored, batch_size=10)
        self.assertTrue(duplicate.skipped)
        restored_connection = connect(restored.database_path)
        try:
            self.assertTrue(validate_database(restored_connection)["ok"])
            self.assertEqual(restored_connection.execute("SELECT COUNT(*) FROM imports").fetchone()[0], 1)
        finally:
            restored_connection.close()

        tampered = Path(self.temp.name) / "tampered.json.gz"
        with gzip.open(portable, "rt", encoding="utf-8") as handle:
            document = json.load(handle)
        document["databaseSha256"] = "0" * 64
        with gzip.open(tampered, "wt", encoding="utf-8") as handle:
            json.dump(document, handle)
        with self.assertRaises(PortableHistoryError):
            import_portable_history(tampered, restored)


if __name__ == "__main__":
    unittest.main()

