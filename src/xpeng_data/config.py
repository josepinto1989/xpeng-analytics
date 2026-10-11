from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _resolve(value: str | None, default: Path) -> Path:
    path = Path(value).expanduser() if value else default
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


@dataclass(frozen=True)
class Settings:
    project_root: Path
    data_root: Path
    database_path: Path
    raw_root: Path
    private_root: Path
    timezone: str

    @classmethod
    def from_env(cls) -> "Settings":
        data_root = _resolve(os.getenv("XPENG_DATA_ROOT"), PROJECT_ROOT / "var")
        database_path = _resolve(os.getenv("XPENG_DB_PATH"), data_root / "xpeng.db")
        return cls(
            project_root=PROJECT_ROOT,
            data_root=data_root,
            database_path=database_path,
            raw_root=data_root / "raw",
            private_root=data_root / "private",
            timezone=os.getenv("XPENG_TIMEZONE", "Europe/Lisbon"),
        )

    def ensure_directories(self) -> None:
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.raw_root.mkdir(parents=True, exist_ok=True)
        self.private_root.mkdir(parents=True, exist_ok=True)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)

