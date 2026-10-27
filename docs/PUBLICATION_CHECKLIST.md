# Publication checklist

## v2.3.0 — 2026-10-27

- [x] Odometer-gap alerts display date, interval, and affected distance.
- [x] Quality alerts are collapsed initially and can be dismissed, cleared,
  and restored without modifying imported telemetry.
- [x] Personal observations can be marked as seen and restored.
- [x] Monthly summaries include daily movement and AC/DC charging charts.
- [x] Charging history supports All, AC, and DC filters with distinct colours.
- [x] Driving-context rows include average consumption.
- [x] Google Drive backup status includes date and time, and the revised guide
  targets the current desktop and mobile interface.
- [x] Lifetime Highlights and the local PNG export include only observed or
  explicitly unavailable records; 0–100 is never inferred from an incomplete run.
- [x] Translation parity, browser tests, production build, public-tree audit,
  and documentation were reviewed before publication.
- [ ] GitHub Quality and Pages workflows, deployed version, and `v2.3.0` tag
  verified after publication.

## v2.2.2 — 2026-10-27

- [x] Imported XPENG ZIP and GPX originals remain available to Drive archiving
  for the lifetime of the current browser tab, even when Drive is enabled later.
- [x] Google Drive keeps one current processed `.xpeng` backup and moves older
  app-created recovery copies to trash after a successful replacement.
- [x] Raw Files retention, one-day overlap, conservative unknown-coverage
  handling, and retirement of fully covered short exports have automated tests.
- [x] Likely XPENG telemetry omissions are detected from odometer movement
  across recording gaps and are clearly described as source-data warnings.
- [x] Older histories are reanalysed once, routine parser cleanup no longer
  overwhelms Quality, and manually combined journey names are searchable.
- [x] Session and Drive lists remain bounded and scrollable, with observed date
  ranges shown for imported sources.
- [x] English and Portuguese text, documentation, tests, and production build
  were reviewed locally before publication.
- [x] Public Quality and GitHub Pages workflows completed successfully; the
  deployed bundle and `v2.2.2` tag were verified on 2026-10-27.

## v2.2.1 — 2026-10-27

- [x] Raw Files retention prefers one day of overlap while continuity remains
  more important than the overlap target.
- [x] The next successful original ZIP import re-evaluates existing managed
  Drive files and records retained and retired states in `.xpeng`.
- [x] Unknown-coverage originals remain preserved and redundant files still go
  to Drive trash rather than being permanently deleted.
- [x] English and Portuguese UI text, user documentation, privacy notes,
  architecture notes, changelog, and release notes describe the new policy.
- [x] Complete browser tests and the production build pass locally.
- [x] Public Quality and Pages workflows, displayed version, and `v2.2.1` tag
  were verified after publication on 2026-10-27.

## v2.2.0 — 2026-10-27

- [x] Data-coverage calendar passed owner testing with real history.
- [x] Battery-history confidence, personal-baseline anomaly observations,
  monthly summaries, and seasonal comparisons passed owner testing.
- [x] Global search and direct navigation passed owner testing.
- [x] Privacy-safe insight-card export passed owner testing.
- [x] Synthetic browser tests and the production build pass locally.
- [x] README, English and Portuguese user guides, roadmap, and changelog
  describe the completed local work.
- [x] Original XPENG ZIPs remain byte-identical in `Raw Files`; duplicate,
  overlap-selection, conservative unknown-coverage, trash, and `.xpeng`
  registry behaviour have automated tests.
- [x] Version number and release notes are prepared.
- [ ] Repeat Chrome, Firefox, Edge, mobile, large-history, import/export,
  Google Drive, PDF, GPX, replay, and `.xpeng` compatibility smoke tests.
- [x] Public-tree privacy audit, Python tests, complete browser tests, and the
  production build pass locally.
- [x] The owner explicitly approved direct public publication.
- [x] GitHub Quality and Pages workflows completed successfully; the public
  bundle was verified on 2026-10-27. The final `v2.2.0` tag replaces the
  short-lived prerelease tag.

## v2.1.3 patch release — 2026-10-21

- [x] The sidebar shows the earliest and latest timestamps across all available
  vehicle telemetry families beneath the XPENG Analytics logo.
- [x] Dates use compact Portuguese or unambiguous English formatting and update
  immediately when the language or imported data changes.
- [x] Mobile navigation displays the same coverage range without hiding the
  section selector.
- [x] Browser tests, translation parity, Python tests, public-tree audit, and
  the production build pass for version 2.1.3.
- [x] The reviewed commit and annotated `v2.1.3` tag are published on the
  public repository.
- [x] Public Quality and GitHub Pages workflows completed successfully, and the
  deployed site displays version 2.1.3 on 2026-10-21.

## v2.1.2 patch release — 2026-10-20

- [x] Complete recent GPX recordings without a matching XPENG journey remain
  available in portable histories for delayed vehicle data.
- [x] Retained recordings are matched automatically after a later XPENG ZIP is
  imported, with no manual route selection.
- [x] Old unmatched coordinates are pruned after vehicle telemetry advances
  more than five days beyond them, while lightweight provenance remains.
- [x] Existing matched route slices and `.xpeng` v5 histories remain compatible.
- [x] Python tests, browser tests, public-tree audit, production build, and
  release documentation pass for version 2.1.2.
- [x] The reviewed commit and annotated `v2.1.2` tag are published on the
  public repository.
- [x] Public Quality and GitHub Pages workflows completed successfully, and the
  deployed site displays version 2.1.2 on 2026-10-20.

