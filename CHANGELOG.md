# Changelog

All notable public changes are documented here.

## 2.2.0 — 2026-10-27

- Added an automatic original-export retention registry. Each imported XPENG
  ZIP is recorded in the portable `.xpeng` history with its SHA-256 digest,
  filename, byte size, observed coverage, row count, and Drive retention state.
- Renamed the original XPENG export destination for new users to
  `XPENG Analytics/Raw Files`. Existing `Original XPENG exports` folders remain
  supported and are reused without moving user files.
- Kept every retained ZIP byte for byte as supplied by XPENG. After a newer
  original is safely uploaded, the app selects the smallest practical set of
  source files that preserves the complete observed time range, preferring
  four days of overlap between adjacent exports.
- Added conservative handling for exports without trustworthy coverage: they
  are always retained. Duplicate ZIPs continue to be skipped by SHA-256.
- Replaced redundant originals by moving them to Google Drive trash, where
  they remain recoverable, while preserving their registry entries and all
  already imported telemetry in the `.xpeng` history.

- Added portable-history version 7 with independently compressed monthly
  telemetry shards. The dashboard keeps compact cross-month summaries and
  record indexes in memory, then restores detailed journey, charging, replay,
  and route data only for the selected month.
- Added transparent migration of `.xpeng` versions 3–6 to the segmented v7
  layout, continued import of new overlapping XPENG ZIPs, and preservation of
  recent unmatched GPX recordings for later automatic matching.
- Added a synthetic 24-month regression test plus a real v5 migration check.
  The real 14.49 MiB test history opens as two lazy monthly shards; its compact
  dashboard contains no detailed trip series until a record is requested.
- Added a dedicated Insights area with personal-baseline anomaly observations,
  automatic monthly summaries, and seasonal comparisons.
- Added a data-coverage calendar for journeys, charging, parked telemetry,
  tyre observations, and matched GPS, with partial coverage shown explicitly.
- Added battery-history trends with sample counts, observation periods, and
  confidence states for calculated capacity, relative SOH, efficiency,
  temperature, and usable range.
- Added local global search across journeys, charging sessions, dates, saved
  charts, sections, and relevant settings, including keyboard navigation and
  direct opening of matching records.
- Added privacy-safe PNG cards for selected insights. Default exports omit
  coordinates, route shapes, filenames, exact timestamps, and internal IDs.
- Expanded optional Google Drive backup with the connected account, backup
  time, size, telemetry coverage, and history-format version.
- Added transparent restore selection for the current Drive backup and up to
  three earlier recovery copies created before successful replacements.
- Added explicit coverage-gap warnings, improved quota and rate-limit errors,
  and resumable-upload recovery after an interrupted transfer.
- Kept automatic Drive updates opt-in and limited to the authorised browser
  session after successful XPENG ZIP, GPX, history, or saved-chart changes.
- Added a separate, disabled-by-default option to archive successfully imported
  original XPENG ZIPs byte for byte in Google Drive. Duplicate ZIPs are skipped
  by their locally calculated SHA-256 digest and never mixed with `.xpeng`
  recovery copies.
- Added an original-export list with coverage, size, download, and explicit
  deletion controls, plus a separate opt-in archive for recognised GPX files
  and GPX ZIPs containing precise location data.
- Added non-destructive manual journey groups. Users can combine two or more
  XPENG journeys, analyse the complete outing or each original segment, and
  see charging sessions detected during the stops between them.
- Saved manual group definitions in portable-history version 6 and later so local,
  persistent, exported, and Google Drive histories keep the same structure.
- Added synthetic tests for coverage, battery history, anomalies, monthly
  summaries, seasonal comparisons, global search, and insight-card privacy.
- These changes passed the complete browser and Python test suites, public-tree
  audit, and production build before the public release. Some of the newest
  functionality remains under wider real-world validation.

## 2.1.3 — 2026-10-21

