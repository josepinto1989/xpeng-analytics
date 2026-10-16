# XPENG Analytics portable history format v4

## 1. Purpose and compatibility

Version 4 extends the [version 3 columnar format](XPENG_HISTORY_V3_SPEC.md)
with optional GPS tracks, import provenance, and journey-assignment metadata.
The telemetry stream layout, block descriptors, GZIP compression, SHA-256
checksums, and validation rules remain unchanged.

The file is compressed but not encrypted. When GPS is present, it contains
precise location history and must be treated as sensitive personal data.

The native reader accepts versions 3 and 4. New exports use version 4. Legacy
version 1 JSON.GZ and version 2 SQLite/XZ histories are handled by the separate
compatibility reader.

## 2. Binary header

The eight-byte magic for version 4 is:

```text
58 50 45 4e 47 41 00 04
 X  P  E  N  G  A \0 v4
```

The remaining binary layout is identical to version 3: a four-byte big-endian
manifest length, the UTF-8 JSON manifest, and concatenated GZIP blocks whose
offsets are relative to the beginning of the payload.

## 3. GPS manifest extension

Version 4 adds an optional `gps` object at the manifest root:

```json
{
  "format": "xpeng-analytics-columnar-history",
  "version": 4,
  "streams": {},
  "gps": {
    "imports": [
      {
        "name": "tracks.zip",
        "sha256": "hex-encoded-sha256",
        "trackCount": 6,
        "pointCount": 6867,
        "completedAtUtc": "2026-10-16T12:00:00.000Z"
      }
    ],
    "assignments": {
      "journey_...": "gps_..."
    },
    "tracks": []
  }
}
```

`imports` supports source-level deduplication. `assignments` stores only manual
journey corrections; automatic matches are recalculated after import so
improved matching logic can apply to existing histories.

## 4. GPS track records

Each `gps.tracks` item contains:

| Field | Type | Meaning |
| --- | --- | --- |
| `trackId` | string | Stable identifier derived from the source hash and track index |
| `sourceName` | string | Original GPX filename or path inside the selected ZIP |
| `creator` | string | GPX creator attribute when present |
| `importedAtUtc` | ISO-8601 string | Local import time |
| `originalStartUtc` | ISO-8601 string | Start before optional trimming |
| `originalEndUtc` | ISO-8601 string | End before optional trimming |
| `trimMeters` | number | Metres removed from both route ends |
| `stats` | object | Point count, distance, duration, gaps, coverage, and quality |
| `time` | block descriptor | `Uint32Array` Unix timestamps in seconds |
| `lat` | block descriptor | `Float64Array` WGS84 latitude |
| `lon` | block descriptor | `Float64Array` WGS84 longitude |
| `elevation` | block descriptor | `Float32Array` metres; `NaN` when absent |
| `speedMps` | block descriptor | `Float32Array` metres per second; `NaN` when absent |
| `segment` | block descriptor | `Uint16Array` source track-segment index |

All six arrays must have the same length and contain at least two points.
Timestamps must be strictly increasing. Latitude and longitude must be finite
and inside their valid ranges. Every compressed block is subject to the same
bounds, checksum, decompressed-size, and typed-array alignment validation used
for telemetry columns.

## 5. Privacy and networking

Writing and restoring version 4 requires no network request. Route matching,
trimming, previews, chart synchronisation, and PDF trace composition are local.
The OpenStreetMap background is not stored in the history. Opening a journey
with a matched route causes the browser to request only the tiles needed for
the viewed area.

Applications implementing this format must not imply that compression is
encryption and should warn users before they share a history containing GPS.