## v2.1.1 patch release — 2026-10-19

- [x] Journey chart axes and tooltips show the recorded local clock time.
- [x] Technical highlights appear above the journey map.
- [x] Journey charts, map, metrics, and spacing use the reviewed compact layout.
- [x] The journey-specific responsive rules do not change other dashboard pages.
- [x] Python tests, browser tests, translation parity, public-tree audit, and
  the production build pass.
- [x] Version, README, release notes, changelog, and publication checklist are
  updated for 2.1.1.
- [x] The reviewed commit and annotated `v2.1.1` tag are published on the
  public repository.
- [x] Public Quality and GitHub Pages workflows completed successfully, and the
  deployed site displays version 2.1.1 on 2026-10-19.

## v2.1.0 release candidate — 2026-10-18

- [x] Persistent local history and 7-, 15-, 25-, and 30-day reminders passed
  owner testing.
- [x] Trends, driving-context estimates, automatic GPX matching, maps, chart
  synchronization, PDF route traces, and `.xpeng` restoration passed owner
  testing.
- [x] My Charts creation, editing, reordering, deletion, unit conversion, and
  `.xpeng` v5 round trip passed owner testing.
- [x] Journey replay, GPS and no-GPS layouts, seeking, playback speeds, charts,
  vehicle states, lights, steering, and driving-personality interaction passed
  owner testing.
- [x] Consolidated navigation, Settings, desktop/mobile layouts, and the
  bilingual first-use guide passed owner testing.
- [x] Current `.xpeng` histories skip automatic onboarding; legacy histories
  can introduce the new 2.0 areas once.
- [x] Public-tree privacy audit, Python tests, browser tests, translation parity,
  and production build pass on the final candidate.
- [x] README, user guides, privacy, security, architecture, roadmap, `.xpeng`
  specification, release notes, notices, and changelog reflect version 2.1.0.
- [x] A public OAuth privacy page exists at `/privacy.html`, is linked from
  both application footers, and explains Google Drive access, storage, sharing,
  revocation, and deletion.
- [x] The public About page explains the project's purpose, capabilities,
  independent status, and local-first data model.
- [x] Google Drive client tests cover authorisation, folder discovery/creation,
  resumable upload, backup discovery, and download with mocked APIs.
- [x] Real Google OAuth save, update, account switching, disconnect, and restore
  are owner-tested on the registered local origin.
- [ ] Real Google OAuth save and restore are smoke-tested on the deployed
  GitHub Pages origin.
- [x] The reviewed candidate is committed and pushed only to private staging.
- [x] A final production-build smoke test is complete; staging Pages remains
  intentionally disabled because a private repository does not make Pages
  private.
- [x] The exact reviewed commit is approved for public promotion.
- [x] The public GitHub release, tag, Pages deployment, and displayed version
  are verified after publication on 2026-10-18.

## v1.8.0-beta.3 private staging — 2026-10-16

- [x] Synthetic GPX parsing, trip-level matching, duplicate rejection, trimming, and v4
  history round-trip tests pass.
- [x] The supplied Android and iPhone GPX files were compared without being
  copied into the repository.
- [x] Real browser flow covers XPENG ZIP import, unified GPX ZIP import,
  automatic journey routes and reset, PDF route trace, `.xpeng` export, and restore.
- [x] PDF rendering was visually inspected with no clipping or overlap.
- [x] OpenStreetMap attribution is configured, the browser sends the required
  origin referrer, and only tiles for an opened mapped journey are requested.
- [x] README, both user guides, privacy, security, architecture, roadmap,
  format specification, release notes, notices, and changelog are updated.
- [ ] Owner testing in Firefox, Chrome, and Edge is complete.
- [ ] The private-staging commit is explicitly approved for public promotion.

## v1.5.0 release candidate — 2026-10-14

- [x] Public-tree privacy audit passes.
- [x] Python tests, browser tests, and production build pass.
- [x] English and PT-PT translation keys match.
- [x] README, user guides, privacy, security, architecture, roadmap, and
  changelog reflect the release.
- [x] Documentation links resolve to tracked files or intended public URLs.
- [x] Five-file Firefox import remains progressive and completes without the
  v1.5.0 pre-release slowdown.
- [x] Charging and journey synchronized tooltips work with real telemetry.
- [x] Metric/Imperial and bar/psi controls update the relevant values.
- [x] A PDF is generated and visually checked in both unit systems.
- [x] No real export, portable history, generated PDF, or private screenshot is
  tracked.
- [ ] Firefox, Chrome, and Edge smoke tests are complete.
- [ ] GitHub Pages deployment and the public version number are verified after
  publishing.

## v1.0.0 release — 2026-10-11

Completed for the v1.0.0 public release on 2026-10-11.

- [x] `python scripts/audit_public_tree.py` passes.
- [x] `python -m unittest discover -s tests -v` passes.
- [x] `git status --short` contains only intentional source files.
- [x] `git log --all --stat` contains no imported private history.
- [x] No real archive, database, snapshot, key, environment file, or report is tracked.
- [x] No email address, account name, private hostname, token, or credential is tracked.
- [x] Tests use only generated synthetic data.
- [x] PT-PT and English contain the same translation keys and complete flows.
- [x] The privacy promise matches actual browser network behaviour.
- [x] Browser developer tools show no vehicle-data request during import.
- [x] The release clearly states that the project is independent and unofficial.
- [x] GitHub Pages uses GitHub Actions as its deployment source.
- [x] The deployed URL opens in Firefox, Chrome, and Edge.
- [x] The public issue form rejects reports that include real vehicle data.

