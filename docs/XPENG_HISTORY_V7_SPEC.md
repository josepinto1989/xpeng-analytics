# XPENG Analytics portable history format v7

Version 7 is the long-history `.xpeng` container used by XPENG Analytics. It
keeps the application local-first while avoiding the need to decompress an
entire multi-year telemetry archive into browser memory.

## Container

The file begins with the seven-byte `XPENGA\0` prefix, byte `7`, a four-byte
big-endian manifest length, the UTF-8 JSON manifest, and the binary payload.
The manifest format is `xpeng-analytics-segmented-history`.

The payload contains two records for every calendar-month shard:

- a gzip-compressed compact dashboard summary;
- a version 6 columnar shard containing that month's telemetry and eligible
  GPS tracks.

Every record has an offset, compressed byte length, and SHA-256 digest. Summary
records also declare their uncompressed size. Readers must validate bounds and
digests before using a record.

The top-level manifest may also include `rawArchives`, a lightweight registry
of imported XPENG ZIPs. Entries contain the source SHA-256, original filename,
byte size, input-row count, observed start/end timestamps, import time, and
optional Google Drive retention state. The ZIP payload is never embedded in
`.xpeng`; retired entries remain as provenance after a redundant untouched ZIP
has been moved to Drive trash. Older v7 files without this field derive basic
registry entries from their existing import provenance.

## Runtime behaviour

Opening the file reads the manifest and compact summaries. It does not
decompress every telemetry column. The summaries provide overview totals,
daily and monthly trends, quality information, and lightweight journey and
charging indexes. Trip series, charging curves, replay events, and route points
are deliberately absent from this always-loaded layer.

When the user selects a record, the worker opens the matching month, validates
and decompresses that shard, rebuilds its analytics, and returns only the
requested journey or charging details. Other months remain compressed Blob
ranges. Adding an XPENG ZIP rebuilds only the calendar months covered by the
new export; duplicate timestamps continue to use the newest imported value.

Recent unmatched GPX tracks remain inside their monthly shard for the existing
five-day delayed-telemetry window. A later XPENG import reopens that month and
performs matching automatically.

## Compatibility

Readers accept versions 3, 4, 5, and 6. Those formats are validated and migrated
locally into v7 monthly shards. This first migration temporarily requires the
memory used by the older monolithic history. Subsequent v7 openings are lazy.
Version 1 JSON/GZ and version 2 SQLite/XZ remain handled by the established
compatibility processor before entering the native v7 path.

## Privacy and security

Version 7 is compressed but not encrypted. It may contain complete vehicle
telemetry, precise GPS coordinates, personal chart definitions, and manual
journey groups. Treat it as sensitive personal data. The normal local and
Google Drive workflows transport the container as a Blob; they do not upload
individual shards to the XPENG Analytics host.
