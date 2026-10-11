from __future__ import annotations

import csv
import hashlib
import io
import json
import shutil
import sqlite3
import time
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .config import Settings
from .db import connect, initialise
from .monitoring import record_import_schemas
from .quality import QUALITY_INVALID, RULES, normalise_number, parse_number
from .security import load_or_create_vehicle_key, sha256_file, vehicle_id_for_vin


FAMILY_MARKERS = {
    "operation": "driving_operation",
    "energy": "driving_power_energy",
    "status": "driving_status",
}


@dataclass(frozen=True)
class FamilySpec:
    table: str
    source_to_target: tuple[tuple[str, str], ...]

    @property
    def target_columns(self) -> tuple[str, ...]:
        return tuple(target for _, target in self.source_to_target)


SPECS = {
    "operation": FamilySpec(
        "xpeng_operation_seconds",
        (
            ("esp_vehspd", "speed_kmh"),
            ("esp_vehlongaccel", "longitudinal_accel"),
            ("esp_vehlateralaccel", "lateral_accel"),
            ("cdcu_totalodometer", "odometer_km"),
            ("eps_steeringangle", "steering_angle_deg"),
            ("eps_steeringanglespd", "steering_speed_deg_s"),
            ("ldcu_accpedalsig", "accelerator_pct"),
            ("ldcu_brkpedalst", "brake_status"),
            ("ldcu_currentgearlev", "gear_level"),
        ),
    ),
    "energy": FamilySpec(
        "xpeng_energy_seconds",
        (
            ("ipuf_actrotspd", "front_motor_rpm"),
            ("ipur_actrotspd", "rear_motor_rpm"),
            ("ipuf_acttorq", "front_motor_torque_nm"),
            ("ipur_acttorq", "rear_motor_torque_nm"),
            ("ipuf_rotoracttemp", "front_rotor_temp_c"),
            ("ipur_rotoracttemp", "rear_rotor_temp_c"),
            ("bms_battvolt", "pack_voltage_v"),
            ("bms_battcurr", "pack_current_a"),
            ("ldcu_chrgpwr", "charge_power_kw"),
            ("ldcu_bms_soc_disp", "soc_pct"),
            ("bms_batttempmax_gb", "battery_temp_max_c"),
            ("bms_batttempmin_gb", "battery_temp_min_c"),
            ("bms_celltempmaxnum_gb", "hottest_cell_index"),
            ("bms_celltempminnum_gb", "coldest_cell_index"),
            ("ldcu_dstbatdisp_dynamic", "displayed_range_km"),
        ),
    ),
    "status": FamilySpec(
        "xpeng_status_seconds",
        (
            ("ldcu_driverdoorajarst", "driver_door_ajar"),
            ("rdcu_psngrdoorajarst", "passenger_door_ajar"),
            ("ldcu_rldoorajarst", "rear_left_door_ajar"),
            ("rdcu_rrdoorajarst", "rear_right_door_ajar"),
            ("ldcu_flwinposstfb", "front_left_window_position"),
            ("ldcu_rlwinposstfb", "rear_left_window_position"),
            ("frwinposstfb", "front_right_window_position"),
            ("rrwinposstfb", "rear_right_window_position"),
            ("rdm_tropenersts", "trunk_open_status"),
            ("ldcu_tpmsprfl", "tyre_pressure_fl_kpa"),
            ("ldcu_tpmsprfr", "tyre_pressure_fr_kpa"),
            ("ldcu_tpmsprrl", "tyre_pressure_rl_kpa"),
            ("ldcu_tpmsprrr", "tyre_pressure_rr_kpa"),
        ),
    ),
}

