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
The interface exposes overview, journeys, driving, charging, battery, tyres,
activity, trends, report, personal charts, replay, quality, and data-management
views.

Driving context is derived in short telemetry blocks during the same pass that
builds trips. The classifier considers sustained speed bands, stops,
longitudinal dynamics, and braking, then emits urban-, road-, or
motorway-style estimates with a confidence score. The current classifier does
not use GPS or claim to identify the actual road.

Visual replay keeps continuous telemetry in a bounded series and preserves
brake, gear, door, window, and boot changes as exact timestamped events. Each
trip includes one minute of context before and after movement so entry, exit,
and boot activity is not lost at the driving boundary. Discrete values follow
the XPENG signal dictionary: gears `1`–`4` are D/N/R/P, door-ajar `1` is open,
window values describe movement rather than opening percentage, and boot state
`1` is fully closed while states `2`–`10` describe opening, open, closing, or
intermediate positions. State `0` is treated as unknown.

The replay UI uses a lightweight chase-camera composition rather than a 3D
runtime. A transparent generic SUV asset is layered over a centred, animated
road, while the exact door, window, and boot states remain visible in the HUD.
This avoids additional GPU memory pressure on mobile browsers and keeps the
telemetry panel responsive while playback is running.

## Runtime performance

The landing page and each optional analytics workspace are split into separate
JavaScript chunks. Dashboard charts, My Charts, replay, Leaflet, and their CSS
are loaded only when the user reaches the relevant screen. Import progress
messages are throttled in the worker so large archives do not force React to
paint hundreds of near-identical updates.

Trip telemetry is sampled once into a bounded replay series. The normal trip
series references the same point objects instead of building a second copy,
which reduces retained heap without changing the calculated metrics. During
replay, chart paths remain static and only their lightweight playhead and live
values update. The map marker is moved in place and map panning is separately
throttled. This keeps playback responsive without continuously rebuilding SVG
charts or Leaflet layers.

GPX files are parsed in the same worker. Each recording is sliced against the
exact XPENG trip timestamps before matching, so an all-day recording can cover
several car trips while parked periods and unrelated movement are excluded.
Candidates are compared using temporal coverage, start/end proximity,
distance, speed agreement, and recording quality. When Android and iPhone
recordings cover the same trip, one route is chosen deterministically and the
overlapping alternatives are omitted from the displayed journey. The history
writer also retains a complete source recording while it ends within five days
of the latest imported vehicle telemetry, or is newer than that telemetry. This
allows an all-day or same-day GPX to be matched again after delayed XPENG data
is added. Once telemetry is more than five days beyond an unmatched recording,
its coordinates are omitted from the next export. XPENG telemetry remains the
source for all vehicle metrics.

The previous Python/WebAssembly and SQLite processor remains available as a
compatibility reader for version 1 and 2 histories. It is not loaded for a new
XPENG ZIP or a native version 3, 4, or 5 history.

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

Google Drive backup is an optional boundary layered on the same export path.
After an explicit Google authorisation, React asks the worker for the current
version 7 `.xpeng` Blob and uploads it directly to the Drive API using a
resumable session. The static app requests only `drive.file`, creates one
visible folder, one current backup, and up to three app-created recovery
copies. Before replacing the current file, Drive copies the previous version;
older recoveries are pruned after a successful upload. File app-properties
store only role, coverage, history version, and import count. The OAuth access
token and connected account identity remain in memory. Restore downloads the
selected Blob and passes it through the normal validated history importer. No
Google password, refresh token, account identity, or vehicle payload passes
through an XPENG Analytics server.

Original-source archiving is a separate opt-in path. After the native worker has
successfully recognised and imported an XPENG ZIP, React retains that selected
`File` only until the import batch completes. If the option is enabled and the
Drive session is still authorised, the original `File` is streamed unchanged
to a **Raw Files** subfolder before the normal processed-history backup runs.
The archive uses the SHA-256 digest already produced by the native importer to
skip duplicates. A coverage-based selector keeps a small set of untouched ZIPs
spanning the complete observed period, preferring one day of overlap. Files
that become redundant are moved to Drive trash. They are never consolidated or
rewritten. The `.xpeng` manifest stores lightweight provenance and retention
records for every imported ZIP, including files no longer retained in Drive.

GPX source preservation follows the same post-import queue but has its own
consent preference, Drive marker, list, and **Original GPX files** subfolder.
Only files successfully parsed as GPX sources are eligible. Their importer hash
prevents repeated uploads, while keeping this preference separate ensures that
permission to archive vehicle ZIPs is never treated as permission to archive
complete location recordings.

## Portable history

New exports use `xpeng-analytics-segmented-history` version 7 with the `.xpeng`
extension. Its top-level manifest indexes independent calendar-month shards.
Every shard contains the established compressed columnar history and a
compressed compact dashboard summary. Opening v7 validates and loads those
summaries while retaining monthly telemetry as Blob ranges. Detailed telemetry
is decompressed only when a journey, charge, replay, or mapped route from that
month is opened. Adding a ZIP rebuilds only its overlapping months.

Versions 3–6 use `xpeng-analytics-columnar-history`: a small JSON manifest
followed by individually gzip-compressed timeline and signal columns. Each
block has its own SHA-256 checksum, original size, and byte range. Restoring an
older history validates the format, version, bounds, checksum, decompressed
size, and required streams before migrating it locally to monthly v7 shards.
Version 4 adds individually
compressed GPS time, latitude, longitude, elevation, speed, and segment blocks,
plus GPX import provenance, the matched trip identifier, and discarded-source
provenance. Version 5 continues to use those blocks for matched trip slices and
also permits recent complete source recordings with no `matchedTripId` while
they wait for delayed XPENG telemetry. The five-day retention rule is based on
the newest imported telemetry timestamp, not the computer clock. Version 5
also adds an allow-listed `customCharts` manifest array containing only compact
display definitions. Chart data and rendered images are never duplicated in
the history.

Version 6 adds validated manual journey-group definitions. These keep only a
display name and stable references to existing journeys and trips. Combined
metrics, charging stops, maps, and charts are derived again whenever the
dashboard is rebuilt, so grouping never rewrites the original telemetry.

Per-column compression avoids Base64 and SQLite overhead and lets the file stay
close to the size of the original XPENG ZIP. Histories remain unencrypted and
must be treated as sensitive personal files. Version 1 JSON.GZ and version 2
SQLite/XZ histories remain importable through the compatibility processor; new
exports always use version 7. The native reader accepts versions 3, 4, 5, 6,
and 7.

## Attribution

The streaming, columnar import direction was inspired by
[LogbooX](https://github.com/schliflo/logboox) by Florian Schlittenbauer. The
public acknowledgement and MIT licence notice are preserved in
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## Deliberate exclusions

- application servers and server-side processing;
- mandatory hosted databases or project-controlled object storage;
- XPENG Analytics accounts or automatic vehicle acquisition;
- third-party telemetry sources;
- raw vehicle identifiers or real vehicle fixtures;
- browser persistence without explicit consent or a visible delete action.

Optional GPX routes are an explicit exception to the general exclusion of
third-party data. They remain local, are stored unencrypted in `.xpeng`, and
are never committed as test fixtures. Standard OpenStreetMap tiles are not
prefetched, bulk-downloaded, or packaged for offline use.

Optional Google Drive backup is the other explicit exception: after user
consent, the `.xpeng` payload is stored in the user's own Drive account. It is
not required for analysis and does not change the local processing model.
