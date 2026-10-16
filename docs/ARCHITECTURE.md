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

Only the signals needed for public analytics are retained. VINs are not part
of the in-memory state or presentation snapshot. Optional GPX imports add a
separate typed route store containing timestamps and coordinates after the
user explicitly selects those files. Exact SHA-256 source hashes make repeat
ZIP and GPX imports idempotent.

The worker returns a versioned `xpeng-analytics-dashboard/v2` snapshot to React.
Date filters, record selection, unit conversion, synchronized chart cursors,
long-term trends, driving-context estimates, local GPS route traces, and PDF
generation operate on this snapshot and require no application server. Opening
a journey with a matched GPX route requests the visible OpenStreetMap tiles;
the route-to-chart synchronisation remains local.
The interface exposes
overview, journeys, driving, charging, battery, tyres, activity, trends,
report, quality, and data-management views.

Driving context is derived in short telemetry blocks during the same pass that
builds trips. The classifier considers sustained speed bands, stops,
longitudinal dynamics, and braking, then emits urban-, road-, or
motorway-style estimates with a confidence score. The current classifier does
not use GPS or claim to identify the actual road.

GPX files are parsed in the same worker. Each recording is sliced against the
exact XPENG trip timestamps before matching, so an all-day recording can cover
several car trips while parked periods and unrelated movement are excluded.
Candidates are compared using temporal coverage, start/end proximity,
distance, speed agreement, and recording quality. When Android and iPhone
recordings cover the same trip, one route is chosen deterministically and the
overlapping alternatives are omitted from the portable history. XPENG
telemetry remains the source for all vehicle metrics.

The previous Python/WebAssembly and SQLite processor remains available as a
compatibility reader for version 1 and 2 histories. It is not loaded for a new
XPENG ZIP or a native version 3 or 4 history.

## Memory and browser boundary

CSV contents are decompressed and parsed as streams; they are not expanded into
one large string. The selected `File` is passed directly to the worker, which
reads the ZIP directory and compressed entries through bounded Blob slices.
Only required CSV fields are materialised. Signals are assembled in fixed-size
`Uint32Array` and `Float32Array` chunks before being compacted into the final
columns.

Mobile and desktop use the same analytical model and retain the same data.
Their processing profiles differ only in allocation strategy: mobile uses
smaller chunks to reduce peak memory, while desktop uses larger chunks for
throughput. The importer no longer rejects a file from a projection based on
the complete expanded CSV size because most source columns are never retained.

The selected archive, parsed columns, and dashboard stay inside the tab. No
browser persistence is enabled by default, and no request containing vehicle
data is sent to the static host. Without explicit consent, closing or
refreshing the tab clears the session.

When the user enables persistent local history, the worker exports the same
versioned `.xpeng` payload after the import queue completes and React stores
one Blob in IndexedDB. On a later visit, that Blob is passed back to the worker
through the normal history-validation path before the dashboard opens. ZIP
imports update the saved history only after consolidation succeeds. Consent
and the optional reminder preference use small local preference flags; vehicle
telemetry is not written to `localStorage`.

## Portable history

New exports use `xpeng-analytics-columnar-history` version 4 with the `.xpeng`
extension. The file contains a small JSON manifest followed by individually
gzip-compressed timeline and signal columns. Each block has its own SHA-256
checksum, original size, and byte range. Restoring a history reads each block
directly from its Blob range and validates the
format, version, bounds, checksum, decompressed size, and required streams
before rebuilding all derived analytics. Version 4 adds individually
compressed GPS time, latitude, longitude, elevation, speed, and segment blocks,
plus GPX import provenance, the matched trip identifier, and discarded-source
provenance. Only matched trip slices are written; these blocks are omitted when
no GPS data was matched.

Per-column compression avoids Base64 and SQLite overhead and lets the file stay
close to the size of the original XPENG ZIP. Histories remain unencrypted and
must be treated as sensitive personal files. Version 1 JSON.GZ and version 2
SQLite/XZ histories remain importable through the compatibility processor; new
exports always use version 4. The native reader accepts version 3 and 4.

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
- raw vehicle identifiers or real vehicle fixtures;
- browser persistence without explicit consent or a visible delete action.

Optional GPX routes are an explicit exception to the general exclusion of
third-party data. They remain local, are stored unencrypted in `.xpeng`, and
are never committed as test fixtures. Standard OpenStreetMap tiles are not
prefetched, bulk-downloaded, or packaged for offline use.
