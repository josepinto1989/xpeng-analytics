# XPENG Analytics 2.2.0 — release scope

This document records the combined scope selected for the public release.
Detailed public notes live in `RELEASE_NOTES_2.2.0.md`.

## Completed and owner-validated

- Data-coverage calendar for journeys, charging, parked telemetry, tyres, and
  matched GPS.
- Battery-history trends with eligible sample counts, observation periods, and
  confidence states.
- Personal-baseline observations for unusual consumption, parked loss,
  charging efficiency, battery temperature, tyre pressure, and journey
  behaviour, without presenting them as diagnoses.
- Automatic monthly summaries and comparable seasonal views with honest
  insufficient-data states.
- Global local search across journeys, charging, dates, saved charts, sections,
  and settings, including keyboard access and direct record navigation.
- Privacy-safe PNG cards for selected insights, with sensitive location and
  source details excluded by default.

## Drive and long-history phase

Phase 17 is implemented and included for wider real-world validation. Optional Google
Drive backup now supports explicit automatic updates, visible account and
backup metadata, likely-gap warnings, three recovery copies, transparent
restore selection, and resumable-upload recovery while retaining the limited
`drive.file` permission.

Version 2.2 also preserves original XPENG ZIPs in `Raw Files`, records their
coverage and retention status inside `.xpeng`, and automatically moves
redundant originals to Drive trash while keeping a compact continuous source
set with a preferred four-day overlap.

## Release policy

- Publish this scope as version 2.2.0 while clearly identifying the newest
  functionality as still undergoing wider real-world validation.
- Add every completed feature to the Unreleased changelog as it is validated.
- Continue browser, mobile, Drive, and long-history testing and correct reported
  problems through patch releases.
