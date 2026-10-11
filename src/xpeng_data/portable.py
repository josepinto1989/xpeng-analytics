from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import Settings
from .db import SCHEMA_VERSION, connect
from .security import KEY_FILENAME


FORMAT = "xpeng-analytics-history"
FORMAT_VERSION = 1
MAX_COMPRESSED_BYTES = 512 * 1024 * 1024
MAX_JSON_BYTES = 768 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
REQUIRED_TABLES = {
    "schema_meta", "imports", "import_files", "vehicles",
    "xpeng_operation_seconds", "xpeng_energy_seconds", "xpeng_status_seconds",
}


class PortableHistoryError(ValueError):
    pass


def _temporary_path(settings: Settings, suffix: str) -> Path:
    settings.data_root.mkdir(parents=True, exist_ok=True)
    return settings.data_root / f".portable-{secrets.token_hex(8)}{suffix}"


def _validate_database(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        integrity = connection.execute("PRAGMA quick_check").fetchone()[0]
        if integrity != "ok":
            raise PortableHistoryError("history_integrity")
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        if not REQUIRED_TABLES.issubset(tables):
            raise PortableHistoryError("history_schema")
        version = connection.execute(
            "SELECT value FROM schema_meta WHERE key='schema_version'"
        ).fetchone()
        if version is None or int(version[0]) != SCHEMA_VERSION:
            raise PortableHistoryError("history_version")
        if connection.execute("SELECT COUNT(*) FROM imports WHERE source <> 'xpeng'").fetchone()[0]:
            raise PortableHistoryError("history_source")
        for table in ("vehicles", "xpeng_operation_seconds", "xpeng_energy_seconds", "xpeng_status_seconds"):
            columns = {row[1].lower() for row in connection.execute(f"PRAGMA table_info({table})")}
            if "vin" in columns:
                raise PortableHistoryError("history_private_identifier")
    except sqlite3.DatabaseError as exc:
        raise PortableHistoryError("history_database") from exc
    finally:
        connection.close()


def export_portable_history(destination: Path, settings: Settings | None = None) -> dict:
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    key_path = settings.private_root / KEY_FILENAME
    if not settings.database_path.is_file() or not key_path.is_file():
        raise PortableHistoryError("history_empty")

    copy_path = _temporary_path(settings, ".db")
    source = connect(settings.database_path)
    target = sqlite3.connect(copy_path)
    try:
        source.execute("PRAGMA wal_checkpoint(FULL)")
        source.backup(target)
        target.execute("UPDATE imports SET stored_path='', error_message=NULL")
        target.commit()
        target.execute("VACUUM")
    finally:
        target.close()
        source.close()

    try:
        _validate_database(copy_path)
        database = copy_path.read_bytes()
        vehicle_key = key_path.read_bytes()
        if len(vehicle_key) != 32:
            raise PortableHistoryError("history_vehicle_key")
        exported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        document = {
            "format": FORMAT,
            "version": FORMAT_VERSION,
            "exportedAtUtc": exported_at,
            "schemaVersion": SCHEMA_VERSION,
            "timezone": settings.timezone,
            "databaseSha256": hashlib.sha256(database).hexdigest(),
            "databaseBase64": base64.b64encode(database).decode("ascii"),
            "vehicleKeyBase64": base64.b64encode(vehicle_key).decode("ascii"),
        }
        destination.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(destination, "wt", encoding="utf-8", compresslevel=6) as handle:
            json.dump(document, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        return {
            "format": FORMAT,
            "version": FORMAT_VERSION,
            "exportedAtUtc": exported_at,
            "databaseBytes": len(database),
            "compressedBytes": destination.stat().st_size,
        }
    finally:
        copy_path.unlink(missing_ok=True)


def import_portable_history(source: Path, settings: Settings | None = None) -> dict:
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    if not source.is_file() or source.stat().st_size > MAX_COMPRESSED_BYTES:
        raise PortableHistoryError("history_size")
    compressed_bytes = source.stat().st_size
    try:
        with gzip.open(source, "rb") as handle:
            chunks = []
            total = 0
            while chunk := handle.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_JSON_BYTES or total > compressed_bytes * MAX_COMPRESSION_RATIO + 1024 * 1024:
                    raise PortableHistoryError("history_size")
                chunks.append(chunk)
            raw = b"".join(chunks)
    except (OSError, EOFError) as exc:
        raise PortableHistoryError("history_gzip") from exc
    try:
        document = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PortableHistoryError("history_json") from exc
    if not isinstance(document, dict) or document.get("format") != FORMAT:
        raise PortableHistoryError("history_format")
    if document.get("version") != FORMAT_VERSION or document.get("schemaVersion") != SCHEMA_VERSION:
        raise PortableHistoryError("history_version")
    try:
        database = base64.b64decode(document["databaseBase64"], validate=True)
        vehicle_key = base64.b64decode(document["vehicleKeyBase64"], validate=True)
    except (KeyError, TypeError, ValueError) as exc:
        raise PortableHistoryError("history_payload") from exc
    if len(vehicle_key) != 32 or not database.startswith(b"SQLite format 3\x00"):
        raise PortableHistoryError("history_payload")
    if hashlib.sha256(database).hexdigest() != document.get("databaseSha256"):
        raise PortableHistoryError("history_integrity")

    candidate = _temporary_path(settings, ".db")
    candidate.write_bytes(database)
    try:
        _validate_database(candidate)
        for suffix in ("-wal", "-shm"):
            Path(f"{settings.database_path}{suffix}").unlink(missing_ok=True)
        os.replace(candidate, settings.database_path)
        key_path = settings.private_root / KEY_FILENAME
        key_path.write_bytes(vehicle_key)
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
    finally:
        candidate.unlink(missing_ok=True)
    return {
        "format": FORMAT,
        "version": FORMAT_VERSION,
        "exportedAtUtc": document.get("exportedAtUtc"),
        "timezone": document.get("timezone"),
        "databaseBytes": len(database),
    }
