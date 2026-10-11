# Public architecture

## Scope of this foundation

The repository currently contains a Python analytics core with four layers:

1. validate a user-selected XPENG Data Act archive;
2. normalise operation, energy, and status samples by vehicle and second;
3. derive trips, journeys, stops, charging sessions, and daily metrics;
4. validate database integrity and source-schema changes.

The presentation layer converts those tables into a versioned
`xpeng-analytics-dashboard/v1` snapshot. It includes only aggregates, derived trip,
journey, charge, battery, activity, and quality data needed by the interface.
Raw vehicle identifiers and route coordinates are not part of this contract.

Exact archive hashes make repeated imports idempotent. Overlapping exports are
merged on `(vehicle_id, timer)`, and a later changed row replaces the earlier
normalised value while retaining import provenance.

## Browser boundary

The static site starts a dedicated Web Worker, loads Python through WebAssembly,
and creates SQLite state in the worker's temporary filesystem. The main UI
receives only progress events and a presentation snapshot. It does not send the
selected file to the static host. Multiple archives are processed serially by
the same worker, so deduplication and overlap correction share one session.

The React interface exposes seven local views: overview, journeys, charging,
battery, activity, quality, and data management. Shared preset or custom date
filters and detail
selection operate on the in-memory presentation snapshot and therefore require
no additional processing or network request.

No browser persistence will be enabled by default. A portable history will be
created only after an explicit export action.

## Portable history

`xpeng-analytics-history` version 2 uses the `.xpeng` extension. It contains a
small JSON header followed by a directly XZ/LZMA2-compressed sanitised SQLite
image. Export and import stream the database in chunks, avoiding the Base64 and
full-document memory overhead of version 1. The header stores the SHA-256
checksum, schema version, uncompressed size, and local pseudonymisation key.
Keeping that key allows a future XPENG ZIP for the same vehicle to resolve to
the same internal identifier. The format contains no raw VIN, but it remains
sensitive personal data and is not encrypted. Existing version 1 JSON.GZ
histories remain importable; new exports always use version 2.

Import validates format and expansion limits, compression completion,
format/schema versions, declared size, checksum, SQLite integrity, required
tables, and the XPENG-only source constraint before replacing the temporary
session. Derived analytics are rebuilt after restore.

All user-facing browser messages are represented by stable codes and translated
in the UI. European Portuguese (`pt-PT`) and English (`en`) are required and CI
rejects missing or mismatched translation keys.

## Deliberate exclusions

- application servers and server-side processing;
- hosted databases and object storage;
- account authentication;
- automatic vehicle acquisition;
- third-party telemetry sources;
- real vehicle fixtures or bundled dashboard snapshots.

