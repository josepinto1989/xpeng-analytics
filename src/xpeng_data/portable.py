from __future__ import annotations

import base64
import gzip
import hashlib
import json
import lzma
import os
import secrets
import sqlite3
import struct
from datetime import datetime, timezone
from pathlib import Path

from .config import Settings
from .db import SCHEMA_VERSION, connect
from .security import KEY_FILENAME


FORMAT = "xpeng-analytics-history"
FORMAT_VERSION = 2
LEGACY_FORMAT_VERSION = 1
MAGIC = b"XPENGA\x00\x02"
HEADER_LENGTH = struct.Struct(">I")
CHUNK_BYTES = 1024 * 1024
MAX_COMPRESSED_BYTES = 512 * 1024 * 1024
MAX_DATABASE_BYTES = 2 * 1024 * 1024 * 1024
MAX_JSON_BYTES = 768 * 1024 * 1024
MAX_HEADER_BYTES = 64 * 1024
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


def _database_copy(settings: Settings) -> Path:
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
    return copy_path


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def _install_database(candidate: Path, vehicle_key: bytes, settings: Settings) -> None:
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


def export_portable_history(destination: Path, settings: Settings | None = None) -> dict:
    """Export a compact, streaming v2 .xpeng history."""
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    key_path = settings.private_root / KEY_FILENAME
    if not settings.database_path.is_file() or not key_path.is_file():
        raise PortableHistoryError("history_empty")

    copy_path = _database_copy(settings)
    try:
        _validate_database(copy_path)
        database_bytes = copy_path.stat().st_size
        if database_bytes > MAX_DATABASE_BYTES:
            raise PortableHistoryError("history_size")
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
            "compression": "xz-lzma2-preset-1",
            "databaseSha256": _file_sha256(copy_path),
            "databaseBytes": database_bytes,
            "vehicleKeyBase64": base64.b64encode(vehicle_key).decode("ascii"),
        }
        header = json.dumps(
            document, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
        if len(header) > MAX_HEADER_BYTES:
            raise PortableHistoryError("history_header")

        destination.parent.mkdir(parents=True, exist_ok=True)
        compressor = lzma.LZMACompressor(format=lzma.FORMAT_XZ, preset=1)
        try:
            with destination.open("wb") as output, copy_path.open("rb") as database:
                output.write(MAGIC)
                output.write(HEADER_LENGTH.pack(len(header)))
                output.write(header)
                while chunk := database.read(CHUNK_BYTES):
                    output.write(compressor.compress(chunk))
                output.write(compressor.flush())
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        if destination.stat().st_size > MAX_COMPRESSED_BYTES:
            destination.unlink(missing_ok=True)
            raise PortableHistoryError("history_size")
        return {
            "format": FORMAT,
            "version": FORMAT_VERSION,
            "exportedAtUtc": exported_at,
            "databaseBytes": database_bytes,
            "compressedBytes": destination.stat().st_size,
        }
    finally:
        copy_path.unlink(missing_ok=True)


def _import_v2(source: Path, settings: Settings) -> dict:
    candidate = _temporary_path(settings, ".db")
    try:
        with source.open("rb") as handle:
            if handle.read(len(MAGIC)) != MAGIC:
                raise PortableHistoryError("history_format")
            length_raw = handle.read(HEADER_LENGTH.size)
            if len(length_raw) != HEADER_LENGTH.size:
                raise PortableHistoryError("history_header")
            header_bytes = HEADER_LENGTH.unpack(length_raw)[0]
            if not 1 <= header_bytes <= MAX_HEADER_BYTES:
                raise PortableHistoryError("history_header")
            try:
                document = json.loads(handle.read(header_bytes))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise PortableHistoryError("history_header") from exc
            if not isinstance(document, dict) or document.get("format") != FORMAT:
                raise PortableHistoryError("history_format")
            if document.get("version") != FORMAT_VERSION or document.get("schemaVersion") != SCHEMA_VERSION:
                raise PortableHistoryError("history_version")
            if document.get("compression") != "xz-lzma2-preset-1":
                raise PortableHistoryError("history_version")
            try:
                expected_bytes = int(document["databaseBytes"])
                vehicle_key = base64.b64decode(document["vehicleKeyBase64"], validate=True)
            except (KeyError, TypeError, ValueError) as exc:
                raise PortableHistoryError("history_payload") from exc
            if not 1 <= expected_bytes <= MAX_DATABASE_BYTES or len(vehicle_key) != 32:
                raise PortableHistoryError("history_payload")

            decompressor = lzma.LZMADecompressor(format=lzma.FORMAT_XZ)
            digest = hashlib.sha256()
            written = 0
            try:
                with candidate.open("wb") as output:
                    while chunk := handle.read(CHUNK_BYTES):
                        raw = decompressor.decompress(chunk)
                        written += len(raw)
                        if written > expected_bytes or written > MAX_DATABASE_BYTES:
                            raise PortableHistoryError("history_size")
                        output.write(raw)
                        digest.update(raw)
            except lzma.LZMAError as exc:
                raise PortableHistoryError("history_compression") from exc
            if not decompressor.eof or written != expected_bytes:
                raise PortableHistoryError("history_payload")
            if digest.hexdigest() != document.get("databaseSha256"):
                raise PortableHistoryError("history_integrity")
        _install_database(candidate, vehicle_key, settings)
        return {
            "format": FORMAT,
            "version": FORMAT_VERSION,
            "exportedAtUtc": document.get("exportedAtUtc"),
            "timezone": document.get("timezone"),
            "databaseBytes": written,
        }
    finally:
        candidate.unlink(missing_ok=True)


def _import_legacy_v1(source: Path, settings: Settings) -> dict:
    compressed_bytes = source.stat().st_size
    try:
        with gzip.open(source, "rb") as handle:
            chunks = []
            total = 0
            while chunk := handle.read(CHUNK_BYTES):
                total += len(chunk)
                if total > MAX_JSON_BYTES or total > compressed_bytes * MAX_COMPRESSION_RATIO + CHUNK_BYTES:
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
    if document.get("version") != LEGACY_FORMAT_VERSION or document.get("schemaVersion") != SCHEMA_VERSION:
        raise PortableHistoryError("history_version")
    try:
        database = base64.b64decode(document["databaseBase64"], validate=True)
        vehicle_key = base64.b64decode(document["vehicleKeyBase64"], validate=True)
    except (KeyError, TypeError, ValueError) as exc:
        raise PortableHistoryError("history_payload") from exc
    if len(database) > MAX_DATABASE_BYTES or len(vehicle_key) != 32 or not database.startswith(b"SQLite format 3\x00"):
        raise PortableHistoryError("history_payload")
    if hashlib.sha256(database).hexdigest() != document.get("databaseSha256"):
        raise PortableHistoryError("history_integrity")
    candidate = _temporary_path(settings, ".db")
    candidate.write_bytes(database)
    try:
        _install_database(candidate, vehicle_key, settings)
    finally:
        candidate.unlink(missing_ok=True)
    return {
        "format": FORMAT,
        "version": LEGACY_FORMAT_VERSION,
        "exportedAtUtc": document.get("exportedAtUtc"),
        "timezone": document.get("timezone"),
        "databaseBytes": len(database),
    }


def import_portable_history(source: Path, settings: Settings | None = None) -> dict:
    settings = settings or Settings.from_env()
    settings.ensure_directories()
    if not source.is_file() or source.stat().st_size > MAX_COMPRESSED_BYTES:
        raise PortableHistoryError("history_size")
    with source.open("rb") as handle:
        signature = handle.read(len(MAGIC))
    if signature == MAGIC:
        return _import_v2(source, settings)
    return _import_legacy_v1(source, settings)
