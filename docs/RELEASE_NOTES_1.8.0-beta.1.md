# XPENG Analytics 1.8.0-beta.1

This private-staging beta starts roadmap Phase 10 with optional GPS matching
and journey maps. It is not yet a public release.

## GPX import and matching

- Added local import of individual GPX files or ZIP archives containing GPX.
- Tested the same drives recorded with BasicAirData GPS Logger on Android and
  Open GPX Tracker on iPhone.
- Added automatic matching by time overlap, start/end proximity, distance, and
  recording quality, with a visible confidence score.
- Added duplicate-track selection so the better Android/iPhone recording is
  used for a journey without displaying two maps.
- Added manual correction on the Data page.
- Added optional removal of the first and last 100, 250, or 500 metres during
  import. The default remains no trimming.

## Maps and reports

- Added a local route trace to matched journey details.
- Added an explicit **Load OpenStreetMap** action. Online tiles are off by
  default, attribution remains visible, and the privacy notice explains that
  tile requests reveal the viewed area to the provider.
- Added an optional PDF setting that draws route traces locally without
  downloading or embedding an online basemap.

## Portable history

- Added `.xpeng` version 4 with individually compressed and checksummed GPS
  time, coordinate, elevation, speed, and segment blocks.
- Preserved GPX provenance, trimming, and manual journey corrections.
- Kept version 3 histories readable and retained legacy compatibility for
  versions 1 and 2.

## Validation

- Added synthetic tests for Android/iPhone-style GPX, duplicate selection,
  manual correction, trimming, and v4 export/restore.
- Verified the supplied seven-day XPENG export and six real GPX tracks: the
  matching route was selected from the complete Android recording, while
  unmatched later recordings remained available for manual review.
- Verified the complete browser workflow: ZIP import, GPX ZIP import, journey
  map, manual override and reset, PDF with route trace, `.xpeng` export, and
  `.xpeng` restoration with all GPS tracks retained.