# A documentação Data Act indica que alguns nomes variam por modelo/ECU.
# Mantemos um campo canónico por métrica e escolhemos o primeiro alias presente
# no CSV, de forma insensível a maiúsculas/minúsculas.
SOURCE_ALIASES = {
    "esp_vehspd": ("esp_vehspd", "ipb_vehspd"),
    "esp_vehlongaccel": ("esp_vehlongaccel", "ipb_vehlongaccel_e2e"),
    "esp_vehlateralaccel": ("esp_vehlateralaccel", "ipb_vehlateralaccel_e2e"),
    "ldcu_brkpedalst": ("ldcu_brkpedalst", "IPB_BrkPedalSt", "ESP_BrkPedalSt"),
    "frwinposstfb": ("frwinposstfb", "rdcu_frwinposstfb", "ldcu_frwinposstfb"),
    "rrwinposstfb": ("rrwinposstfb", "rdcu_rrwinposstfb", "ldcu_rrwinposstfb"),
}


def _resolve_source_fields(spec: FamilySpec, columns: Iterable[str]) -> dict[str, str | None]:
    by_lower = {column.lower(): column for column in columns}
    return {
        canonical: next(
            (by_lower[alias.lower()] for alias in SOURCE_ALIASES.get(canonical, (canonical,)) if alias.lower() in by_lower),
            None,
        )
        for canonical, _ in spec.source_to_target
    }


@dataclass
class ImportResult:
    import_id: int
    skipped: bool
    archive_sha256: str
    archive_path: Path
    total_rows: int
    source_start_utc: int | None
    source_end_utc: int | None


def _family_for_name(name: str) -> str | None:
    lower = name.lower()
    for family, marker in FAMILY_MARKERS.items():
        if marker in lower and lower.endswith(".csv"):
            return family
    return None


