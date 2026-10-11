from __future__ import annotations

import hashlib
import sqlite3
from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


ALGORITHM_VERSION = "v1.0.0"
MOVING_SPEED_KMH = 1.0
TRIP_BREAK_SECONDS = 300
JOURNEY_BREAK_SECONDS = 3600
CHARGE_POWER_KW = 0.2
CHARGE_BREAK_SECONDS = 600
MAX_INTEGRATION_GAP_SECONDS = 10


def _stable_id(prefix: str, *parts: object) -> str:
    payload = "|".join(str(part) for part in parts)
    return f"{prefix}_{hashlib.sha256(payload.encode('utf-8')).hexdigest()[:24]}"


def _local_date(timestamp: int, timezone_name: str) -> str:
    instant = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    try:
        zone = ZoneInfo(timezone_name)
        return instant.astimezone(zone).date().isoformat()
    except ZoneInfoNotFoundError:
        if timezone_name != "Europe/Lisbon":
            raise
        # Windows Python installations may not ship the IANA tzdata package.
        # Portugal follows the EU rule: DST is active from the last Sunday of
        # March at 01:00 UTC until the last Sunday of October at 01:00 UTC.
        def last_sunday(year: int, month: int) -> datetime:
            last_day = monthrange(year, month)[1]
            value = datetime(year, month, last_day, 1, tzinfo=timezone.utc)
            return value - timedelta(days=(value.weekday() + 1) % 7)

        dst_start = last_sunday(instant.year, 3)
        dst_end = last_sunday(instant.year, 10)
        offset = timedelta(hours=1) if dst_start <= instant < dst_end else timedelta(0)
        return (instant + offset).date().isoformat()


def _safe_sum(values: list[float | None]) -> float:
    return sum(value for value in values if value is not None)


def _first(values: list[float | None]) -> float | None:
    return next((value for value in values if value is not None), None)


def _last(values: list[float | None]) -> float | None:
    return next((value for value in reversed(values) if value is not None), None)


@dataclass(frozen=True)
class Boundary:
    vehicle_id: str
    start: int
    end: int


def _boundaries(
    connection: sqlite3.Connection,
    table: str,
    predicate: str,
    break_seconds: int,
) -> list[Boundary]:
    rows = connection.execute(
        f"SELECT vehicle_id,timer FROM {table} WHERE {predicate} ORDER BY vehicle_id,timer"
    )
    boundaries: list[Boundary] = []
    current_vehicle: str | None = None
    start: int | None = None
    previous: int | None = None
    for row in rows:
        vehicle_id = row["vehicle_id"]
        timer = int(row["timer"])
        if current_vehicle != vehicle_id or previous is None or timer - previous > break_seconds:
            if current_vehicle is not None and start is not None and previous is not None:
                boundaries.append(Boundary(current_vehicle, start, previous))
            current_vehicle = vehicle_id
            start = timer
        previous = timer
    if current_vehicle is not None and start is not None and previous is not None:
        boundaries.append(Boundary(current_vehicle, start, previous))
    return boundaries


