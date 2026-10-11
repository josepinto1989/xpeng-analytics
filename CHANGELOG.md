# Changelog

All notable public changes are documented here.

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
