# Publication checklist

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

