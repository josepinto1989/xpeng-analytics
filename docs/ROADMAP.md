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

## Next

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

The first private-staging implementation is available as `1.7.0-beta.1`. It
adds monthly trends and telemetry-block driving-context estimates. Manual
journey and charging labels, tariff profiles, and export summaries remain for
the next Phase 9 iteration.

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

The owner-validated private-staging implementation is available as
`1.8.0-beta.3`. It
supports a unified later-data importer for XPENG ZIPs, GPX and GPX-in-ZIP,
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
  1x, 2x, and 3x playback speeds. Compress long telemetry gaps rather than
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

### Phase 13 — Native local and offline applications

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