- Added the complete vehicle-telemetry date range beneath the XPENG Analytics
  logo, so the current history coverage remains visible throughout the app.
- Added the same compact, localized date range to mobile navigation.

## 2.1.2 — 2026-10-20

- Keep complete GPX recordings that do not yet match an XPENG journey when
  they end within five days of the newest imported vehicle telemetry, including
  recordings newer than the available XPENG export.
- Automatically retry those retained recordings whenever newer XPENG ZIPs are
  added, so a route recorded today can be matched after the delayed vehicle
  data becomes available.
- Remove old unmatched coordinates from new `.xpeng` exports once vehicle
  telemetry has advanced more than five days beyond them, while preserving
  lightweight import provenance.

## 2.1.1 — 2026-10-19

- Changed journey telemetry axes and tooltip headings from elapsed minutes to
  the actual local time of each recorded sample.
- Made journey details more compact so the route map and charts are easier to
  compare without excessive scrolling.
- Moved **Technical highlights** above the journey map and reduced unused
  spacing in journey metric, chart, and map panels.
- Kept the compact layout scoped to Journeys, including a separate mobile
  adjustment, so other dashboard pages retain their existing presentation.

## 2.1.0 — 2026-10-18

- Added optional Google Drive backup and restore using Google Identity Services
  and the limited `drive.file` permission, with no application backend or
  stored access token.
- Added a visible XPENG Analytics Drive folder, resumable `.xpeng` uploads,
  restore on another computer, explicit connect/disconnect controls, and
  optional automatic updates while the current tab remains authorised.
- Reworked the landing page so file import, remembered local history, and
  Google Drive restore are immediately visible without an unused empty-state
  dashboard panel.
- Reorganized journey and charging details into stacked full-width charts with
  synchronized time inspection and a sticky record list for faster comparison.
- Added a public About page describing the project's purpose, capabilities,
  independent status, and local-first data model.
- Version 2.0 was kept as an internal release candidate; these changes and the
  complete 2.0 feature set are being released together as 2.1.

- Added opt-in persistent local history in IndexedDB, automatic restoration on
  the same browser profile, visible storage details, permanent deletion, and
  configurable 7-, 15-, 25-, or 30-day local import reminders.
- Added long-term monthly trends for distance, consumption, indicated range,
  estimated capacity, relative SOH, parked use, charging, and tyre pressure.
- Added explicitly unofficial urban-, road-, and motorway-style driving
  estimates based on short telemetry blocks, with confidence and energy data.
- Added optional GPX and GPX-in-ZIP import from the Data page, automatic
  timestamp matching, all-day recording segmentation, duplicate selection,
  optional route-end trimming, and OpenStreetMap journey maps.
- Synchronized journey charts with the matched map position and added optional
  local route traces to PDF reports.
- Added the `.xpeng` version 5 format, preserving compressed telemetry, matched
  GPS routes, import provenance, integrity checks, and allow-listed personal
  chart definitions in one portable file.
- Added **My charts**, with guided data selection, live previews, five chart
  types, daily or monthly grouping, unit conversion, and saved-chart editing,
  duplication, reordering, and deletion.
- Added an interactive journey replay with a three-month journey calendar,
  seeking, compressed gaps, 1x/2x/3x/5x/10x playback, synchronized analytical
  charts, and a timestamp-following GPX map when available.
- Added a lightweight generic vehicle reconstruction with observed speed,
  power, accelerator, brake, steering, gear, door, window, and boot states.
  Brake lamps use the recorded brake signal; low beams are a clearly visual
  day/night approximation when no lighting signal is available.
- Added a useful no-GPS replay layout so vehicle telemetry and playback remain
  available without a route recording.
- Added an optional, local driving-personality easter egg derived from the
  already calculated driving observations.
- Reorganized desktop and mobile navigation into clearer groups, kept data
  import one click away, and consolidated language, theme, units, tyre pressure,
  and help into one settings panel.