def _aggregate_trip(
    connection: sqlite3.Connection,
    boundary: Boundary,
    timezone_name: str,
) -> dict[str, object] | None:
    rows = connection.execute(
        "SELECT o.timer,o.speed_kmh,o.odometer_km,e.pack_voltage_v,e.pack_current_a,e.soc_pct," 
        "e.battery_temp_min_c,e.battery_temp_max_c "
        "FROM xpeng_operation_seconds o LEFT JOIN xpeng_energy_seconds e "
        "ON e.vehicle_id=o.vehicle_id AND e.timer=o.timer "
        "WHERE o.vehicle_id=? AND o.timer BETWEEN ? AND ? ORDER BY o.timer",
        (boundary.vehicle_id, boundary.start, boundary.end),
    )
    distance = 0.0
    moving_s = 0
    used = 0.0
    regenerated = 0.0
    data_points = 0
    gap_count = 0
    maximum_speed: float | None = None
    odometers: list[float | None] = []
    socs: list[float | None] = []
    min_temperatures: list[float] = []
    max_temperatures: list[float] = []
    previous: sqlite3.Row | None = None

    for row in rows:
        data_points += 1
        speed = row["speed_kmh"]
        if speed is not None:
            maximum_speed = speed if maximum_speed is None else max(maximum_speed, speed)
        odometers.append(row["odometer_km"])
        socs.append(row["soc_pct"])
        if row["battery_temp_min_c"] is not None:
            min_temperatures.append(row["battery_temp_min_c"])
        if row["battery_temp_max_c"] is not None:
            max_temperatures.append(row["battery_temp_max_c"])

        if previous is not None:
            delta = int(row["timer"]) - int(previous["timer"])
            if delta <= 0:
                previous = row
                continue
            if delta > MAX_INTEGRATION_GAP_SECONDS:
                gap_count += 1
                previous = row
                continue
            previous_speed = previous["speed_kmh"] or 0.0
            current_speed = speed or 0.0
            average_speed = (previous_speed + current_speed) / 2
            distance += average_speed * delta / 3600
            if average_speed >= MOVING_SPEED_KMH:
                moving_s += delta

            previous_power = _battery_power(previous)
            current_power = _battery_power(row)
            if previous_power is not None and current_power is not None:
                average_power = (previous_power + current_power) / 2
                energy = average_power * delta / 3600
                if energy >= 0:
                    used += energy
                else:
                    regenerated += -energy
        previous = row

    if data_points == 0 or distance < 0.05:
        return None
    duration = max(0, boundary.end - boundary.start)
    net = used - regenerated
    return {
        "trip_id": _stable_id("trip", boundary.vehicle_id, boundary.start, boundary.end, ALGORITHM_VERSION),
        "vehicle_id": boundary.vehicle_id,
        "started_at_utc": boundary.start,
        "ended_at_utc": boundary.end,
        "local_date": _local_date(boundary.start, timezone_name),
        "duration_s": duration,
        "moving_s": moving_s,
        "distance_km": distance,
        "odometer_start_km": _first(odometers),
        "odometer_end_km": _last(odometers),
        "max_speed_kmh": maximum_speed,
        "avg_speed_kmh": distance / (duration / 3600) if duration else None,
        "energy_used_kwh": used,
        "energy_regenerated_kwh": regenerated,
        "net_energy_kwh": net,
        "consumption_kwh_100km": net / distance * 100 if distance else None,
        "soc_start_pct": _first(socs),
        "soc_end_pct": _last(socs),
        "battery_temp_min_c": min(min_temperatures) if min_temperatures else None,
        "battery_temp_max_c": max(max_temperatures) if max_temperatures else None,
        "data_points": data_points,
        "gap_count": gap_count,
        "algorithm_version": ALGORITHM_VERSION,
    }


def _battery_power(row: sqlite3.Row) -> float | None:
    voltage = row["pack_voltage_v"]
    current = row["pack_current_a"]
    if voltage is None or current is None:
        return None
    return voltage * current / 1000


def rebuild_trips(connection: sqlite3.Connection, timezone_name: str) -> int:
    connection.execute("DELETE FROM trips")
    boundaries = _boundaries(
        connection,
        "xpeng_operation_seconds",
        f"speed_kmh >= {MOVING_SPEED_KMH}",
        TRIP_BREAK_SECONDS,
    )
    columns = (
        "trip_id", "vehicle_id", "started_at_utc", "ended_at_utc", "local_date", "duration_s",
        "moving_s", "distance_km", "odometer_start_km", "odometer_end_km", "max_speed_kmh",
        "avg_speed_kmh", "energy_used_kwh", "energy_regenerated_kwh", "net_energy_kwh",
        "consumption_kwh_100km", "soc_start_pct", "soc_end_pct", "battery_temp_min_c",
        "battery_temp_max_c", "data_points", "gap_count", "algorithm_version",
    )
    sql = f"INSERT INTO trips({','.join(columns)}) VALUES({','.join('?' for _ in columns)})"
    count = 0
    for boundary in boundaries:
        trip = _aggregate_trip(connection, boundary, timezone_name)
        if trip:
            connection.execute(sql, tuple(trip[column] for column in columns))
            count += 1
    return count


