from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import fmean, median
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


SERIES_POINTS = 180


def local_datetime(timestamp: int, timezone_name: str) -> datetime:
    """Return local clock fields without requiring Pyodide's optional tzdata package."""
    utc = datetime.fromtimestamp(timestamp, timezone.utc)
    try:
        return utc.astimezone(ZoneInfo(timezone_name))
    except ZoneInfoNotFoundError:
        if timezone_name != "Europe/Lisbon":
            return utc
        march_last = max(day for day in range(25, 32) if datetime(utc.year, 3, day).weekday() == 6)
        october_last = max(day for day in range(25, 32) if datetime(utc.year, 10, day).weekday() == 6)
        starts = datetime(utc.year, 3, march_last, 1, tzinfo=timezone.utc)
        ends = datetime(utc.year, 10, october_last, 1, tzinfo=timezone.utc)
        return utc + (timedelta(hours=1) if starts <= utc < ends else timedelta())


def rounded(value: float | int | None, digits: int = 2) -> float | None:
    return round(float(value), digits) if value is not None else None


def iso_utc(timestamp: int | None) -> str | None:
    if timestamp is None:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def present(values) -> list[float]:
    return [float(value) for value in values if value is not None and math.isfinite(float(value))]


def average(values) -> float | None:
    values = present(values)
    return fmean(values) if values else None


def maximum(values) -> float | None:
    values = present(values)
    return max(values) if values else None


def minimum(values) -> float | None:
    values = present(values)
    return min(values) if values else None


def last(values) -> float | None:
    return next((float(value) for value in reversed(list(values)) if value is not None), None)


def rows(connection, statement: str, parameters: tuple = ()) -> list[dict]:
    return [dict(row) for row in connection.execute(statement, parameters).fetchall()]


def bins(values: list[dict], limit: int = SERIES_POINTS) -> list[list[dict]]:
    if not values:
        return []
    width = max(1, math.ceil(len(values) / limit))
    return [values[index:index + width] for index in range(0, len(values), width)]


def trip_series(connection, trip: dict) -> list[dict]:
    samples = rows(
        connection,
        "SELECT o.timer,o.speed_kmh,o.longitudinal_accel,o.accelerator_pct,o.brake_status,"
        "e.pack_voltage_v,e.pack_current_a,e.soc_pct,e.battery_temp_min_c,e.battery_temp_max_c,e.displayed_range_km "
        "FROM xpeng_operation_seconds o LEFT JOIN xpeng_energy_seconds e "
        "ON e.vehicle_id=o.vehicle_id AND e.timer=o.timer "
        "WHERE o.vehicle_id=? AND o.timer BETWEEN ? AND ? ORDER BY o.timer",
        (trip["vehicle_id"], trip["started_at_utc"], trip["ended_at_utc"]),
    )
    output = []
    for group in bins(samples):
        first = group[0]
        powers = [
            row["pack_voltage_v"] * row["pack_current_a"] / 1000
            if row["pack_voltage_v"] is not None and row["pack_current_a"] is not None else None
            for row in group
        ]
        output.append({
            "timestampUtc": iso_utc(first["timer"]),
            "elapsedMinutes": rounded((first["timer"] - trip["started_at_utc"]) / 60, 2),
            "speedKmh": rounded(average(row["speed_kmh"] for row in group), 1),
            "speedPeakKmh": rounded(maximum(row["speed_kmh"] for row in group), 1),
            "powerKw": rounded(average(powers), 2),
            "powerPeakKw": rounded(maximum(powers), 2),
            "socPct": rounded(last(row["soc_pct"] for row in group), 1),
            "displayedRangeKm": rounded(last(row["displayed_range_km"] for row in group), 1),
            "batteryTempC": rounded(maximum(row["battery_temp_max_c"] for row in group), 1),
            "acceleratorPct": rounded(average(row["accelerator_pct"] for row in group), 1),
            "brakePct": rounded((average(1 if row["brake_status"] else 0 for row in group) or 0) * 100, 1),
        })
    return output