- Added a bilingual, keyboard-accessible first-use guide. Current histories do
  not interrupt returning users; older histories can introduce the new 2.0
  areas once, and the guide can always be restarted manually.
- Improved large-history responsiveness through lazy-loaded workspaces,
  deferred journey details, bounded visual samples, isolated modal state,
  reduced chart rebuilding, and optimized replay and map updates.
- Expanded automated coverage for onboarding, personal charts, GPX matching,
  replay timing and states, driving personalities, native-history round trips,
  translation parity, and browser import behavior.

## 1.8.0-beta.3 — 2026-10-16

- Unified later XPENG ZIP, GPX, and GPX-in-ZIP additions in one Data-page
  importer with file-type detection and drag-and-drop.
- Replaced manual route selection with fully automatic trip-level timestamp
  matching.
- Continuous all-day GPX recordings are clipped to actual XPENG driving
  intervals, excluding parked periods and unrelated movement.
- When multiple recordings cover the same trip, the strongest route is kept
  and overlapping alternatives are discarded automatically.
- Unmatched routes remain available during the current import session so a
  later XPENG ZIP can match them; only matched route slices are written to the
  portable `.xpeng` history.
- Added a start-page explanation that GPS routes can be added from Data after
  the first XPENG import.

## 1.8.0-beta.2 — 2026-10-16

- Fixed blocked OpenStreetMap tiles by allowing the origin referrer required by
  the official tile usage policy.
- Removed the background-map toggle and now loads the OpenStreetMap background
  automatically when a journey has a matched GPX route.
- Added chart-to-map synchronisation: hovering any journey telemetry chart
  highlights the temporally corresponding point on the GPS route.
- Optimised chart-to-map tracking by updating only the Leaflet marker once per
  animation frame and using an indexed timestamp lookup, instead of rendering
  the complete journey view for every pointer movement.
- Updated the map privacy notice and GPS documentation for the automatic tile
  requests.

## 1.8.0-beta.1 — 2026-10-16

- Added local GPX and GPX-in-ZIP import for optional journey routes.
- Added automatic time/distance/quality matching, confidence, duplicate-track
  selection, and manual correction.
- Added optional 100, 250, or 500 metre trimming at both route ends.
- Added local journey traces and an explicit opt-in OpenStreetMap background
  with attribution and privacy messaging.
- Added optional local GPS route diagrams to PDF reports.
- Added `.xpeng` version 4 with compressed, checksummed GPS blocks and manual
  matching metadata while retaining version 3 import compatibility.
- Added real-file browser validation and automated GPX/history regression
  tests.

## 1.7.0-beta.1 — 2026-10-16

- Added a dedicated Trends page with monthly distance, consumption, indicated
  range, estimated capacity, relative SOH, parked use, charging, and tyre
  pressure views.
- Added estimated urban-, road-, and motorway-style driving breakdowns using
  short telemetry blocks rather than whole-trip maximum speed.
- Driving-context estimates include distance, time, energy used, regenerated
  energy, consumption, and a confidence score.
- Context classification uses sustained speed, stops, acceleration, and
  braking, and is explicitly labelled as a software estimate without GPS or
  actual road identification.
- Existing legacy histories receive a low-confidence trip-level fallback while
  current `.xpeng` histories are recalculated from their full telemetry.

## 1.6.0-beta.2 — 2026-10-16

- Replaced the fixed 30-day update reminder with a user-selected interval of
  7, 15, 25, or 30 days.
- Added the calculated date of the next local reminder to the Data page.
- Kept the existing 30-day interval as the default for users upgrading from
  the first beta.

## 1.6.0-beta.1 — 2026-10-16

- Added an opt-in persistent local history stored in the current browser's
  IndexedDB storage, with automatic restoration on the next visit.
- Added automatic refresh of the saved history after successful ZIP imports.
- Added saved-size, last-save, and last-import information to the Data page.
- Added an optional local 30-day reminder to request and add a newer XPENG
  export without accessing or automating the user's XPENG account.
