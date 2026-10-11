# XPENG Analytics

An open-source, local-first viewer for XPENG Data Act exports.

The application runs entirely in the user's browser. Vehicle
exports will be processed locally and will not be uploaded to this project or
to an application server. Closing the browser session will discard the active
state unless the user explicitly exports a portable history file.

> This is an independent community project. It is not affiliated with,
> endorsed by, or sponsored by XPeng Inc. XPENG is a trademark of its
> respective owner.

## Current status

Phases 1 through 6 are complete and version 1.1.1 contains the latest Phase 7
improvement cycle after the v1.0.0 public release.
This repository is an isolated, sanitised application with an XPENG-only
analytics core and a browser processor that keeps
its SQLite state in a Web Worker's temporary filesystem. The responsive
analytics dashboard is available in European Portuguese and English and covers
overview metrics, journeys, charging, battery observations, activity, data
quality, and session data management. A compact versioned `.xpeng` history can
be exported and restored locally, preserving deduplication for later XPENG ZIP
imports. Version 1 JSON.GZ histories remain importable. Automated checks and
GitHub Pages deployment are configured for the public repository. Phase 7
covers user acceptance testing and ongoing operational improvements; see
[docs/ROADMAP.md](docs/ROADMAP.md).

The dashboard is usable with XPENG ZIP exports and portable histories.

The application is available at
[josepinto1989.github.io/xpeng-analytics](https://josepinto1989.github.io/xpeng-analytics/).
Problems can be reported through
[GitHub Issues](https://github.com/josepinto1989/xpeng-analytics/issues) without
attaching real vehicle data.

## Privacy properties

- No real vehicle export, database, identifier, location, credential, or key is
  included in the repository.
- Vehicle identifiers are pseudonymised with a random local HMAC key.
- Tests create synthetic archives in a temporary directory.
- Common vehicle-data and secret file types are ignored by Git.
- CI scans the public tree before running tests.

See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development checks

```shell
python scripts/audit_public_tree.py
python -m unittest discover -s tests -v
cd web
pnpm install
pnpm test
pnpm build
```

The Python core has no runtime dependencies outside the standard library.

The generated `web/public/processor/` directory contains the browser Python
runtime and is intentionally ignored; `pnpm build` recreates it from audited
source files.

## Licence

MIT. See [LICENSE](LICENSE).

