# Changelog

All notable public changes are documented here.

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