- Added an explicit action to permanently delete the browser-stored history.
- Persistent history remains disabled by default, local, unencrypted, and
  limited to one history per browser profile.
- Restricted GitHub Pages deployment to the public repository so the private
  staging repository runs quality checks without publishing a staging site.

## 1.5.1 — 2026-10-14

- Added a mobile-specific import profile while retaining the same telemetry,
  metrics, charts, and `.xpeng` history format used on desktop.
- Removed the conservative mobile memory projection that incorrectly rejected
  a 13.5 MB compressed, 317.5 MB expanded 30-day export before processing.
- Changed native ZIP and `.xpeng` imports to pass the selected `File` directly
  to the Web Worker and read only the required byte ranges.
- Replaced overallocated growing arrays with fixed-size column chunks, using
  smaller chunks on mobile and larger chunks on desktop.
- Reduced temporary allocations by parsing only the required CSV fields and by
  deduplicating already ordered timestamps while they are read.
- Replaced JavaScript sorting indexes with compact typed indexes for the rare
  exports whose timestamps are not ordered.
- Added regression tests for mobile Blob-based ZIP and `.xpeng` imports.
- Verified the full 30-day test export in a Pixel 9-sized Chrome profile: 3.43
  million rows, 126 trips, and 11 charging sessions completed with the full
  dashboard available.

## 1.5.0 — 2026-10-14

- Added Metric/Imperial display controls and an independent bar/psi tyre
  pressure selector to the sidebar.
- Synchronized the four technical charging charts and expanded their tooltip
  to show power, peak power, SOC, voltage, current, and battery temperature for
  the same instant.
- Expanded the PDF report with the highest-distance day, average and longest
  journey, regeneration share, AC/DC energy, and peak charging power.
- Added Miguel Pinto's authorship and the public application URL to every PDF
  page footer.
- Completed the colour accents across Driving, Charging, Battery, and Tyres
  summary cards.
- Added complete English and European Portuguese user guides and refreshed the
  public documentation for the release.
- Added a dedicated Tyres section and removed tyre-pressure views from the
  Battery section.
- Fixed clipped tyre-pressure axis labels so full kPa values are visible.
- Removed the fixed Lisbon timezone from charging habits and activity charts;
  time-based analysis now follows the browser's local timezone.
- Added AC/DC energy totals, session counts, a type breakdown chart, and
  distinct AC/DC colours in the energy-per-charge chart.
- Made recent journeys and charging sessions on the overview open the exact
  selected record in its detailed section.
- Synchronized all journey telemetry charts so one hover position reveals the
  same moment across speed, power, battery, temperature, forces, pedals,
  motor, and tyre-pressure views.
- Added an explicitly unofficial software estimate of driving profile based on
  accelerator use, high-speed share, and observed driving forces.
- Treat zero-only rotor-temperature signals as unavailable observations rather
  than reporting a physical temperature of 0 °C.
- Expanded each journey with lateral acceleration, steering angle, rear-motor
  torque and rotor temperature highlights.
- Added journey charts for driving forces, pedal inputs, rear-motor behaviour,
  and all four tyre pressures.
- Added maximum cornering to the driving summary.
- Added real-world versus XPENG range, tyre-imbalance, and trip
  temperature-versus-consumption charts to the battery area.
- Added a period energy-flow comparison to the overview.
- Added a readable signal-availability panel that explains which metrics each
  XPENG export can support.
- Extended native-engine round-trip tests for the new journey telemetry and
  availability metadata.
- Restored progressive multi-ZIP feedback so the complete dashboard is rendered
  after every imported file while the remaining archives continue in the
  background.
- Improved Firefox import performance by throttling progress messages,
  preventing unchanged charts from re-rendering, disabling repeated chart
  animations, and replacing per-sample allocations and binary searches with
  sequential aggregation.
- Made every main navigation tab return to the top of the page.

