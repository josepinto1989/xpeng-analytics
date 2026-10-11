from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from typing import Iterable


def _flatten_columns(payload: object) -> set[str]:
    if isinstance(payload, list):
        return {str(value) for value in payload}
    if isinstance(payload, dict):
        flattened: set[str] = set()
        for section, values in payload.items():
            if isinstance(values, list):
                flattened.update(f"{section}.{value}" for value in values)
        return flattened
    return set()


def _schema_hash(columns: Iterable[str]) -> tuple[str, str]:
    serialized = json.dumps(sorted(set(columns)), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest(), serialized


def record_import_schemas(
    connection: sqlite3.Connection,
    import_id: int,
    source: str,
    versions: dict[str, str] | None = None,
) -> None:
    """Persist canonical XPENG schemas and report drift from the previous import."""
    if source != "xpeng":
        raise ValueError("Only XPENG Data Act imports are supported")
    versions = versions or {}
    manifests = connection.execute(
        "SELECT family,columns_json FROM import_files WHERE import_id=? ORDER BY family,member_name",
        (import_id,),
    ).fetchall()
    families: dict[str, set[str]] = {}
    for manifest in manifests:
        try:
            payload = json.loads(manifest["columns_json"])
        except (TypeError, json.JSONDecodeError):
            payload = []
        families.setdefault(manifest["family"], set()).update(_flatten_columns(payload))

    for family, columns in families.items():
        schema_hash, serialized = _schema_hash(columns)
        previous = connection.execute(
            "SELECT columns_json FROM import_schema_snapshots "
            "WHERE source='xpeng' AND family=? AND import_id<? ORDER BY import_id DESC LIMIT 1",
            (family, import_id),
        ).fetchone()
        connection.execute(
            "INSERT OR REPLACE INTO import_schema_snapshots("
            "import_id,source,family,source_version,schema_hash,columns_json,observed_at_utc) "
            "VALUES(?,'xpeng',?,?,?,?,?)",
            (import_id, family, versions.get(family, "data-act/unknown"), schema_hash, serialized, int(time.time())),
        )
        if not previous:
            continue
        old_columns = set(json.loads(previous["columns_json"]))
        for rule, changed, severity, label in (
            ("schema_columns_added", sorted(columns - old_columns), "medium", "New columns"),
            ("schema_columns_removed", sorted(old_columns - columns), "high", "Removed columns"),
        ):
            if changed:
                connection.execute(
                    "INSERT INTO quality_events(import_id,family,field,rule_code,severity,affected_rows,total_rows,detail) "
                    "VALUES(?,?,?,?,?,?,?,?)",
                    (import_id, family, None, rule, severity, len(changed), len(columns),
                     f"{label} relative to the previous XPENG import: {', '.join(changed)}"),
                )
