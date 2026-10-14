# Public architecture

## Processing model

XPENG Analytics is a static site. Its normal import path runs in a dedicated
JavaScript Web Worker and has four stages:

1. inspect the user-selected ZIP and locate operation, energy, and status CSVs;
2. stream each CSV into typed, columnar arrays while validating sentinel values;
3. sort, deduplicate, and merge overlapping exports by timestamp, with the new
   import winning on overlap;
4. derive trips, journeys, charging sessions, battery, driving, activity, and
   data-quality metrics.

Only the signals needed for public analytics are retained. VINs and route
coordinates are not part of the in-memory state or presentation snapshot. An
exact SHA-256 archive hash makes repeat imports idempotent.

The worker returns a versioned `xpeng-analytics-dashboard/v2` snapshot to React.
Date filters, record selection, unit conversion, synchronized chart cursors,
and PDF generation operate on this snapshot and require no server or network
request. The interface exposes overview, journeys, driving, charging, battery,
tyres, activity, report, quality, and data-management views.

The previous Python/WebAssembly and SQLite processor remains available as a
compatibility reader for version 1 and 2 histories. It is not loaded for a new
XPENG ZIP or a version 3 history.

## Memory and browser boundary

CSV contents are decompressed and parsed as streams; they are not expanded into
one large string. Signals are stored as `Uint32Array` timelines and
`Float32Array` columns. Before parsing, the worker compares a conservative
memory projection with the browser's reported device memory and rejects files
that are unlikely to fit safely.

The selected archive, parsed columns, and dashboard stay inside the tab. No
browser persistence is enabled by default, and no request containing vehicle
data is sent to the static host. Closing or refreshing the tab clears the
session.

## Portable history

New exports use `xpeng-analytics-columnar-history` version 3 with the `.xpeng`
extension. The file contains a small JSON manifest followed by individually
gzip-compressed timeline and signal columns. Each block has its own SHA-256
checksum, original size, and byte range. Restoring a history validates the
format, version, bounds, checksum, decompressed size, and required streams
before rebuilding all derived analytics.

Per-column compression avoids Base64 and SQLite overhead and lets the file stay
close to the size of the original XPENG ZIP. Histories remain unencrypted and
must be treated as sensitive personal files. Version 1 JSON.GZ and version 2
SQLite/XZ histories remain importable through the compatibility processor; new
exports always use version 3.

## Attribution

The streaming, columnar import direction was inspired by
[LogbooX](https://github.com/schliflo/logboox) by Florian Schlittenbauer. The
public acknowledgement and MIT licence notice are preserved in
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## Deliberate exclusions

- application servers and server-side processing;
- hosted databases and object storage;
- account authentication or automatic vehicle acquisition;
- third-party telemetry sources;
- raw vehicle identifiers, route coordinates, or real vehicle fixtures;
- automatic browser persistence.