## 1.4.1 — 2026-10-14

- Replaced the subtle start-page upload controls with a large, familiar
  dashed drop zone that can be clicked or used directly for drag and drop.
- Kept multi-ZIP and automatic `.xpeng` history detection in the same control.

## 1.4.0 — 2026-10-14

- Added drag and drop to the start page for XPENG exports and histories.
- A single picker now accepts multiple Data Act ZIPs or one `.xpeng` history.
- When a history and ZIPs are selected together, the history is restored first
  and the additional exports are then merged into the same local session.
- Added clear validation for unsupported files and ambiguous selections with
  more than one history.

## 1.3.1 — 2026-10-13

- Ordered journey and charging-session lists explicitly from newest to oldest,
  including the recent items shown on the overview page.

## 1.3.0 — 2026-10-13

- Replaced the normal Python/SQLite import path with a streaming JavaScript Web
  Worker and typed columnar storage, while retaining the old processor only for
  version 1 and 2 history compatibility.
- Reduced the tested 30-day import from minutes to well under one minute on the
  development computer; exact performance still depends on the browser and PC.
- Added compact `.xpeng` history version 3 with per-column gzip compression and
  integrity checks. A 3.4-million-row test export produced an 11.6 MB history.
- Added driving analytics for speed, accelerator use, regeneration, g-g
  distribution, and notable dynamic events.
- Added charging-habit indicators, XPENG-indicated range, SOC and thermal
  ranges, tyre-pressure trends, and an hourly activity heatmap.
- Added conservative memory checks, detailed processing progress, and full
  European Portuguese and English copy for the new metrics.
- Added visible LogbooX credit and preserved its MIT notice in
  `THIRD_PARTY_NOTICES.md`.

## 1.2.1 — 2026-10-12

- Changed the default interface language to English in every browser while
  keeping European Portuguese available from the language selector.

## 1.2.0 — 2026-10-11

- Added a bilingual report area with a custom date range, distance,
  consumption, charging, and estimated cost summaries.
- Added fully local PDF generation with daily and charging-session details.
- Added an optional average energy price and report reference; calculated
  costs are clearly marked as estimates and not fiscal documents.

## 1.1.1 — 2026-10-11

- Added a direct link to the XPENG data-request portal on the start page.
- Clarified that importing XPENG data can take up to 20 minutes on some
  computers.
- Separated the charging and battery summaries into individual cards.
- Simplified public-facing copy in Portuguese and English while preserving
  the calculated-metric and privacy warnings.
- Removed the legacy-history compatibility note from the interface; legacy
  JSON.GZ import remains supported.

## 1.1.0 — 2026-10-11

- Added a custom date range shared by overview, journeys, charging, battery,
  and activity views.
- Expanded charging totals with total duration, maximum power, and explicit
  total estimated losses in kWh.
- Rebuilt battery and parked-use cards from the detailed private reference,
  while keeping capacity and SOH clearly labelled as calculated estimates.
- Added parked-power and daily parked-loss charts plus a more detailed stop
  table.
- Expanded activity with period totals and daily energy, charging-energy, and
  charging-session charts; fixed journeys by month and clarified its meaning.
- Added the Ko-fi action and displayed application version to the sidebar.
- Introduced compact `.xpeng` history version 2 with streaming XZ/LZMA2
  compression; legacy JSON.GZ histories remain importable.

## 1.0.0 — 2026-10-11

- First stable public release of XPENG Analytics.
- Local-only XPENG Data Act ZIP processing in the browser.
- Portable, unencrypted JSON.GZ history export and restore.
- Detailed overview, journey, charging, battery, activity, and quality views.
- European Portuguese and English interface.
- Light theme by default with an optional dark theme.
- Public privacy, security, contribution, and issue-reporting guidance.
- Automated quality checks and GitHub Pages deployment.
- Validated with a 30-day export and smoke-tested in Firefox, Chrome, and Edge.
