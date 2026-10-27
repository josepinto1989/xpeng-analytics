# Roadmap

## Completed

### Phase 1 — Public-project foundation

Create an isolated, sanitised repository without copying private history or
real vehicle data.

### Phase 2 — Bilingual local-first interface

Build the browser interface in European Portuguese and English, with clear
privacy messaging and no application server.

### Phase 3 — Import and portable history

Process XPENG Data Act ZIP exports locally, deduplicate records, add more data
to the active session, and export or restore a versioned portable history.

### Phase 4 — Detailed analytics

Deliver overview, journeys, charging, battery observations, activity, quality,
and data-management views at the level of detail established by the private
reference project, using only information available in XPENG exports.

### Phase 5 — Public-release preparation

Add privacy and security documentation, synthetic automated tests, public-tree
auditing, GitHub Actions, GitHub Pages deployment, and a privacy-safe issue
form.

### Phase 6 — v1.0.0 release validation

Validate the deployed application in Firefox, Chrome, and Edge; complete a
real 30-day import; verify populated battery charts; export and restore a
JSON.GZ history; and publish the first stable release.

## Active and planned

### Phase 7 — User acceptance and operational improvements

This phase is intentionally driven by real use after v1.0.0.

Phase 7 cycles through v1.5.0 delivered custom date ranges, expanded charging,
battery, parked-use, driving, tyres, and activity views, the smaller streaming
`.xpeng` v3 history format, fast progressive multi-ZIP imports, synchronized
journey and charging charts, Metric/Imperial and bar/psi controls, detailed
signal availability, and richer local PDF usage and cost reports. Phase 7
remains open for real-world feedback and incremental operational improvements.

- Test imports from different XPENG export periods and models.
- Compare representative totals with the source export and the private
  reference dashboard.
- Record browser version, import size, duration, and the exact failing step.
- Report reproducible bugs through GitHub Issues without attaching vehicle
  exports, histories, VINs, locations, or screenshots containing personal data.
- Improve long-running progress messages so expensive steps never look frozen.
- Collect feedback on the local PDF report from company-car and expense-report
  workflows.
- Triage compatibility, accessibility, memory use, and performance issues.
- Keep dependencies and browser runtimes current through reviewed patch or
  minor releases.
- Promote fixes only after automated tests and a clean public-tree audit pass.

Phase 7 has no fixed end date. It is the operating cycle for testing, feedback,
maintenance, and incremental releases.

### Phase 8 — Opt-in persistent local history

Allow returning users to keep a working history on the same device without
having to select the portable file on every visit.

The feature-complete implementation is available in private staging as
`1.6.0-beta.2`. It supports one remembered history per browser profile and has
passed owner testing, including the configurable reminder. Phase 8 is complete
and can be promoted with the next reviewed public release.

- Add a disabled-by-default `Remember this history on this device` option.
- Store the processed history in browser-local storage, with no account or
  application server.
- Request persistent browser storage when supported and clearly explain that
  browser data can still be removed by the user, browser, or operating system.
- Restore the most recent local history automatically after explicit consent.
- Add new XPENG ZIP exports to the remembered history using the existing
  deduplication rules.
- Show the date of the most recent imported export and, if the user enables it,
  provide an on-device reminder after 7, 15, 25, or 30 days to request and add
  a new XPENG export. Show the next reminder date. This is a local reminder
  only: the project will not sign in to, scrape, or automate downloads from the
  user's XPENG account without an official supported API.
- Keep `.xpeng` export and import as the recommended portable backup.
- Provide an obvious action to inspect storage use and permanently erase all
  locally remembered vehicle data.
- Keep one remembered vehicle history per browser profile in this phase. A
  multi-vehicle library can be reconsidered later if users request it.

### Phase 9 — Long-term ownership and expense workflows

Build on persistent history with tools that become more useful over several
months.

The monthly trends and telemetry-block driving-context estimates are implemented
and owner-validated for v2.1. Manual journey and charging labels, tariff
profiles, and export summaries remain for a later Phase 9 iteration.

- Add monthly trends for consumption, range, estimated capacity, relative SOH,
  parked use, charging, and tyre pressure.
- Estimate driving context at telemetry-segment level using speed distribution,
  sustained speed, stops, acceleration, and braking. Present distance, time,
  energy used, regenerated energy, and average consumption for urban, road,
  and motorway-style driving.
- Label every driving-context result as a software estimate rather than a
  detected road type, include a confidence indicator, and avoid claiming that
  the vehicle or XPENG supplied the classification.
