from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from pathlib import Path


KEY_FILENAME = "vehicle_hmac.key"


def load_or_create_vehicle_key(private_root: Path) -> bytes:
    """Return the local HMAC key used to pseudonymise VINs.

    The key is deliberately kept outside source control. It must be included in
    encrypted backups; without it, future imports will get a different vehicle ID.
    """

    private_root.mkdir(parents=True, exist_ok=True)
    key_path = private_root / KEY_FILENAME
    if key_path.exists():
        key = key_path.read_bytes()
        # Older Windows runs may have created the binary key through a text-mode
        # descriptor, expanding LF to CRLF. Recover that exact key once.
        if len(key) != 32 and os.name == "nt":
            recovered = key.replace(b"\r\n", b"\n")
            if len(recovered) == 32:
                key = recovered
                key_path.write_bytes(key)
        if len(key) != 32:
            raise ValueError(f"Invalid vehicle key length in {key_path}")
        return key

    key = secrets.token_bytes(32)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    descriptor = os.open(key_path, flags, 0o600)
    try:
        os.write(descriptor, key)
    finally:
        os.close(descriptor)
    return key


def vehicle_id_for_vin(vin: str, key: bytes) -> str:
    if not vin:
        raise ValueError("A VIN is required to identify the vehicle")
    digest = hmac.new(key, vin.strip().upper().encode("utf-8"), hashlib.sha256)
    return f"veh_{digest.hexdigest()[:24]}"


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()