def _aggregate_charge(
    connection: sqlite3.Connection,
    boundary: Boundary,
    timezone_name: str,
) -> dict[str, object] | None:
    rows = list(
        connection.execute(
            "SELECT e.timer,e.pack_voltage_v,e.pack_current_a,e.charge_power_kw,e.soc_pct," 
            "e.battery_temp_max_c,o.odometer_km "
            "FROM xpeng_energy_seconds e LEFT JOIN xpeng_operation_seconds o "
            "ON o.vehicle_id=e.vehicle_id AND o.timer=e.timer "
            "WHERE e.vehicle_id=? AND e.timer BETWEEN ? AND ? ORDER BY e.timer",
            (boundary.vehicle_id, boundary.start, boundary.end),
        )
    )
    if not rows:
        return None
    wall = 0.0
    battery = 0.0
    gap_count = 0
    weighted_power = 0.0
    integrated_seconds = 0
    for previous, current in zip(rows, rows[1:]):
        delta = int(current["timer"]) - int(previous["timer"])
        if delta <= 0:
            continue
        if delta > MAX_INTEGRATION_GAP_SECONDS:
            gap_count += 1
            continue
        p1 = previous["charge_power_kw"] or 0.0
        p2 = current["charge_power_kw"] or 0.0
        average_wall_power = max(0.0, (p1 + p2) / 2)
        wall += average_wall_power * delta / 3600
        weighted_power += average_wall_power * delta
        integrated_seconds += delta
        b1 = _battery_power(previous)
        b2 = _battery_power(current)
        if b1 is not None and b2 is not None:
            average_battery_power = (b1 + b2) / 2
            if average_battery_power < 0:
                battery += -average_battery_power * delta / 3600

    duration = max(0, boundary.end - boundary.start)
    if duration < 30 and wall < 0.02:
        return None
    socs = [row["soc_pct"] for row in rows]
    temperatures = [row["battery_temp_max_c"] for row in rows if row["battery_temp_max_c"] is not None]
    odometers = [row["odometer_km"] for row in rows]
    max_power = max((row["charge_power_kw"] or 0.0) for row in rows)
    loss = wall - battery
    return {
        "charge_id": _stable_id("charge", boundary.vehicle_id, boundary.start, boundary.end, ALGORITHM_VERSION),
        "vehicle_id": boundary.vehicle_id,
        "started_at_utc": boundary.start,
        "ended_at_utc": boundary.end,
        "local_date": _local_date(boundary.start, timezone_name),
        "duration_s": duration,
        "wall_energy_kwh": wall,
        "battery_energy_kwh": battery,
        "loss_kwh": loss,
        "efficiency_pct": battery / wall * 100 if wall > 0 else None,
        "max_power_kw": max_power,
        "avg_power_kw": weighted_power / integrated_seconds if integrated_seconds else None,
        "soc_start_pct": _first(socs),
        "soc_end_pct": _last(socs),
        "battery_temp_start_c": _first([row["battery_temp_max_c"] for row in rows]),
        "battery_temp_end_c": _last([row["battery_temp_max_c"] for row in rows]),
        "battery_temp_max_c": max(temperatures) if temperatures else None,
        "odometer_km": _first(odometers),
        "data_points": len(rows),
        "gap_count": gap_count,
        "algorithm_version": ALGORITHM_VERSION,
    }