def _row_digest(values: Iterable[object]) -> str:
    payload = json.dumps(list(values), ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _member_sha256(zf: zipfile.ZipFile, member: str) -> str:
    digest = hashlib.sha256()
    with zf.open(member) as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _archive_destination(settings: Settings, source: Path, digest: str) -> Path:
    now = datetime.now(timezone.utc)
    destination = settings.raw_root / "xpeng" / f"{now:%Y}" / f"{now:%m}" / f"{digest}.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(source, destination)
    return destination


def _upsert_sql(spec: FamilySpec) -> str:
    columns = (
        "vehicle_id",
        "timer",
        "source_ds",
        "model",
        *spec.target_columns,
        "quality_mask",
        "row_hash",
        "first_import_id",
        "last_import_id",
    )
    placeholders = ",".join("?" for _ in columns)
    updates = ["source_ds=excluded.source_ds", "model=excluded.model"]
    updates.extend(f"{column}=excluded.{column}" for column in spec.target_columns)
    updates.extend(("quality_mask=excluded.quality_mask", "row_hash=excluded.row_hash", "last_import_id=excluded.last_import_id"))
    return (
        f"INSERT INTO {spec.table} ({','.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(vehicle_id,timer) DO UPDATE SET {','.join(updates)} "
        f"WHERE {spec.table}.row_hash <> excluded.row_hash"
    )


def _flush(connection: sqlite3.Connection, sql: str, rows: list[tuple[object, ...]]) -> int:
    if not rows:
        return 0
    before = connection.total_changes
    connection.executemany(sql, rows)
    changed = connection.total_changes - before
    rows.clear()
    return changed


def import_xpeng_archive(
    archive_path: Path,
    settings: Settings | None = None,
    batch_size: int = 5_000,
) -> ImportResult:
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    archive_path = archive_path.resolve()
    if not archive_path.is_file():
        raise FileNotFoundError(archive_path)
    if not zipfile.is_zipfile(archive_path):
        raise ValueError(f"Not a ZIP archive: {archive_path}")

    archive_digest = sha256_file(archive_path)
    stored_path = _archive_destination(settings, archive_path, archive_digest)
    vehicle_key = load_or_create_vehicle_key(settings.private_root)
    connection = connect(settings.database_path)
    initialise(connection)

    existing = connection.execute(
        "SELECT import_id, status, total_rows, source_start_utc, source_end_utc, stored_path "
        "FROM imports WHERE archive_sha256=?",
        (archive_digest,),
    ).fetchone()
    if existing and existing["status"] == "complete":
        connection.close()
        return ImportResult(
            import_id=existing["import_id"],
            skipped=True,
            archive_sha256=archive_digest,
            archive_path=Path(existing["stored_path"]),
            total_rows=existing["total_rows"],
            source_start_utc=existing["source_start_utc"],
            source_end_utc=existing["source_end_utc"],
        )

    now = int(time.time())
    if existing:
        import_id = existing["import_id"]
        connection.execute("DELETE FROM import_files WHERE import_id=?", (import_id,))
        connection.execute("DELETE FROM field_profiles WHERE import_id=?", (import_id,))
        connection.execute("DELETE FROM quality_events WHERE import_id=?", (import_id,))
        connection.execute(
            "UPDATE imports SET status='running', started_at_utc=?, completed_at_utc=NULL, error_message=NULL WHERE import_id=?",
            (now, import_id),
        )
    else:
        cursor = connection.execute(
            "INSERT INTO imports(source,archive_sha256,original_name,stored_path,received_at_utc,started_at_utc,status) "
            "VALUES('xpeng',?,?,?,?,?,'running')",
            (archive_digest, archive_path.name, str(stored_path), now, now),
        )
        import_id = int(cursor.lastrowid)
    connection.commit()

    total_rows = 0
    source_min: int | None = None
    source_max: int | None = None
    vehicles_seen: set[str] = set()
    vehicle_bounds: dict[str, list[object]] = {}

    try:
        with zipfile.ZipFile(archive_path) as zf:
            members_by_family: dict[str, list[str]] = defaultdict(list)
            for member in zf.namelist():
                family = _family_for_name(member)
                if family:
                    members_by_family[family].append(member)
            missing_families = set(SPECS) - set(members_by_family)
            if missing_families:
                raise ValueError(f"Archive is missing XPENG families: {sorted(missing_families)}")

            connection.execute("BEGIN IMMEDIATE")
            for family in ("operation", "energy", "status"):
                spec = SPECS[family]
                sql = _upsert_sql(spec)
                table_before = connection.execute(f"SELECT COUNT(*) FROM {spec.table}").fetchone()[0]
                family_affected = 0
                family_rows = 0
                duplicate_timestamps = 0
                seen_keys: set[tuple[str, int]] = set()
                batch: list[tuple[object, ...]] = []
                field_nulls: Counter[str] = Counter()
                field_invalid: Counter[str] = Counter()
                field_min: dict[str, float] = {}
                field_max: dict[str, float] = {}
                file_summaries: list[dict[str, object]] = []

                for member in sorted(members_by_family[family]):
                    rows_in_file = 0
                    duplicates_in_file = 0
                    first_timer: int | None = None
                    last_timer: int | None = None
                    with zf.open(member) as raw:
                        wrapper = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                        reader = csv.DictReader(wrapper)
                        columns = reader.fieldnames or []
                        required = {"vin", "timer", "ds"}
                        if not required.issubset(columns):
                            raise ValueError(f"{member} is missing required columns: {sorted(required - set(columns))}")
                        expected = required | {"vmodel"} | {
                            alias
                            for source, _ in spec.source_to_target
                            for alias in SOURCE_ALIASES.get(source, (source,))
                        }
                        expected_lower = {field.lower() for field in expected}
                        unknown = sorted(column for column in columns if column.lower() not in expected_lower)
                        if unknown:
                            connection.execute(
                                "INSERT INTO quality_events(import_id,family,field,rule_code,severity,affected_rows,total_rows,detail) "
                                "VALUES(?,?,?,?,?,?,?,?)",
                                (import_id, family, None, "schema_new_columns", "medium", len(unknown), 0, f"New source columns: {', '.join(unknown)}"),
                            )

                        resolved_fields = _resolve_source_fields(spec, columns)
                        for source_row in reader:
                            rows_in_file += 1
                            family_rows += 1
                            total_rows += 1
                            try:
                                timer = int(source_row["timer"])
                            except (TypeError, ValueError) as exc:
                                raise ValueError(f"Invalid timer in {member} row {rows_in_file + 1}") from exc
                            vehicle_id = vehicle_id_for_vin(source_row.get("vin", ""), vehicle_key)
                            model = source_row.get("vmodel") or None
                            if vehicle_id not in vehicles_seen:
                                vehicles_seen.add(vehicle_id)
                                vehicle_bounds[vehicle_id] = [model, timer, timer]
                                connection.execute(
                                    "INSERT INTO vehicles(vehicle_id,model,first_seen_utc,last_seen_utc) VALUES(?,?,?,?) "
                                    "ON CONFLICT(vehicle_id) DO UPDATE SET model=COALESCE(excluded.model,vehicles.model), "
                                    "first_seen_utc=MIN(vehicles.first_seen_utc,excluded.first_seen_utc), "
                                    "last_seen_utc=MAX(vehicles.last_seen_utc,excluded.last_seen_utc)",
                                    (vehicle_id, model, timer, timer),
                                )
                            else:
                                bounds = vehicle_bounds[vehicle_id]
                                bounds[0] = model or bounds[0]
                                bounds[1] = min(int(bounds[1]), timer)
                                bounds[2] = max(int(bounds[2]), timer)
                            key = (vehicle_id, timer)
                            if key in seen_keys:
                                duplicate_timestamps += 1
                                duplicates_in_file += 1
                            else:
                                seen_keys.add(key)
                            first_timer = timer if first_timer is None else min(first_timer, timer)
                            last_timer = timer if last_timer is None else max(last_timer, timer)
                            source_min = timer if source_min is None else min(source_min, timer)
                            source_max = timer if source_max is None else max(source_max, timer)

                            quality_mask = 0
                            values: list[float | None] = []
                            for source_field, _ in spec.source_to_target:
                                actual_field = resolved_fields[source_field]
                                raw_value = source_row.get(actual_field) if actual_field else None
                                value, invalid = normalise_number(family, source_field, raw_value)
                                if raw_value is None or raw_value.strip() == "" or (value is None and not invalid):
                                    field_nulls[source_field] += 1
                                if invalid:
                                    field_invalid[source_field] += 1
                                    quality_mask |= QUALITY_INVALID
                                parsed = parse_number(raw_value)
                                if parsed is not None:
                                    field_min[source_field] = min(field_min.get(source_field, parsed), parsed)
                                    field_max[source_field] = max(field_max.get(source_field, parsed), parsed)
                                values.append(value)

                            digest = _row_digest((source_row.get("ds"), model, *values, quality_mask))
                            batch.append(
                                (
                                    vehicle_id,
                                    timer,
                                    source_row.get("ds") or None,
                                    model,
                                    *values,
                                    quality_mask,
                                    digest,
                                    import_id,
                                    import_id,
                                )
                            )
                            if len(batch) >= batch_size:
                                family_affected += _flush(connection, sql, batch)
                    file_summaries.append(
                        {
                            "member": member,
                            "sha256": _member_sha256(zf, member),
                            "columns": columns,
                            "rows": rows_in_file,
                            "duplicates": duplicates_in_file,
                            "first": first_timer,
                            "last": last_timer,
                        }
                    )

                family_affected += _flush(connection, sql, batch)
                table_after = connection.execute(f"SELECT COUNT(*) FROM {spec.table}").fetchone()[0]
                new_rows = table_after - table_before
                updated_rows = max(0, family_affected - new_rows)
                unchanged_rows = max(0, family_rows - new_rows - updated_rows)

                remaining_new = new_rows
                remaining_updated = updated_rows
                remaining_unchanged = unchanged_rows
                for index, summary in enumerate(file_summaries):
                    file_rows = int(summary["rows"])
                    if index == len(file_summaries) - 1:
                        allocated_new, allocated_updated, allocated_unchanged = remaining_new, remaining_updated, remaining_unchanged
                    else:
                        share = file_rows / family_rows if family_rows else 0
                        allocated_new = min(remaining_new, round(new_rows * share))
                        allocated_updated = min(remaining_updated, round(updated_rows * share))
                        allocated_unchanged = max(0, file_rows - allocated_new - allocated_updated)
                    remaining_new -= allocated_new
                    remaining_updated -= allocated_updated
                    remaining_unchanged -= allocated_unchanged
                    connection.execute(
                        "INSERT INTO import_files(import_id,family,member_name,member_sha256,columns_json,rows_read," 
                        "duplicate_timestamps,new_rows,updated_rows,unchanged_rows,first_timer,last_timer) "
                        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            import_id,
                            family,
                            summary["member"],
                            summary["sha256"],
                            json.dumps(summary["columns"]),
                            file_rows,
                            summary["duplicates"],
                            allocated_new,
                            allocated_updated,
                            allocated_unchanged,
                            summary["first"],
                            summary["last"],
                        ),
                    )

                for source_field, _ in spec.source_to_target:
                    invalid_count = field_invalid[source_field]
                    connection.execute(
                        "INSERT INTO field_profiles(import_id,family,field,total_rows,null_rows,invalid_rows,minimum,maximum) "
                        "VALUES(?,?,?,?,?,?,?,?)",
                        (
                            import_id,
                            family,
                            source_field,
                            family_rows,
                            field_nulls[source_field],
                            invalid_count,
                            field_min.get(source_field),
                            field_max.get(source_field),
                        ),
                    )
                    rule = RULES.get(family, {}).get(source_field)
                    if rule and invalid_count:
                        connection.execute(
                            "INSERT INTO quality_events(import_id,family,field,rule_code,severity,affected_rows,total_rows,detail) "
                            "VALUES(?,?,?,?,?,?,?,?)",
                            (import_id, family, source_field, rule.code, rule.severity, invalid_count, family_rows, rule.description),
                        )
                if duplicate_timestamps:
                    connection.execute(
                        "INSERT INTO quality_events(import_id,family,field,rule_code,severity,affected_rows,total_rows,detail) "
                        "VALUES(?,?,?,?,?,?,?,?)",
                        (
                            import_id,
                            family,
                            "timer",
                            "duplicate_timestamp",
                            "medium",
                            duplicate_timestamps,
                            family_rows,
                            "Repeated timestamp within the same export; normalized storage keeps one row per vehicle and second.",
                        ),
                    )

            for vehicle_id, (model, first_seen, last_seen) in vehicle_bounds.items():
                connection.execute(
                    "UPDATE vehicles SET model=COALESCE(?,model),first_seen_utc=MIN(first_seen_utc,?)," 
                    "last_seen_utc=MAX(last_seen_utc,?) WHERE vehicle_id=?",
                    (model, first_seen, last_seen, vehicle_id),
                )

            record_import_schemas(connection, import_id, "xpeng", {
                "operation": "data-act/current",
                "energy": "data-act/current",
                "status": "data-act/current",
            })
            completed = int(time.time())
            connection.execute(
                "UPDATE imports SET status='complete',completed_at_utc=?,source_start_utc=?,source_end_utc=?," 
                "vehicle_count=?,total_rows=?,error_message=NULL WHERE import_id=?",
                (completed, source_min, source_max, len(vehicles_seen), total_rows, import_id),
            )
            connection.commit()
    except Exception as exc:
        connection.rollback()
        connection.execute(
            "UPDATE imports SET status='failed',completed_at_utc=?,error_message=? WHERE import_id=?",
            (int(time.time()), str(exc)[:2000], import_id),
        )
        connection.commit()
        connection.close()
        raise

    connection.close()
    return ImportResult(
        import_id=import_id,
        skipped=False,
        archive_sha256=archive_digest,
        archive_path=stored_path,
        total_rows=total_rows,
        source_start_utc=source_min,
        source_end_utc=source_max,
    )