def charge_series(connection, charge: dict) -> list[dict]:
    samples = rows(
        connection,
        "SELECT timer,charge_power_kw,pack_voltage_v,pack_current_a,soc_pct,battery_temp_min_c,"
        "battery_temp_max_c FROM xpeng_energy_seconds WHERE vehicle_id=? AND timer BETWEEN ? AND ? ORDER BY timer",
        (charge["vehicle_id"], charge["started_at_utc"], charge["ended_at_utc"]),
    )
    output = []
    for group in bins(samples):
        first = group[0]
        output.append({
            "elapsedMinutes": rounded((first["timer"] - charge["started_at_utc"]) / 60, 1),
            "powerKw": rounded(average(row["charge_power_kw"] for row in group), 2),
            "powerPeakKw": rounded(maximum(row["charge_power_kw"] for row in group), 2),
            "socPct": rounded(last(row["soc_pct"] for row in group), 1),
            "voltageV": rounded(average(row["pack_voltage_v"] for row in group), 1),
            "currentA": rounded(average(-row["pack_current_a"] if row["pack_current_a"] is not None else None for row in group), 1),
            "batteryTempC": rounded(maximum(row["battery_temp_max_c"] for row in group), 1),
        })
    return output


def parking_rows(connection) -> list[dict]:
    output = []
    stops = rows(connection, "SELECT * FROM stops WHERE had_charge=0 AND duration_s>=900 ORDER BY started_at_utc DESC")
    for stop in stops:
        samples = rows(
            connection,
            "SELECT timer,pack_voltage_v,pack_current_a FROM xpeng_energy_seconds "
            "WHERE vehicle_id=? AND timer>? AND timer<? ORDER BY timer",
            (stop["vehicle_id"], stop["started_at_utc"], stop["ended_at_utc"]),
        )
        energy = 0.0
        observed = 0
        for previous, current in zip(samples, samples[1:]):
            delta = current["timer"] - previous["timer"]
            if delta <= 0 or delta > 10:
                continue
            values = []
            for sample in (previous, current):
                if sample["pack_voltage_v"] is not None and sample["pack_current_a"] is not None:
                    values.append(max(0.0, sample["pack_voltage_v"] * sample["pack_current_a"] / 1000))
            if len(values) != 2:
                continue
            energy += sum(values) / 2 * delta / 3600
            observed += delta
        duration_hours = stop["duration_s"] / 3600
        soc_loss = None
        if stop["soc_start_pct"] is not None and stop["soc_end_pct"] is not None:
            soc_loss = max(0.0, stop["soc_start_pct"] - stop["soc_end_pct"])
        output.append({
            "stopId": stop["stop_id"],
            "startedAtUtc": iso_utc(stop["started_at_utc"]),
            "endedAtUtc": iso_utc(stop["ended_at_utc"]),
            "durationHours": rounded(duration_hours, 1),
            "socStartPct": rounded(stop["soc_start_pct"], 1),
            "socEndPct": rounded(stop["soc_end_pct"], 1),
            "socLossPct": rounded(soc_loss, 1),
            "socLossPerHour": rounded(soc_loss / duration_hours, 3) if soc_loss is not None and duration_hours else None,
            "socLossPerDay": rounded(soc_loss / duration_hours * 24, 2) if soc_loss is not None and duration_hours >= 6 else None,
            "energyKwh": rounded(energy, 3),
            "averageWatts": rounded(energy / (observed / 3600) * 1000, 0) if observed else None,
            "observedSeconds": observed,
            "coveragePct": rounded(observed / stop["duration_s"] * 100, 1) if stop["duration_s"] else 0,
            "confidence": "high" if observed >= stop["duration_s"] * .8 else "medium" if observed >= stop["duration_s"] * .4 else "low",
        })
    return output


