# XPENG Analytics 1.5.1

Version 1.5.1 brings the full XPENG Analytics experience to lower-memory mobile
browsers without reducing telemetry detail, metrics, or chart availability.

## What changed

- XPENG ZIPs are passed to the Web Worker as files and read in bounded ranges.
- CSV columns are built in fixed-size chunks, with a smaller allocation profile
  on mobile devices.
- The parser extracts only the fields required by the public dashboard.
- Ordered duplicate timestamps are resolved while streaming instead of in a
  second full-memory pass.
- Native `.xpeng` histories are restored one compressed column at a time.
- The previous expanded-size projection no longer rejects suitable mobile
  devices before processing starts.

Mobile and desktop produce the same dashboard and portable `.xpeng` history.
The distinction is limited to how memory is allocated while importing.

## Validation

The production build, translations, file-selection tests, browser runtime, and
native-engine round trips pass. A 13.5 MB XPENG ZIP expanding to 317.5 MB was
also imported in a Pixel 9-sized Chrome profile with the complete result:

- 3.43 million input rows;
- 126 trips;
- 11 charging sessions;
- all dashboard sections and charts available.

Real-device Chrome and Firefox testing remains valuable because Android may
apply different per-tab memory limits depending on device state.
