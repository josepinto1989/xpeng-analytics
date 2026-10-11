from __future__ import annotations

import sqlite3


def validate_database(connection: sqlite3.Connection) -> dict[str, object]:
    """Validate the local XPENG-only database without exposing row contents."""
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    counts = {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in (
            "imports",
            "vehicles",
            "xpeng_operation_seconds",
            "xpeng_energy_seconds",
            "xpeng_status_seconds",
            "trips",
            "journeys",
            "charge_sessions",
            "stops",
            "daily_metrics",
        )
    }
    alignment = connection.execute(
        "SELECT "
        "(SELECT COUNT(*) FROM xpeng_operation_seconds o LEFT JOIN xpeng_energy_seconds e "
        "ON e.vehicle_id=o.vehicle_id AND e.timer=o.timer WHERE e.timer IS NULL) AS operation_without_energy,"
        "(SELECT COUNT(*) FROM xpeng_operation_seconds o LEFT JOIN xpeng_status_seconds s "
        "ON s.vehicle_id=o.vehicle_id AND s.timer=o.timer WHERE s.timer IS NULL) AS operation_without_status"
    ).fetchone()
    orphan_journey_trips = connection.execute(
        "SELECT COUNT(*) FROM journey_trips jt LEFT JOIN journeys j ON j.journey_id=jt.journey_id "
        "LEFT JOIN trips t ON t.trip_id=jt.trip_id WHERE j.journey_id IS NULL OR t.trip_id IS NULL"
    ).fetchone()[0]
    invalid_analytics = connection.execute(
        "SELECT COUNT(*) FROM trips WHERE distance_km < 0 OR duration_s < 0 OR "
        "consumption_kwh_100km IS NOT NULL AND ABS(consumption_kwh_100km) > 200"
    ).fetchone()[0]
    complete_imports = connection.execute("SELECT COUNT(*) FROM imports WHERE status='complete'").fetchone()[0]
    failed_imports = connection.execute("SELECT COUNT(*) FROM imports WHERE status='failed'").fetchone()[0]

    ok = (
        integrity == "ok"
        and alignment["operation_without_energy"] == 0
        and alignment["operation_without_status"] == 0
        and orphan_journey_trips == 0
        and invalid_analytics == 0
        and failed_imports == 0
    )
    return {
        "ok": ok,
        "integrity": integrity,
        "counts": counts,
        "alignment": dict(alignment),
        "orphan_journey_trips": orphan_journey_trips,
        "invalid_analytics_rows": invalid_analytics,
        "complete_imports": complete_imports,
        "failed_imports": failed_imports,
    }


def summary(connection: sqlite3.Connection) -> dict[str, object]:
    source = connection.execute(
        "SELECT MIN(source_start_utc) first_utc,MAX(source_end_utc) last_utc,SUM(total_rows) input_rows,"
        "COUNT(*) imports FROM imports WHERE status='complete'"
    ).fetchone()
    metrics = connection.execute(
        "SELECT COUNT(*) trips,COALESCE(SUM(distance_km),0) distance_km,"
        "COALESCE(SUM(energy_used_kwh),0) energy_used_kwh,"
        "COALESCE(SUM(energy_regenerated_kwh),0) energy_regenerated_kwh,"
        "COALESCE(SUM(net_energy_kwh),0) net_energy_kwh FROM trips"
    ).fetchone()
    charges = connection.execute(
        "SELECT COUNT(*) sessions,COALESCE(SUM(wall_energy_kwh),0) wall_energy_kwh,"
        "COALESCE(SUM(battery_energy_kwh),0) battery_energy_kwh FROM charge_sessions"
    ).fetchone()
    quality = connection.execute(
        "SELECT COUNT(*) events,COALESCE(SUM(affected_rows),0) affected_rows FROM quality_events"
    ).fetchone()
    return {
        "source": dict(source),
        "trips": dict(metrics),
        "charges": dict(charges),
        "quality": dict(quality),
    }