def rebuild_charge_sessions(connection: sqlite3.Connection, timezone_name: str) -> int:
    connection.execute("DELETE FROM charge_sessions")
    boundaries = _boundaries(
        connection,
        "xpeng_energy_seconds",
        f"charge_power_kw > {CHARGE_POWER_KW}",
        CHARGE_BREAK_SECONDS,
    )
    columns = (
        "charge_id", "vehicle_id", "started_at_utc", "ended_at_utc", "local_date", "duration_s",
        "wall_energy_kwh", "battery_energy_kwh", "loss_kwh", "efficiency_pct", "max_power_kw",
        "avg_power_kw", "soc_start_pct", "soc_end_pct", "battery_temp_start_c",
        "battery_temp_end_c", "battery_temp_max_c", "odometer_km", "data_points", "gap_count",
        "algorithm_version",
    )
    sql = f"INSERT INTO charge_sessions({','.join(columns)}) VALUES({','.join('?' for _ in columns)})"
    count = 0
    for boundary in boundaries:
        charge = _aggregate_charge(connection, boundary, timezone_name)
        if charge:
            connection.execute(sql, tuple(charge[column] for column in columns))
            count += 1
    return count


def rebuild_journeys_and_stops(connection: sqlite3.Connection, timezone_name: str) -> tuple[int, int]:
    connection.execute("DELETE FROM journey_trips")
    connection.execute("DELETE FROM stops")
    connection.execute("DELETE FROM journeys")
    trips = list(connection.execute("SELECT * FROM trips ORDER BY vehicle_id,started_at_utc"))
    groups: list[list[sqlite3.Row]] = []
    current: list[sqlite3.Row] = []
    for trip in trips:
        if not current or (
            trip["vehicle_id"] == current[-1]["vehicle_id"]
            and trip["started_at_utc"] - current[-1]["ended_at_utc"] <= JOURNEY_BREAK_SECONDS
        ):
            current.append(trip)
        else:
            groups.append(current)
            current = [trip]
    if current:
        groups.append(current)

    stop_count = 0
    for group in groups:
        first_trip, last_trip = group[0], group[-1]
        journey_id = _stable_id(
            "journey", first_trip["vehicle_id"], first_trip["started_at_utc"], last_trip["ended_at_utc"], ALGORITHM_VERSION
        )
        distance = sum(trip["distance_km"] for trip in group)
        used = sum(trip["energy_used_kwh"] or 0 for trip in group)
        regenerated = sum(trip["energy_regenerated_kwh"] or 0 for trip in group)
        net = used - regenerated
        driving_s = sum(trip["duration_s"] for trip in group)
        duration_s = last_trip["ended_at_utc"] - first_trip["started_at_utc"]
        stopped_s = max(0, duration_s - driving_s)
        connection.execute(
            "INSERT INTO journeys(journey_id,vehicle_id,started_at_utc,ended_at_utc,local_date,trip_count," 
            "stop_count,duration_s,driving_s,stopped_s,distance_km,energy_used_kwh,energy_regenerated_kwh," 
            "net_energy_kwh,consumption_kwh_100km,max_speed_kmh,algorithm_version) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                journey_id,
                first_trip["vehicle_id"],
                first_trip["started_at_utc"],
                last_trip["ended_at_utc"],
                _local_date(first_trip["started_at_utc"], timezone_name),
                len(group),
                max(0, len(group) - 1),
                duration_s,
                driving_s,
                stopped_s,
                distance,
                used,
                regenerated,
                net,
                net / distance * 100 if distance else None,
                max((trip["max_speed_kmh"] or 0) for trip in group),
                ALGORITHM_VERSION,
            ),
        )
        for position, trip in enumerate(group):
            connection.execute(
                "INSERT INTO journey_trips(journey_id,trip_id,position) VALUES(?,?,?)",
                (journey_id, trip["trip_id"], position),
            )
        for previous, following in zip(group, group[1:]):
            _insert_stop(connection, journey_id, previous, following, "journey_stop")
            stop_count += 1

    for previous, following in zip(trips, trips[1:]):
        if previous["vehicle_id"] != following["vehicle_id"]:
            continue
        gap = following["started_at_utc"] - previous["ended_at_utc"]
        if gap > JOURNEY_BREAK_SECONDS:
            _insert_stop(connection, None, previous, following, "parked")
            stop_count += 1
    return len(groups), stop_count


