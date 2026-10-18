# XPENG Analytics 2.1.0

Planned public release: 18 October 2026.

Version 2.1 combines the complete unreleased 2.0 feature set with optional
Google Drive backup. Version 2.0 will not be published separately.

## Optional Google Drive backup

Users can connect their Google account with the official Google Identity
Services flow and save one portable `.xpeng` history in a visible **XPENG
Analytics** Drive folder. The same history can be restored on another computer
after signing in again. A separate option updates the backup after imports and
personal-chart changes while the current tab remains authorised.

The feature uses the limited `drive.file` permission. Google credentials and
email addresses are never requested by XPENG Analytics, and access tokens stay
in tab memory. The project still has no application backend, hosted database,
or XPENG Analytics account. Processing remains local; only the already-created
unencrypted `.xpeng` backup is sent to Google when the user enables Drive.

## Complete ownership toolkit

This release also includes all work prepared for 2.0: optional persistent
browser history and reminders; long-term trends and driving-context estimates;
automatic GPX matching and OpenStreetMap journey maps; synchronized map/chart
inspection and optional PDF route traces; `.xpeng` version 5; My Charts; visual
journey replay; the grouped responsive navigation; the bilingual first-use
guide; and extensive import, memory, chart, map, and replay optimisations.

The landing page now presents import, remembered history, and Google Drive
restore as clear alternatives without an unused empty-dashboard panel. Journey
and charging detail charts use a full-width stacked layout with synchronized
time inspection, while their record lists remain visible for faster switching.
The new public About page explains why the project exists, what it can do, and
the local-first ownership model without development-focused copy in the app.

## Compatibility and validation

New histories use `.xpeng` version 5. Versions 1–5 remain readable through the
native or compatibility importer. Automated tests cover the Drive API client
with mocked authorisation, folder creation, resumable upload, discovery, and
download in addition to the existing engine, history, GPX, replay, chart,
translation, and browser-runtime suites.

Real Google sign-in, save, discovery, restore, account switching, and
disconnect were owner-tested on the registered local origin. The same flow
must be smoke-tested once on the deployed GitHub Pages origin after release.
