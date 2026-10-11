from __future__ import annotations

import sqlite3
from pathlib import Path


SCHEMA_VERSION = 1


DDL = r"""
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imports (
    import_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL CHECK (source = 'xpeng'),
    archive_sha256 TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    received_at_utc INTEGER NOT NULL,
    started_at_utc INTEGER NOT NULL,
    completed_at_utc INTEGER,
    status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
    source_start_utc INTEGER,
    source_end_utc INTEGER,
    vehicle_count INTEGER NOT NULL DEFAULT 0,
    total_rows INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS import_files (
    import_file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES imports(import_id) ON DELETE CASCADE,
    family TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_sha256 TEXT NOT NULL,
    columns_json TEXT NOT NULL,
    rows_read INTEGER NOT NULL,
    duplicate_timestamps INTEGER NOT NULL DEFAULT 0,
    new_rows INTEGER NOT NULL DEFAULT 0,
    updated_rows INTEGER NOT NULL DEFAULT 0,
    unchanged_rows INTEGER NOT NULL DEFAULT 0,
    first_timer INTEGER,
    last_timer INTEGER,
    UNIQUE(import_id, member_name)
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id TEXT PRIMARY KEY,
    model TEXT,
    first_seen_utc INTEGER NOT NULL,
    last_seen_utc INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS xpeng_operation_seconds (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    timer INTEGER NOT NULL,
    source_ds TEXT,
    model TEXT,
    speed_kmh REAL,
    longitudinal_accel REAL,
    lateral_accel REAL,
    odometer_km REAL,
    steering_angle_deg REAL,
    steering_speed_deg_s REAL,
    accelerator_pct REAL,
    brake_status REAL,
    gear_level REAL,
    quality_mask INTEGER NOT NULL DEFAULT 0,
    row_hash TEXT NOT NULL,
    first_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    last_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    PRIMARY KEY (vehicle_id, timer)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS xpeng_energy_seconds (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    timer INTEGER NOT NULL,
    source_ds TEXT,
    model TEXT,
    front_motor_rpm REAL,
    rear_motor_rpm REAL,
    front_motor_torque_nm REAL,
    rear_motor_torque_nm REAL,
    front_rotor_temp_c REAL,
    rear_rotor_temp_c REAL,
    pack_voltage_v REAL,
    pack_current_a REAL,
    charge_power_kw REAL,
    soc_pct REAL,
    battery_temp_max_c REAL,
    battery_temp_min_c REAL,
    hottest_cell_index REAL,
    coldest_cell_index REAL,
    displayed_range_km REAL,
    quality_mask INTEGER NOT NULL DEFAULT 0,
    row_hash TEXT NOT NULL,
    first_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    last_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    PRIMARY KEY (vehicle_id, timer)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS xpeng_status_seconds (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    timer INTEGER NOT NULL,
    source_ds TEXT,
    model TEXT,
    driver_door_ajar REAL,
    passenger_door_ajar REAL,
    rear_left_door_ajar REAL,
    rear_right_door_ajar REAL,
    front_left_window_position REAL,
    rear_left_window_position REAL,
    front_right_window_position REAL,
    rear_right_window_position REAL,
    trunk_open_status REAL,
    tyre_pressure_fl_kpa REAL,
    tyre_pressure_fr_kpa REAL,
    tyre_pressure_rl_kpa REAL,
    tyre_pressure_rr_kpa REAL,
    quality_mask INTEGER NOT NULL DEFAULT 0,
    row_hash TEXT NOT NULL,
    first_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    last_import_id INTEGER NOT NULL REFERENCES imports(import_id),
    PRIMARY KEY (vehicle_id, timer)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS field_profiles (
    import_id INTEGER NOT NULL REFERENCES imports(import_id) ON DELETE CASCADE,
    family TEXT NOT NULL,
    field TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    null_rows INTEGER NOT NULL,
    invalid_rows INTEGER NOT NULL,
    minimum REAL,
    maximum REAL,
    PRIMARY KEY (import_id, family, field)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS quality_events (
    quality_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER REFERENCES imports(import_id) ON DELETE CASCADE,
    family TEXT NOT NULL,
    field TEXT,
    rule_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_rows INTEGER NOT NULL,
    total_rows INTEGER NOT NULL,
    detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_schema_snapshots (
    schema_snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES imports(import_id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source = 'xpeng'),
    family TEXT NOT NULL,
    source_version TEXT NOT NULL DEFAULT 'unknown',
    schema_hash TEXT NOT NULL,
    columns_json TEXT NOT NULL,
    observed_at_utc INTEGER NOT NULL,
    UNIQUE(import_id, family)
);

CREATE INDEX IF NOT EXISTS idx_schema_snapshots_source_family
    ON import_schema_snapshots(source, family, import_id);

CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    started_at_utc INTEGER NOT NULL,
    ended_at_utc INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    duration_s INTEGER NOT NULL,
    moving_s INTEGER NOT NULL,
    distance_km REAL NOT NULL,
    odometer_start_km REAL,
    odometer_end_km REAL,
    max_speed_kmh REAL,
    avg_speed_kmh REAL,
    energy_used_kwh REAL,
    energy_regenerated_kwh REAL,
    net_energy_kwh REAL,
    consumption_kwh_100km REAL,
    soc_start_pct REAL,
    soc_end_pct REAL,
    battery_temp_min_c REAL,
    battery_temp_max_c REAL,
    data_points INTEGER NOT NULL,
    gap_count INTEGER NOT NULL,
    algorithm_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_start
    ON trips(vehicle_id, started_at_utc);

CREATE TABLE IF NOT EXISTS journeys (
    journey_id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    started_at_utc INTEGER NOT NULL,
    ended_at_utc INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    trip_count INTEGER NOT NULL,
    stop_count INTEGER NOT NULL,
    duration_s INTEGER NOT NULL,
    driving_s INTEGER NOT NULL,
    stopped_s INTEGER NOT NULL,
    distance_km REAL NOT NULL,
    energy_used_kwh REAL,
    energy_regenerated_kwh REAL,
    net_energy_kwh REAL,
    consumption_kwh_100km REAL,
    max_speed_kmh REAL,
    algorithm_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_trips (
    journey_id TEXT NOT NULL REFERENCES journeys(journey_id) ON DELETE CASCADE,
    trip_id TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (journey_id, trip_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT PRIMARY KEY,
    journey_id TEXT REFERENCES journeys(journey_id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    started_at_utc INTEGER NOT NULL,
    ended_at_utc INTEGER NOT NULL,
    duration_s INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('journey_stop', 'parked')),
    soc_start_pct REAL,
    soc_end_pct REAL,
    soc_change_pct REAL,
    had_charge INTEGER NOT NULL DEFAULT 0,
    algorithm_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_sessions (
    charge_id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    started_at_utc INTEGER NOT NULL,
    ended_at_utc INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    duration_s INTEGER NOT NULL,
    wall_energy_kwh REAL,
    battery_energy_kwh REAL,
    loss_kwh REAL,
    efficiency_pct REAL,
    max_power_kw REAL,
    avg_power_kw REAL,
    soc_start_pct REAL,
    soc_end_pct REAL,
    battery_temp_start_c REAL,
    battery_temp_end_c REAL,
    battery_temp_max_c REAL,
    odometer_km REAL,
    data_points INTEGER NOT NULL,
    gap_count INTEGER NOT NULL,
    algorithm_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_charges_vehicle_start
    ON charge_sessions(vehicle_id, started_at_utc);

CREATE TABLE IF NOT EXISTS daily_metrics (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
    local_date TEXT NOT NULL,
    trip_count INTEGER NOT NULL DEFAULT 0,
    journey_count INTEGER NOT NULL DEFAULT 0,
    distance_km REAL NOT NULL DEFAULT 0,
    driving_s INTEGER NOT NULL DEFAULT 0,
    energy_used_kwh REAL NOT NULL DEFAULT 0,
    energy_regenerated_kwh REAL NOT NULL DEFAULT 0,
    net_energy_kwh REAL NOT NULL DEFAULT 0,
    consumption_kwh_100km REAL,
    charge_count INTEGER NOT NULL DEFAULT 0,
    wall_energy_kwh REAL NOT NULL DEFAULT 0,
    battery_energy_kwh REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (vehicle_id, local_date)
) WITHOUT ROWID;

CREATE VIEW IF NOT EXISTS telemetry_seconds AS
SELECT
    o.vehicle_id,
    o.timer,
    o.source_ds,
    o.speed_kmh,
    o.odometer_km,
    o.accelerator_pct,
    o.brake_status,
    e.pack_voltage_v,
    e.pack_current_a,
    e.charge_power_kw,
    e.soc_pct,
    e.battery_temp_min_c,
    e.battery_temp_max_c,
    e.displayed_range_km,
    s.tyre_pressure_fl_kpa,
    s.tyre_pressure_fr_kpa,
    s.tyre_pressure_rl_kpa,
    s.tyre_pressure_rr_kpa
FROM xpeng_operation_seconds o
LEFT JOIN xpeng_energy_seconds e
  ON e.vehicle_id = o.vehicle_id AND e.timer = o.timer
LEFT JOIN xpeng_status_seconds s
  ON s.vehicle_id = o.vehicle_id AND s.timer = o.timer;
"""


def connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=60)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA temp_store = MEMORY")
    connection.execute("PRAGMA cache_size = -131072")
    return connection


def initialise(connection: sqlite3.Connection) -> None:
    connection.executescript(DDL)
    connection.execute(
        "INSERT INTO schema_meta(key, value) VALUES('schema_version', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (str(SCHEMA_VERSION),),
    )
    connection.commit()

