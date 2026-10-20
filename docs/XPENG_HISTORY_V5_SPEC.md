# XPENG Analytics portable history format v5

## 1. Purpose and compatibility

Version 5 extends the [version 4 format](XPENG_HISTORY_V4_SPEC.md) with saved
personal chart definitions. Telemetry columns, optional GPS route blocks, GZIP
compression, SHA-256 checksums, and integrity validation are unchanged. The
writer may use the existing GPS block schema for recent source recordings that
are still waiting for delayed XPENG telemetry.

The native reader accepts versions 3, 4, and 5. New exports use version 5.
Older histories open normally and start with no saved personal charts.

The file is compressed but not encrypted. It can contain vehicle telemetry,
precise GPS routes, and user-authored chart titles or descriptions. It must be
handled as sensitive personal data.

## 2. Binary header

The eight-byte magic for version 5 is:

```text
58 50 45 4e 47 41 00 05
 X  P  E  N  G  A \0 v5
```

The rest of the binary layout remains unchanged: a four-byte big-endian
manifest length, the UTF-8 JSON manifest, and concatenated GZIP blocks.

## 3. Personal chart manifest extension

Version 5 adds an optional `customCharts` array at the manifest root:

```json
{
  "format": "xpeng-analytics-columnar-history",
  "version": 5,
  "streams": {},
  "gps": { "imports": [], "tracks": [] },
  "customCharts": [
    {
      "id": "12ea93a2-2eaf-4a42-b8bd-586a70771e33",
      "title": "Distance and energy",
      "description": "My monthly comparison",
      "dataset": "daily",
      "type": "line",
      "x": "date",
      "y": ["distanceKm", "netEnergyKwh"],
      "period": "all",
      "start": "",
      "end": "",
      "groupBy": "month"
    }
  ]
}
```

Only compact display definitions are stored. Processed rows, duplicated
telemetry, chart pixels, executable expressions, HTML, and JavaScript are not
part of a chart definition.

## 4. Validation

Readers must treat `customCharts` as untrusted input. XPENG Analytics applies
the following limits and allow-lists before a definition reaches the UI:

- at most 24 saved charts;
- unique identifiers limited to 64 characters;
- titles limited to 80 characters and descriptions to 240 characters;
- known dataset, field, chart-type, period, and grouping identifiers only;
- at most three vertical series, or one for a scatter chart;
- no vertical series for a histogram;
- control characters removed from user-authored text;
- unsupported definitions ignored without affecting telemetry restoration.

Current chart types are `line`, `area`, `bar`, `scatter`, and `histogram`.
Current groupings are `none`, `day`, and `month`.

## 5. Pending GPS retention

The `gps.tracks` array may contain both:

- route slices associated with a journey, with a non-null `matchedTripId`;
- complete recent source recordings awaiting a match, with
  `matchedTripId: null`.

For each export, the writer finds the latest timestamp across the imported
vehicle telemetry streams. An unmatched source recording is retained if its
end timestamp is no more than five days before that timestamp, or if it is
newer than the available telemetry. This rule deliberately uses imported
telemetry time rather than the computer clock because XPENG exports can lag
behind GPX recordings.

After a later XPENG archive is added, route matching runs again over retained
recordings. An unmatched recording older than the five-day boundary is omitted
from the next portable history, although its lightweight import provenance may
remain in `gps.imports`.

No format-version change is required because version 4 already defined
`matchedTripId` as optional and the reader already validates the same aligned
GPS arrays for matched and unmatched records.

## 6. Units and portability

Definitions store canonical field identifiers, not pre-converted values.
Distance, speed, consumption, temperature, and pressure are converted at
render time using the receiving browser's Metric/Imperial and bar/psi choices.
This lets the same `.xpeng` history render correctly on another device.

Creating, editing, rendering, exporting, and restoring charts is local and
requires no account, analytics service, or application server.
