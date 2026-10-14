# XPENG Analytics portable history format v3

## 1. Purpose

The `.xpeng` version 3 format is a portable, local-first container for XPENG
telemetry that has already been parsed and normalised.

Its goals are:

- avoid parsing millions of CSV rows every time the application opens;
- remain substantially smaller than the previous SQLite-based history;
- preserve enough source data to recalculate all analytics later;
- support merging new and overlapping XPENG exports;
- validate every compressed block before accepting a history;
- avoid storing the VIN or derived dashboard results.

The file is not encrypted. It must be treated as sensitive personal telemetry,
just like the original XPENG Data Act export.

## 2. High-level design

The history contains three normalised telemetry streams:

- `operation` — vehicle movement and driver inputs;
- `energy` — battery, power, charging, temperature, and indicated range;
- `status` — doors, windows, boot, and tyre pressures.

Each stream consists of:

- one sorted timestamp array;
- multiple numeric signal arrays aligned by array index;
- source-quality metadata.

Derived values such as trips, journeys, charging sessions, battery estimates,
charts, and PDF-report totals are deliberately not persisted. They are rebuilt
after import so calculation improvements can also apply to older histories.

## 3. Binary layout

```text
+-------------------------------+
| 8-byte magic                  |
+-------------------------------+
| 4-byte manifest length        |
+-------------------------------+
| UTF-8 JSON manifest           |
+-------------------------------+
| GZIP block 0                  |
+-------------------------------+
| GZIP block 1                  |
+-------------------------------+
| ...                           |
+-------------------------------+
```

### 3.1 Magic

The first eight bytes are:

```text
58 50 45 4e 47 41 00 03
 X  P  E  N  G  A \0 v3
```

Equivalent JavaScript definition:

```js
const HISTORY_MAGIC = new Uint8Array([88, 80, 69, 78, 71, 65, 0, 3]);
```

### 3.2 Manifest length

The next four bytes contain the byte length of the UTF-8 JSON manifest as an
unsigned 32-bit integer in big-endian order.

```js
new DataView(lengthBytes.buffer).setUint32(0, manifestBytes.length, false);
```

The current implementation rejects manifests larger than 2,000,000 bytes.

### 3.3 Data payload

The data payload starts immediately after the manifest:

```text
payloadStart = 8 + 4 + manifestLength
```

All block offsets in the manifest are relative to `payloadStart`, not to the
start of the file.

Each timeline and each signal column is stored in its own GZIP block. Blocks
are concatenated without padding.

## 4. Manifest

Example:

```json
{
  "format": "xpeng-analytics-columnar-history",
  "version": 3,
  "exportedAtUtc": "2026-10-13T07:45:00.000Z",
  "model": "G6",
  "imports": [
    {
      "name": "DA-export.zip",
      "sha256": "hex-encoded-sha256",
      "rows": 3426417,
      "completedAtUtc": "2026-10-13T07:40:00.000Z",
      "sourceStartUtc": "2026-09-08T00:00:00.000Z",
      "sourceEndUtc": "2026-10-09T23:59:59.000Z"
    }
  ],
  "streams": {
    "operation": {
      "model": "G6",
      "stats": {},
      "time": {
        "name": "operation/time",
        "offset": 0,
        "bytes": 123456,
        "rawBytes": 4000000,
        "sha256": "hex-encoded-sha256"
      },
      "columns": {
        "speed_kmh": {
          "name": "operation/speed_kmh",
          "offset": 123456,
          "bytes": 65432,
          "rawBytes": 4000000,
          "sha256": "hex-encoded-sha256"
        }
      }
    },
    "energy": {},
    "status": {}
  }
}
```

### 4.1 Required root fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `format` | string | yes | Must be `xpeng-analytics-columnar-history` |
| `version` | integer | yes | Must be `3` |
| `exportedAtUtc` | ISO-8601 string | yes | Time at which the history was created |
| `model` | string | no | XPENG model if available |
| `imports` | array | yes | Import provenance and archive hashes |
| `streams` | object | yes | Must contain `operation`, `energy`, and `status` |

### 4.2 Block descriptor

Every `time` or column entry uses this structure:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | Diagnostic name of the block |
| `offset` | non-negative integer | Position relative to `payloadStart` |
| `bytes` | non-negative integer | Compressed GZIP size |
| `rawBytes` | non-negative integer | Expected uncompressed size |
| `sha256` | lowercase hexadecimal string | SHA-256 of the compressed bytes |

The checksum is calculated over the compressed GZIP block, not the raw typed
array.

### 4.3 Stream quality statistics