- When optional GPS route matching is available, investigate using matched
  OpenStreetMap road information to refine the estimated categories without
  making location data mandatory.
- Allow journeys to be labelled as personal or business and included in
  monthly PDF or CSV summaries.
- Allow charging sessions to be categorised manually as home, work, or public
  without requiring location data.
- Support optional electricity tariffs and clearer cost summaries while
  continuing to label costs as estimates rather than invoices or fiscal
  documents.

### Phase 10 — Optional GPS route matching and journey maps

Research and prototype local import of GPS logger files so recorded positions
can be matched to XPENG journeys by timestamp. Location import remains
optional, but once accepted by the user the matched tracks become part of the
portable `.xpeng` history so the complete archive can be restored from one
file.

**Status: implemented and owner-validated for v2.1.** It supports a unified
later-data importer for XPENG ZIPs, GPX and GPX-in-ZIP,
BasicAirData and Open GPX Tracker files, fully automatic trip-level timestamp
matching, duplicate selection, all-day recording segmentation, optional
route-end trimming, OpenStreetMap journey maps, chart-to-map position
synchronisation, PDF route traces, and `.xpeng` v4 persistence. CSV GPS import
and a separately licensed offline basemap remain research items for later
Phase 10 iterations.

- Start with open interchange formats such as GPX and CSV rather than locking
  the project to one GPS logger application.
