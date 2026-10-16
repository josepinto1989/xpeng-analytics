# XPENG Analytics 1.8.0-beta.3

This private-staging beta makes optional GPS import fully automatic and places
all later data additions in one Data-page importer.

## One importer after the first XPENG export

- The initial screen still starts with XPENG data or a portable `.xpeng`
  history.
- After the dashboard opens, **Data > Add more data** accepts later XPENG Data
  Act ZIPs, individual GPX files, and ZIP archives containing GPX files.
- The importer identifies the file type locally and supports both file
  selection and drag-and-drop.

## Automatic route matching

- GPX points are matched to individual XPENG trip timestamps rather than to a
  complete recording or journey.
- An all-day GPX recording can therefore produce several car routes while
  parked periods, walks, and other movement outside XPENG driving intervals
  are ignored.
- When several recordings overlap the same trip, the route with the strongest
  time, distance, speed, and recording-quality result is retained
  automatically.
- There is no file list or manual journey-assignment workflow.

## Portable history and privacy

- Unmatched GPX recordings can remain temporarily available during the active
  import session so a later XPENG ZIP selected by the user can match them.
- Only matched trip slices and their duplicate-selection provenance are stored
  in the compressed `.xpeng` history.
- GPS coordinates remain local and unencrypted. Users are responsible for
  protecting exported histories.

## Validation

- Added regressions for all-day segmentation, incomplete duplicate recordings,
  deterministic selection, optional trimming, and `.xpeng` export/restore.
- Validated the supplied seven-day XPENG export and the Android/iPhone GPX ZIP
  without copying private files into the repository.