The current implementation preserves these optional fields under `stats`:

| Field | Meaning |
| --- | --- |
| `inputRows` | CSV rows inspected before deduplication |
| `uniqueRows` | Timestamps retained in the stream |
| `duplicates` | Duplicate timestamps removed |
| `invalidTimers` | Rows rejected because the timestamp was invalid |
| `invalidFields` | Object mapping source fields to rejected-value counts |
| `unknownColumns` | Source columns not recognised by this version |
| `emptyColumns` | Known columns with no valid observations |
| `wasUnsorted` | Whether source rows had to be reordered |
| `uncompressedBytes` | Number of source CSV bytes parsed |
| `mergedRows` | Resulting rows after combining exports, when applicable |

These values support data-quality reporting but must not be trusted as a
substitute for structural validation of the typed arrays.

## 5. Numeric encoding

### 5.1 Timeline

Timelines are raw `Uint32Array` bytes:

- each value is a Unix timestamp in seconds;
- timestamps must be sorted in ascending order;
- timestamps must be unique inside each stream;
- every timestamp fits in an unsigned 32-bit integer.

### 5.2 Signal columns

Signal columns are raw `Float32Array` bytes:

- column length must equal the stream timeline length;
- the value at index `i` belongs to the timestamp at index `i`;
- missing numeric values are represented by IEEE-754 `NaN`;
- infinities are not valid telemetry values.

The JavaScript implementation writes typed-array memory directly. Supported
Chrome, Edge, and Firefox environments use little-endian representation. A
Python implementation interoperating with the current format must therefore
use little-endian `uint32` and `float32`, for example NumPy dtypes `<u4` and
`<f4`, or `struct` formats `<I` and `<f`.

## 6. Current columns

### 6.1 Operation

```text
speed_kmh
longitudinal_accel
lateral_accel
odometer_km
steering_angle_deg
steering_speed_deg_s
accelerator_pct
brake_status
gear_level
```

### 6.2 Energy

```text
front_motor_rpm
rear_motor_rpm
front_motor_torque_nm
rear_motor_torque_nm
front_rotor_temp_c
rear_rotor_temp_c
pack_voltage_v
pack_current_a
charge_power_kw
soc_pct
battery_temp_max_c
battery_temp_min_c
hottest_cell_index
coldest_cell_index
displayed_range_km
```

### 6.3 Status

```text
driver_door_ajar
passenger_door_ajar
rear_left_door_ajar
rear_right_door_ajar
front_left_window_position
rear_left_window_position
front_right_window_position
rear_right_window_position
trunk_open_status
tyre_pressure_fl_kpa
tyre_pressure_fr_kpa
tyre_pressure_rl_kpa
tyre_pressure_rr_kpa
```

A reader should use the column names from the manifest rather than relying on
column order. A private version may add columns while preserving the same block
descriptor format.

## 7. Export algorithm

For every stream:

1. Obtain the raw bytes of its `Uint32Array` timeline.
2. Compress the bytes with GZIP.
3. Calculate SHA-256 over the compressed bytes.
4. Append the compressed bytes to the payload list.
5. Record `offset`, compressed `bytes`, `rawBytes`, and `sha256`.
6. Repeat for every `Float32Array` column.
7. Build the UTF-8 JSON manifest.
8. Write magic, big-endian manifest length, manifest, and payload blocks.

Simplified JavaScript pseudocode:

```js
async function addBlock(name, typedArray) {
  const raw = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );
  const compressed = await gzip(raw);
  const descriptor = {
    name,
    offset: payloadLength,
    bytes: compressed.byteLength,
    rawBytes: raw.byteLength,
    sha256: await sha256Hex(compressed),
  };
  payloadBlocks.push(compressed);
  payloadLength += compressed.byteLength;
  return descriptor;
}
```

Browser GZIP implementation:

```js
async function gzip(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
```

The complete output can be created with:

```js
const file = new Blob([
  HISTORY_MAGIC,
  manifestLengthBytes,
  manifestBytes,
  ...payloadBlocks,
], { type: "application/octet-stream" });
```

## 8. Import and validation algorithm

A reader must reject the file without modifying the active session if any
validation fails.

Recommended order:

1. Require at least 12 bytes.
2. Compare all eight magic bytes.
3. Read the big-endian manifest length.
4. Enforce a reasonable manifest-size limit.
5. Confirm `12 + manifestLength <= fileSize`.
6. Decode UTF-8 and parse JSON.
7. Validate `format` and `version`.
8. Require the three streams.
9. For each block, require safe non-negative integer sizes and offsets.
10. Confirm `payloadStart + offset + bytes <= fileSize`.
11. Extract the compressed bytes.
12. Compare the compressed block's SHA-256 with the manifest.
13. GZIP-decompress the block.
14. Confirm decompressed size equals `rawBytes`.
15. Confirm `rawBytes` is divisible by the target element size.
16. Reconstruct the typed array.
17. Confirm each column length equals the corresponding timeline length.
18. Confirm timelines are sorted and unique.
19. Only after all checks pass, replace the current in-memory state.
20. Rebuild all derived analytics.

Browser decompression:

```js
async function gunzip(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
```

Suggested stable error codes:

```text
history_version
history_integrity
out_of_memory
engine_error
```

## 9. Importing new XPENG ZIP files

The `.xpeng` history stores the SHA-256 of every imported ZIP in `imports`.

When importing another ZIP:

1. Calculate its exact SHA-256 before processing.
2. If the hash already exists, return `skipped` without changing state.
3. Parse and normalise the new operation, energy, and status streams.
4. Sort each new stream and deduplicate repeated timestamps.
5. Merge each new stream with the existing stream by timestamp.
6. On an equal timestamp, keep the row from the new import.
7. Preserve ascending order and one row per timestamp.
8. Add the new provenance record to `imports`.
9. Rebuild every derived metric.

Linear merge pseudocode:

```js
while (oldIndex < oldTime.length || newIndex < newTime.length) {
  if (newIndex >= newTime.length) {
    takeOld();
  } else if (oldIndex >= oldTime.length) {
    takeNew();
  } else if (oldTime[oldIndex] < newTime[newIndex]) {
    takeOld();
  } else if (newTime[newIndex] < oldTime[oldIndex]) {
    takeNew();
  } else {
    oldIndex += 1;
    takeNew(); // New import wins on overlap.
  }
}
```

The merge should produce new typed arrays. Avoid converting millions of samples
into arrays of JavaScript objects.

## 10. Memory and performance requirements

- Parse source CSVs as streams instead of expanding the entire archive to one
  string.
- Keep timestamps in `Uint32Array` and signals in `Float32Array`.
- Compress each column separately.
- Do not serialise numeric arrays to JSON or Base64.
- Enforce file, manifest, decompressed-size, and memory limits.
- Perform parsing, compression, decompression, merging, and analytics in a Web
  Worker so the interface remains responsive.
- Send progress events for scanning, parsing, merging, analytics, export, and
  restore.
- Build candidate state separately and only commit it after successful
  validation and analytics generation. This allows safe cancellation and
  rollback on error.

The public test export contains approximately 3.4 million rows. Its version 3
history is approximately 11.6 MB, compared with roughly 50 MB for the previous
SQLite-based history.

## 11. Privacy requirements

- Do not retain the CSV `vin` field.
- Do not include raw VINs in the manifest, import metadata, logs, or errors.
- Do not upload the source ZIP or `.xpeng` history.
- Do not persist the history automatically.
- Export only after an explicit user action.
- Clearly warn that the resulting file is not encrypted.
- Do not include route coordinates or third-party telemetry.

The model name may be retained because it is needed for interpretation and is
not used as a vehicle identifier.

## 12. Compatibility strategy

The private application can use this routing:

```text
magic XPENGA\0\3
    -> native version 3 reader

older .xpeng or JSON.GZ signature
    -> existing legacy reader

new export action
    -> always create version 3
```

Do not rewrite a legacy file automatically. Import it through the legacy
reader, convert it to the current in-memory columns, and create version 3 only
when the user explicitly exports a new history.

## 13. Required tests

At minimum, test:

- valid export/import round trip;
- exact archive imported twice;
- overlapping archive where newer values win;
- unsorted CSV rows;
- duplicate timestamps inside one export;
- multipart CSV order;
- truncated manifest;
- invalid block offsets;
- altered compressed block;
- altered SHA-256;
- incorrect `rawBytes`;
- missing required stream;
- column/timeline length mismatch;
- unsupported version;
- memory-limit rejection;
- cancellation without corrupting the existing session;
- history with `NaN` missing values;
- restore followed by an additional ZIP import;
- confirmation that no VIN appears in the finished file.

## 14. Public reference implementation

The public JavaScript implementation is located in:

```text
web/src/engine/native-engine.js
web/src/engine/worker.js
web/scripts/test-native-engine.mjs
```

The architecture was inspired by
[LogbooX](https://github.com/schliflo/logboox) by Florian Schlittenbauer. The
corresponding acknowledgement and MIT licence notice are preserved in
`THIRD_PARTY_NOTICES.md`.