def build_dashboard_snapshot(connection, timezone_name: str) -> dict:
    trip_records = rows(connection, "SELECT * FROM trips ORDER BY started_at_utc DESC")
    charge_records = rows(connection, "SELECT * FROM charge_sessions ORDER BY started_at_utc DESC")
    daily_records = rows(connection, "SELECT * FROM daily_metrics ORDER BY local_date")
    journey_records = rows(connection, "SELECT * FROM journeys ORDER BY started_at_utc DESC")

    distance = sum(row["distance_km"] or 0 for row in trip_records)
    net_energy = sum(row["net_energy_kwh"] or 0 for row in trip_records)
    wall_energy = sum(row["wall_energy_kwh"] or 0 for row in charge_records)
    battery_energy = sum(row["battery_energy_kwh"] or 0 for row in charge_records)
    overview = {
        "activeDays": len({row["local_date"] for row in trip_records + charge_records}),
        "tripCount": len(trip_records),
        "journeyCount": len(journey_records),
        "chargeCount": len(charge_records),
        "distanceKm": rounded(distance),
        "drivingHours": rounded(sum(row["duration_s"] for row in trip_records) / 3600, 1),
        "netEnergyKwh": rounded(net_energy),
        "regeneratedKwh": rounded(sum(row["energy_regenerated_kwh"] or 0 for row in trip_records)),
        "consumptionKwh100": rounded(net_energy / distance * 100) if distance else None,
        "maxSpeedKmh": rounded(maximum(row["max_speed_kmh"] for row in trip_records), 1),
        "wallEnergyKwh": rounded(wall_energy),
        "batteryEnergyKwh": rounded(battery_energy),
        "chargeEfficiencyPct": rounded(battery_energy / wall_energy * 100, 1) if wall_energy else None,
        "maxChargePowerKw": rounded(maximum(row["max_power_kw"] for row in charge_records), 1),
        "firstUtc": iso_utc(min((row["started_at_utc"] for row in trip_records), default=None)),
        "lastUtc": iso_utc(max((row["ended_at_utc"] for row in trip_records), default=None)),
    }

    daily = [{
        "date": row["local_date"], "trips": row["trip_count"], "journeys": row["journey_count"],
        "distanceKm": rounded(row["distance_km"]), "drivingHours": rounded(row["driving_s"] / 3600, 1),
        "energyUsedKwh": rounded(row["energy_used_kwh"]), "netEnergyKwh": rounded(row["net_energy_kwh"]), "regeneratedKwh": rounded(row["energy_regenerated_kwh"]),
        "consumptionKwh100": rounded(row["consumption_kwh_100km"]), "charges": row["charge_count"],
        "wallEnergyKwh": rounded(row["wall_energy_kwh"]), "batteryEnergyKwh": rounded(row["battery_energy_kwh"]),
    } for row in daily_records]

    trips = []
    trip_by_id = {}
    weekday = defaultdict(lambda: {"trips": 0, "distanceKm": 0.0})
    hours = Counter()
    for row in trip_records:
        local = local_datetime(row["started_at_utc"], timezone_name)
        weekday[local.weekday()]["trips"] += 1
        weekday[local.weekday()]["distanceKm"] += row["distance_km"] or 0
        hours[local.hour] += 1
        item = {
            "tripId": row["trip_id"], "date": row["local_date"],
            "startedAtUtc": iso_utc(row["started_at_utc"]), "endedAtUtc": iso_utc(row["ended_at_utc"]),
            "durationMinutes": rounded(row["duration_s"] / 60, 1), "movingMinutes": rounded(row["moving_s"] / 60, 1),
            "distanceKm": rounded(row["distance_km"]), "maxSpeedKmh": rounded(row["max_speed_kmh"], 1),
            "avgSpeedKmh": rounded(row["avg_speed_kmh"], 1), "netEnergyKwh": rounded(row["net_energy_kwh"], 3),
            "regeneratedKwh": rounded(row["energy_regenerated_kwh"], 3),
            "consumptionKwh100": rounded(row["consumption_kwh_100km"]),
            "socStartPct": rounded(row["soc_start_pct"], 1), "socEndPct": rounded(row["soc_end_pct"], 1),
            "batteryTempMinC": rounded(row["battery_temp_min_c"], 1), "batteryTempMaxC": rounded(row["battery_temp_max_c"], 1),
            "gapCount": row["gap_count"], "series": trip_series(connection, row),
        }
        trips.append(item)
        trip_by_id[row["trip_id"]] = item

    journeys = []
    for row in journey_records:
        trip_ids = [value["trip_id"] for value in connection.execute(
            "SELECT trip_id FROM journey_trips WHERE journey_id=? ORDER BY position", (row["journey_id"],)
        ).fetchall()]
        journeys.append({
            "journeyId": row["journey_id"], "date": row["local_date"],
            "startedAtUtc": iso_utc(row["started_at_utc"]), "endedAtUtc": iso_utc(row["ended_at_utc"]),
            "durationMinutes": rounded(row["duration_s"] / 60, 1), "drivingMinutes": rounded(row["driving_s"] / 60, 1),
            "stoppedMinutes": rounded(row["stopped_s"] / 60, 1), "distanceKm": rounded(row["distance_km"]),
            "netEnergyKwh": rounded(row["net_energy_kwh"], 3), "regeneratedKwh": rounded(row["energy_regenerated_kwh"], 3),
            "consumptionKwh100": rounded(row["consumption_kwh_100km"]), "maxSpeedKmh": rounded(row["max_speed_kmh"], 1),
            "tripIds": trip_ids,
        })

    charges = []
    health = []
    for row in charge_records:
        soc_gain = (row["soc_end_pct"] or 0) - (row["soc_start_pct"] or 0)
        capacity = row["battery_energy_kwh"] / soc_gain * 100 if soc_gain >= 20 and row["battery_energy_kwh"] else None
        item = {
            "chargeId": row["charge_id"], "date": row["local_date"],
            "startedAtUtc": iso_utc(row["started_at_utc"]), "endedAtUtc": iso_utc(row["ended_at_utc"]),
            "durationMinutes": rounded(row["duration_s"] / 60, 1), "wallEnergyKwh": rounded(row["wall_energy_kwh"]),
            "batteryEnergyKwh": rounded(row["battery_energy_kwh"]), "lossKwh": rounded(row["loss_kwh"]),
            "efficiencyPct": rounded(row["efficiency_pct"], 1), "maxPowerKw": rounded(row["max_power_kw"], 1),
            "avgPowerKw": rounded(row["avg_power_kw"], 1), "socStartPct": rounded(row["soc_start_pct"], 1),
            "socEndPct": rounded(row["soc_end_pct"], 1), "batteryTempStartC": rounded(row["battery_temp_start_c"], 1),
            "batteryTempEndC": rounded(row["battery_temp_end_c"], 1), "batteryTempMaxC": rounded(row["battery_temp_max_c"], 1),
            "odometerKm": rounded(row["odometer_km"], 0), "chargeType": "DC" if (row["max_power_kw"] or 0) >= 20 else "AC",
            "series": charge_series(connection, row),
        }
        charges.append(item)
        if capacity is not None and 45 <= capacity <= 100:
            health.append({"date": row["local_date"], "capacityKwh": rounded(capacity), "socGainPct": rounded(soc_gain, 1)})
    health.sort(key=lambda row: row["date"])
    baseline = median([row["capacityKwh"] for row in health[:3]]) if health else None
    for index, row in enumerate(health):
        rolling = median(item["capacityKwh"] for item in health[max(0, index - 2):index + 1])
        row["rollingCapacityKwh"] = rounded(rolling)
        row["relativeSohPct"] = rounded(rolling / baseline * 100, 1) if baseline else None

    monthly = defaultdict(lambda: {"distanceKm": 0.0, "netEnergyKwh": 0.0, "trips": 0, "charges": 0})
    for row in daily:
        key = row["date"][:7]
        monthly[key]["distanceKm"] += row["distanceKm"] or 0
        monthly[key]["netEnergyKwh"] += row["netEnergyKwh"] or 0
        monthly[key]["trips"] += row["trips"]
        monthly[key]["charges"] += row["charges"]

    coverage = []
    for family, table in (("operation", "xpeng_operation_seconds"), ("energy", "xpeng_energy_seconds"), ("status", "xpeng_status_seconds")):
        row = connection.execute(f"SELECT COUNT(*) count,MIN(timer) first_utc,MAX(timer) last_utc FROM {table}").fetchone()
        coverage.append({"family": family, "rows": row["count"], "firstUtc": iso_utc(row["first_utc"]), "lastUtc": iso_utc(row["last_utc"])})

    imports = [{
        "name": row["original_name"], "sha256": row["archive_sha256"], "status": row["status"],
        "rows": row["total_rows"], "completedAtUtc": iso_utc(row["completed_at_utc"]),
        "sourceStartUtc": iso_utc(row["source_start_utc"]), "sourceEndUtc": iso_utc(row["source_end_utc"]),
    } for row in rows(connection, "SELECT * FROM imports ORDER BY import_id DESC")]

    quality = [{
        "family": row["family"], "field": row["field"], "rule": row["rule_code"],
        "severity": row["severity"], "affectedRows": row["affected_rows"], "totalRows": row["total_rows"],
    } for row in rows(connection, "SELECT * FROM quality_events ORDER BY severity DESC,affected_rows DESC")]

    return {
        "format": "xpeng-analytics-dashboard/v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "timezone": timezone_name,
        "overview": overview,
        "daily": daily,
        "trips": trips,
        "journeys": journeys,
        "charges": charges,
        "battery": {
            "capacityKwh": rounded(median([row["capacityKwh"] for row in health])) if health else None,
            "latestRelativeSohPct": health[-1]["relativeSohPct"] if health else None,
            "qualifiedCharges": len(health), "history": health, "parking": parking_rows(connection),
        },
        "activity": {
            "monthly": [{"month": key, **{name: rounded(value) if isinstance(value, float) else value for name, value in values.items()}} for key, values in sorted(monthly.items())],
            "weekday": [{"weekday": index, "trips": weekday[index]["trips"], "distanceKm": rounded(weekday[index]["distanceKm"])} for index in range(7)],
            "hours": [{"hour": hour, "trips": hours[hour]} for hour in range(24)],
        },
        "quality": {"coverage": coverage, "events": quality},
        "imports": imports,
    }
