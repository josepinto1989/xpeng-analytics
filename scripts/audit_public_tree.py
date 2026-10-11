from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()
IGNORED_PARTS = {".git", ".pnpm-cache", "__pycache__", "dist", "node_modules", "processor", "tmp"}
TEXT_SUFFIXES = {
    ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".py",
    ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
}
FORBIDDEN_SUFFIXES = {
    ".db", ".gz", ".key", ".pem", ".sqlite", ".sqlite3", ".xpeng", ".zip",
}

# Split private-project words so this scanner does not trigger on itself.
FORBIDDEN_TEXT = {
    "third-party telemetry code": re.compile("ev" + "dash", re.IGNORECASE),
    "private hosting code": re.compile("cloud" + "flare|workers\\.dev", re.IGNORECASE),
    "private object storage": re.compile(r"\b" + "r2" + r"\b", re.IGNORECASE),
    "email address": re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "private key": re.compile("BEGIN " + "(?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    "plausible VIN": re.compile(r"\b[A-HJ-NPR-Z0-9]{17}\b"),
}


def audited_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and not IGNORED_PARTS.intersection(path.parts)
    )


def main() -> int:
    findings: list[str] = []
    for path in audited_files():
        relative = path.relative_to(ROOT)
        if path.suffix.lower() in FORBIDDEN_SUFFIXES:
            findings.append(f"forbidden file type: {relative}")
        if path == SELF or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            findings.append(f"unexpected non-UTF-8 file: {relative}")
            continue
        for label, pattern in FORBIDDEN_TEXT.items():
            match = pattern.search(content)
            if match:
                line = content.count("\n", 0, match.start()) + 1
                findings.append(f"{label}: {relative}:{line}")

    if findings:
        print("Public-tree audit failed:")
        for finding in findings:
            print(f"- {finding}")
        return 1
    print(f"Public-tree audit passed ({len(audited_files())} files checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