def _insert_stop(
    connection: sqlite3.Connection,
    journey_id: str | None,
    previous: sqlite3.Row,
    following: sqlite3.Row,
    kind: str,
) -> None:
    start = int(previous["ended_at_utc"])
    end = int(following["started_at_utc"])
    charge = connection.execute(
        "SELECT EXISTS(SELECT 1 FROM charge_sessions WHERE vehicle_id=? AND started_at_utc < ? AND ended_at_utc > ?)",
        (previous["vehicle_id"], end, start),
    ).fetchone()[0]
    soc_start = previous["soc_end_pct"]
    soc_end = following["soc_start_pct"]
    soc_change = soc_end - soc_start if soc_start is not None and soc_end is not None else None
    connection.execute(
        "INSERT INTO stops(stop_id,journey_id,vehicle_id,started_at_utc,ended_at_utc,duration_s,kind," 
        "soc_start_pct,soc_end_pct,soc_change_pct,had_charge,algorithm_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            _stable_id("stop", previous["vehicle_id"], start, end, kind, ALGORITHM_VERSION),
            journey_id,
            previous["vehicle_id"],
            start,
            end,
            end - start,
            kind,
            soc_start,
            soc_end,
            soc_change,
            int(bool(charge)),
            ALGORITHM_VERSION,
        ),
    )


def rebuild_daily_metrics(connection: sqlite3.Connection) -> int:
    connection.execute("DELETE FROM daily_metrics")
    keys = connection.execute(
        "SELECT vehicle_id,local_date FROM trips UNION SELECT vehicle_id,local_date FROM charge_sessions"
    ).fetchall()
    for key in keys:
        vehicle_id, local_date = key["vehicle_id"], key["local_date"]
        trip = connection.execute(
            "SELECT COUNT(*) count,COALESCE(SUM(distance_km),0) distance,COALESCE(SUM(duration_s),0) driving," 
            "COALESCE(SUM(energy_used_kwh),0) used,COALESCE(SUM(energy_regenerated_kwh),0) regen," 
            "COALESCE(SUM(net_energy_kwh),0) net FROM trips WHERE vehicle_id=? AND local_date=?",
            (vehicle_id, local_date),
        ).fetchone()
        journey_count = connection.execute(
            "SELECT COUNT(*) FROM journeys WHERE vehicle_id=? AND local_date=?",
            (vehicle_id, local_date),
        ).fetchone()[0]
        charge = connection.execute(
            "SELECT COUNT(*) count,COALESCE(SUM(wall_energy_kwh),0) wall,COALESCE(SUM(battery_energy_kwh),0) battery "
            "FROM charge_sessions WHERE vehicle_id=? AND local_date=?",
            (vehicle_id, local_date),
        ).fetchone()
        consumption = trip["net"] / trip["distance"] * 100 if trip["distance"] else None
        connection.execute(
            "INSERT INTO daily_metrics(vehicle_id,local_date,trip_count,journey_count,distance_km,driving_s," 
            "energy_used_kwh,energy_regenerated_kwh,net_energy_kwh,consumption_kwh_100km,charge_count," 
            "wall_energy_kwh,battery_energy_kwh) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                vehicle_id, local_date, trip["count"], journey_count, trip["distance"], trip["driving"],
                trip["used"], trip["regen"], trip["net"], consumption, charge["count"], charge["wall"], charge["battery"],
            ),
        )
    return len(keys)


def rebuild_all(connection: sqlite3.Connection, timezone_name: str) -> dict[str, int]:
    connection.execute("BEGIN IMMEDIATE")
    try:
        trips = rebuild_trips(connection, timezone_name)
        charges = rebuild_charge_sessions(connection, timezone_name)
        journeys, stops = rebuild_journeys_and_stops(connection, timezone_name)
        days = rebuild_daily_metrics(connection)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return {
        "trips": trips,
        "charge_sessions": charges,
        "journeys": journeys,
        "stops": stops,
        "days": days,
    }