- Use [BasicAirData GPS Logger for Android](https://play.google.com/store/apps/details?id=eu.basicairdata.graziano.gpslogger)
  and [Open GPX Tracker for iPhone](https://apps.apple.com/app/open-gpx-tracker/id984503772)
  as the first compatibility references while continuing to accept files from
  other applications that follow the supported GPX or CSV formats. Prioritise
  GPX from BasicAirData because it contains UTC timestamps, coordinates,
  altitude, speed, and fix information needed for journey matching.
- Match GPS tracks to individual XPENG trip start and end times, retain a
  visible confidence score, and resolve overlapping recordings automatically
  without asking the user to manage files or assignments.
- Show the matched route in journey details and keep the original XPENG
  telemetry as the source for vehicle metrics.
- Extend the versioned `.xpeng` format with compressed GPS track blocks,
  timestamps, matching metadata, and integrity checks. Histories containing
  location data remain local, portable, compressed, and unencrypted.
- Make route trimming an optional import setting. The user can choose to omit
  the first and last part of every matched trip slice before it is written to
  the `.xpeng` history; no trimming is applied by default.
- Use OpenStreetMap as the initial basemap, preserve the required attribution,
  and document that requesting online map tiles reveals the viewed map area to
  the tile provider even though the application does not upload the imported
  GPS file.
- Add an explicit PDF option to include or exclude journey maps. Maps are only
  rendered into the report when the user enables the option.
- Keep all parsing, matching, coordinate storage, route calculations, and PDF
  composition on the user's device. XPENG Analytics does not retain a copy of
  the GPS file or `.xpeng` history.
- Investigate packaged OpenStreetMap-derived vector data or a provider that
  explicitly permits offline use for the desktop application. The standard
  OpenStreetMap tile service must not be bulk-downloaded for offline packs.

### Phase 11 — Personal chart studio

**Status: implemented and owner-validated locally for v2.1; not published.**
The core builder, live preview, saved-chart management, responsive layout,
allow-list validation, unit conversion, and `.xpeng` v5 round trip are ready.
Selection of saved charts for PDF reports remains an optional v2.1 finishing
task rather than a blocker for the validated chart studio.

Add a dedicated **My charts** section where users can build, name, save, and
reopen their own visualisations from the data already processed locally. The
feature must guide normal users through valid choices without exposing raw
implementation details or allowing an invalid chart to break the dashboard.

- Offer clear data groups such as journey telemetry, trips, charging sessions,
  daily totals, monthly trends, battery observations, tyre pressure, and
  parked-use intervals. Only expose fields that exist in the current history.
- Let the user select the horizontal axis, one or more vertical-axis metrics,
  an aggregation when required, filters, date period, units, and a chart type.
- Start with line, area, bar, scatter, and histogram charts. Only show chart
  types that are meaningful for the selected fields and explain incompatible
  combinations in plain language.
- Provide an immediate preview, sensible automatic labels and units, and the
  option to set a custom title and short description.
- Allow saved charts to be reordered, edited, duplicated, or deleted. A saved
  definition should continue to work when newer XPENG exports are added and
  should clearly identify metrics that are no longer available.
- Store only the compact chart definitions, not duplicated telemetry or
  rendered images. Extend the versioned `.xpeng` manifest so custom charts are
  restored on another device together with the existing history.
- Validate imported chart definitions against an allow-list of datasets,
  fields, aggregations, chart types, series counts, and text-length limits.
  Ignore unsupported definitions safely instead of executing arbitrary code.
- Respect Metric/Imperial and bar/psi preferences at render time so one saved
  chart remains portable between unit settings.
- Keep chart calculation and rendering entirely in the browser, with no
  accounts, uploads, tracking, or server-side storage.
- Add optional selection of saved charts for PDF reports only after the core
  builder, persistence, responsive layout, and accessibility have been
  validated.
- Test chart creation and `.xpeng` round trips with synthetic data, missing
  signals, large histories, mobile layouts, Firefox, Chrome, and Edge.

### Phase 12 — Interactive journey replay

Create an optional local replay mode that reconstructs a selected journey from
the timestamped telemetry already present in the XPENG export. The experience
must be presented as a visual reconstruction, not as an official XPENG vehicle
simulation or a safety-accurate digital twin.

**Status: implemented and owner-validated locally for v2.1; not published.** It
includes a three-month activity calendar, journey selection, telemetry
playback and seeking, 1x/2x/3x/5x/10x speed, a generic animated vehicle,
responsive analytical HUD, synchronized charts, compressed data gaps, and a
timestamp-synchronised GPX map.

- Let the user open a journey and select **Replay journey** without changing
  the underlying analytics or imported data.
- Start with a lightweight, original generic vehicle visual that does not copy
  an XPENG model, logo, interior, or proprietary interface. Evaluate a richer
  3D version only after the responsive 2D or 2.5D prototype performs well on
  desktop and mobile browsers.
- Synchronise the vehicle state with the original timestamps: speed,
  acceleration, braking, accelerator input, steering direction, gear, doors,
  windows, boot, charging state, and other available signals. Hide or clearly
  mark controls for signals that are absent from a particular export.
- Animate doors, windows, and the boot when their observed state changes, and
  use simple motion, lighting, or gauges to communicate acceleration, braking,
  regeneration, speed, and vehicle direction without claiming a physically
  exact simulation.
- Add play, pause, restart, timeline scrubbing, elapsed and recorded time, and
  1x, 2x, 3x, 5x, and 10x playback speeds. Compress long telemetry gaps rather than
  leaving the replay apparently frozen, while showing when a gap was skipped.
- When a matched GPX route exists, synchronise the map marker with the replay
  using the same timestamp-to-position logic introduced for journey charts in
  Phase 10. Retain the visible OpenStreetMap privacy notice.
- Allow the replay to continue without GPS; vehicle telemetry remains the
  authoritative source for the animation and GPS is only used for map
  position.
- Provide an accessible reduced-motion mode and a compact fallback for mobile,
  low-memory devices, browsers without the required graphics capability, and
  users who do not want 3D animation.
- Keep decoding, timeline generation, replay, and GPX synchronisation entirely
  on the user's device. Do not add accounts, telemetry uploads, or a server.
- Add synthetic replay fixtures and automated tests for timing, seeking,
  playback speed, gaps, missing signals, event ordering, and GPX marker
  synchronisation before testing with private real exports.

### Phase 13 — Visual and navigation consolidation

Refresh the information architecture before the v2.1 release so the growing
feature set remains calm and easy to navigate rather than accumulating more
permanent controls in the left sidebar.

**Status: implemented and owner-validated locally for v2.1; not published.** The desktop
navigation is grouped into driving, vehicle, tools, and data areas; the mobile
icon strip has been replaced by a labelled section selector; data import stays
one click away; and theme, language, measurement, and tyre-pressure preferences
now share one accessible settings panel.

- Reduce the permanent width and visual weight of the desktop sidebar while
  retaining clear labels and keyboard-accessible navigation.
- Group related destinations into a small number of understandable areas,
  such as driving, vehicle, tools, and data, without hiding important actions.
- Move secondary preferences such as language, theme, measurement system, and
  tyre-pressure units into one compact settings surface.
- Preserve quick access to data import, Ko-fi, version information, privacy
  state, and issue reporting without letting them compete with analytics.
- Revisit top bars, filters, cards, spacing, and responsive navigation so the
  dashboard feels less dense on laptop and mobile screens.
- Keep the existing visual identity, bilingual wording, light-first theme,
  accessibility, and current analytical behaviour.
- Validate the revised hierarchy at desktop, tablet, and mobile widths before
  including it in the v2.1 release candidate.

### Phase 14 — First-use tutorial and guided onboarding

Add an optional guided introduction after the v2.1 navigation and visual
structure has been finalised. The tutorial should help a first-time user
understand the application without interrupting returning users or collecting
any usage information.

**Status: implemented and owner-validated locally for v2.1; not published.** The guide
is split between the first import screen and the populated dashboard, opens
automatically only for a new user, can be skipped permanently, and can be
restarted from the landing page or Settings. It is bilingual, responsive,
keyboard-accessible, reduced-motion aware, and stores only its local
completion state.

- Offer the tutorial on the first visit and provide clear **Start tutorial**
  and **Skip** actions.
- Explain how to request the XPENG Data Act export, import the first ZIP, and
  understand that all processing happens locally.
- Introduce the main navigation areas and point out where to find journeys,
  charging, battery, tyres, reports, My Charts, replay, and data management.
- Explain how to add later XPENG ZIPs and optional GPX files after the first
  vehicle import.
- Explain the `.xpeng` portable history, local remembered history, privacy
  implications, and the importance of keeping a backup.
- Use short contextual callouts anchored to the real interface instead of a
  long modal or separate manual.
- Let users move forwards and backwards, close the tutorial at any time, and
  restart it later from Help or Settings.
- Remember only the local completion or dismissal preference; do not add
  accounts, analytics, tracking, or a server.
- Provide the complete tutorial in English and European Portuguese, with
  keyboard navigation, visible focus, screen-reader labels, reduced motion,
  and responsive layouts.
- Validate the tour with an empty first-use state and with an existing history
  on desktop and mobile before including it in a release.

### Phase 15 — Optional personal cloud backup

Allow the user to store the portable history in an account they control while
preserving local processing and avoiding an XPENG Analytics backend.

- Use official Google Identity Services and the limited `drive.file` scope.
- Create one visible XPENG Analytics folder and one replaceable `.xpeng`
  backup, with explicit save, restore, disconnect, and session auto-update.
- Keep access tokens in memory and never request a Google password, persist a
  refresh token, or add a client secret to the static site.
- Restore the same history on another computer through the normal validated
  importer.
- Document that the backup is unencrypted and that Google receives it only
  when this optional feature is enabled.
- Validate cancellation, expired authorisation, missing files, quota errors,
  large resumable uploads, and cross-device restore before release.

Status: implemented, owner-validated with multiple Google accounts, and
published in v2.1. The following resilience improvements are planned for the
next iteration:

- Automatically refresh the user's Drive backup after a successful XPENG ZIP,
  GPX, or portable-history import when automatic backup is explicitly enabled.
- Show the Google account in use, the last successful backup time, file size,
  and the complete data-coverage period included in the backup.
- Detect likely gaps between imported XPENG periods and warn that data outside
  XPENG's available export window may no longer be recoverable. Treat this as a
  coverage warning, not proof that vehicle data is missing.
- Keep a small, clearly labelled recovery history, initially limited to the
  latest three successful backups, so an accidental or corrupted replacement
  does not immediately remove the last usable copy.
- Make restoration transparent: show each available backup's creation date,
  coverage, size, and history-format version before the user opens it.
- Investigate optional calendar-month `.xpeng` archives for long histories,
  while retaining one current consolidated backup as the simplest default.
- Preserve original XPENG ZIP source files in the user's Drive as an optional,
  separate archive after the core Phase 17 backup-resilience work has been
  validated. This must remain separate from the processed history, explain its
  additional storage and privacy cost, and never be enabled silently.
- Keep Drive support optional and limited to files created by XPENG Analytics;
  do not request access to the rest of the user's Drive or introduce an
  XPENG Analytics storage backend.

### Phase 16 — Insights and history (v2.2)

Turn a growing multi-month history into useful, understandable observations
without presenting software estimates as official vehicle diagnoses. This
phase combines the selected roadmap ideas: anomaly detection, a coverage
calendar, battery-health history, seasonal comparisons, monthly summaries,
shareable cards, and global search.

**Current status:** complete and owner-validated locally on 2026-10-26. The
data-coverage calendar, battery-health confidence view, personal-baseline
anomaly detection, automatic monthly summary, seasonal comparison, global
search, and privacy-safe shareable cards have passed local automated testing
and production build. Nothing from this phase has been published yet; it will
remain part of the combined next release while further features are developed.

Recommended implementation order:

1. Data-coverage calendar.
2. Battery-health history and confidence.
3. Personal-baseline anomaly detection.
4. Automatic monthly summary.
5. Seasonal comparison.
6. Global search.
7. Privacy-safe shareable cards.

- Add a calendar that shows which days contain journeys, charging, parked
  telemetry, tyre observations, and matched GPS, and makes gaps or partial
  coverage visible without implying that the vehicle was necessarily inactive.
- Add battery-history trends for estimated capacity, relative SOH, charging
  efficiency, temperature, and usable range. Always show the eligible sample
  count, observation period, confidence or data-sufficiency state, and the fact
  that these are software estimates rather than BMS health readings.
- Detect unusual consumption, parked loss, charging efficiency, battery
  temperature, tyre pressure, and journey behaviour primarily against the same
  vehicle's own historical baseline. Explain the comparison and never label an
  observation as a fault or diagnosis.
- Generate a concise monthly summary covering distance, journeys, consumption,
  charging, regeneration, costs when configured, parked use, battery estimates,
  GPS coverage, and notable changes from the preceding comparable period.
- Compare seasons or comparable multi-month periods while accounting for
  distance, temperature availability, driving context, and sample size. Show an
  explicit insufficient-data state instead of forcing a conclusion.
- Add global search across journeys, charging sessions, dates, labels, saved
  charts, reports, and relevant settings, with keyboard access and no external
  indexing or uploaded search data.
- Allow selected insights to be exported as polished image cards. Default cards
  must omit coordinates, route shapes, filenames, exact timestamps, identifiers,
  and other sensitive details unless the user deliberately includes them.
- Create one dedicated **Insights** area for anomaly observations, battery
  history, monthly summaries, and seasonal comparisons. Keep the coverage
  calendar close to Data or Quality, and make cards exportable from the insight
  that generated them.
- Store only compact preferences and generated definitions in `.xpeng`; derive
  observations again from the underlying history so newer imports automatically
  update the results.
- Validate all calculations with synthetic histories containing sparse months,
  missing signals, outliers, different climates, short ownership periods, and
  multiple unit systems before presenting them to users.

### Phase 17 — Backup resilience and long-term data protection

Strengthen the optional Google Drive workflow before the next combined public
release. Keep one current consolidated `.xpeng` backup as the simple default,
while making automatic updates, recovery, coverage, and restoration easier to
understand.

**Current status:** the core resilience work is implemented locally and awaiting
owner validation. The current backup now carries coverage and format metadata;
the app shows the connected account, retains up to three recovery copies,
allows an explicit restore choice, warns about likely import-period gaps, and
retries interrupted resumable uploads. Separate, disabled-by-default archiving
of original XPENG ZIPs and GPX sources is also implemented locally with
hash-based deduplication, download, and deletion controls. Live owner validation
of both Drive source archives is still required. Long-history storage is now
implemented locally in `.xpeng` v7: telemetry is divided into calendar-month
shards, compact summaries remain loaded, and record details are restored only
when requested. Large-history validation in Chrome, Edge, Firefox, and on a
phone is still required before publication.

- Automatically update the Drive backup after a successful XPENG ZIP, GPX, or
  portable-history import only when the user has explicitly enabled automatic
  backup and the current Google session is authorised.
- Show the Google account in use, last successful backup time, file size,
  history-format version, and complete telemetry-coverage period.
- Detect likely gaps between imported XPENG periods and present them as
  coverage warnings, never as proof that the vehicle was inactive or that data
  is missing from the car.
- Keep the latest three successful recovery copies so an accidental or
  corrupted replacement does not immediately remove the last usable history.
- Let the user inspect creation date, coverage, size, and format version before
  restoring a backup.
- Handle cancellation, expired authorisation, quota failures, interrupted
  resumable uploads, missing files, and cross-device restoration with clear
  recoverable states.
- Keep one portable `.xpeng` file while internally indexing independently
  compressed calendar-month shards, so long histories do not require all raw
  telemetry to remain in RAM.
- Add a separate, disabled-by-default **Archive original XPENG exports** option.
  It must never be implied by enabling the normal `.xpeng` backup.
- Upload each selected XPENG ZIP byte for byte to a visible
  `XPENG Analytics/Raw Files` folder. Do not consolidate or rewrite source ZIPs:
  every retained file stays exactly as XPENG supplied it, while `.xpeng`
  remains the compact working history used by the app.
- Calculate a SHA-256 digest locally and use it to skip an original ZIP that is
  already archived. Preserve the original filename and record only the minimum
  app metadata needed to show size, upload date, digest, and known coverage.
- Explain before opt-in that original exports may contain the VIN, complete raw
  telemetry, and other personal vehicle data; that the files are not encrypted
  by XPENG Analytics; and that they consume the user's Google Drive storage.
- List retained originals with clear download and deletion controls. Keep a
  lightweight registry for every imported ZIP inside `.xpeng`; automatically
  move redundant Drive originals to trash only after a replacement uploads,
  preserving continuous coverage with a preferred four-day overlap. Always
  retain sources whose coverage cannot be verified, and never mix originals
  with the three processed-history recovery copies. **Implemented for the
  2.2.0 beta.**
- Keep GPX source archiving behind its own opt-in because it contains precise
  location history. Store recognised `.gpx` files and GPX ZIPs unchanged in a
  separate folder, deduplicate them by importer SHA-256, and never enable it
  silently when the user enables XPENG ZIP preservation. **Implemented
  locally; awaiting owner validation.**
- Preserve the limited `drive.file` permission and access only files created by
  XPENG Analytics. Do not add an application storage backend.

### Phase 18 — Advanced data portability and encrypted history

Add optional power-user tools without complicating the normal ZIP-to-dashboard
workflow. The existing standalone CSV consolidator is a design reference only;
its VDB format and version 3 `.xpeng` writer will not be integrated directly.

- Add a local **Export consolidated CSVs** action in an Advanced tools area for
  users who deliberately want the recognised operation, energy, and status
  streams in a portable tabular form.
- Reuse the current production importer, signal aliases, validation, ordering,
  and deduplication rules rather than maintaining a second parser copied from
  the standalone consolidator.
- Clearly warn that consolidated CSVs can contain VIN and raw telemetry, are
  more sensitive than the normal processed `.xpeng` history, and are intended
  for personal analysis rather than routine application backup.
- Preserve newly encountered columns where safe, report conflicts and skipped
  inputs, and include a small manifest describing the export and its checksums.
- Keep the operation local and worker-based, with bounded-memory or streaming
  generation so large histories remain practical in Firefox and on lower-memory
  devices.
- Research an optional password-encrypted `.xpeng` container using versioned,
  authenticated Web Crypto primitives. Encrypt the current `.xpeng` payload
  itself instead of introducing the separate VDB format.
- Support validation and local restoration of the encrypted container, explain
  that a forgotten password cannot be recovered, and never send or store the
  password, derived key, or plaintext history remotely.
- Treat encrypted Google Drive backup as a later explicit choice. Do not change
  or invalidate existing unencrypted `.xpeng` files or Drive backups.
- Validate round trips, corruption detection, wrong-password handling, large
  histories, and cross-browser compatibility before exposing encryption as a
  stable feature.

### Phase 19 — Native local and offline applications

Package the existing interface as lightweight native desktop applications for
Windows, macOS, and Linux while keeping the browser version available.

- Reuse the current frontend, import worker, metrics, reports, and `.xpeng`
  format instead of creating a second analytics implementation.
- Store the selected history directly on the user's computer and reopen it on
  launch.
- Publish native installers or packages for Windows, macOS, and Linux from the
  same shared codebase and analytics engine.
- Follow each platform's signing, packaging, permissions, and update
  conventions so installation and local file access remain understandable.
- Run without an application backend and without requiring an internet
  connection for vehicle analysis.
- Keep updates optional and publish reproducible, signed release artefacts.

## Pre-release testing

Maintain a separate private staging repository for changes that require
hands-on validation before they reach the public project.

- Mirror only the application source and sanitised test fixtures; never commit
  real XPENG ZIPs, `.xpeng` histories, GPX tracks, VINs, or location data.
- Run the same automated tests, production build, and public-tree audit used by
  the public repository.
- Let the owner validate new imports, metrics, GPS matching, maps, and reports
  before promoting the reviewed commit to the public repository.
- Keep the public repository as the authoritative release history and avoid
  allowing staging-only code to diverge into a separate implementation.
- Treat any hosted staging URL as public unless its access control has been
  explicitly verified; a private GitHub repository does not automatically make
  a GitHub Pages site private.
