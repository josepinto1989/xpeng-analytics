# XPENG Analytics 2.2.2

Version 2.2.2 improves Google Drive source archiving, makes gaps in official
XPENG exports easier to understand, and corrects several usability details.

## Google Drive and original files

- XPENG ZIP and GPX files imported before Drive is enabled remain available in
  the current tab and can be archived later without selecting them again.
- Only the latest processed `.xpeng` backup is retained. Earlier app-created
  recovery copies are moved to Drive trash after a successful replacement.
- Original ZIP retention continues to preserve the smallest practical source
  set with one preferred day of overlap. A longer export can retire short
  exports only when their observed coverage is genuinely included.
- Session and Drive file lists are bounded and scrollable, and imported ZIPs
  show their observed date range.

## Data quality

- Likely missing telemetry is detected when the odometer advances across a
  recording gap. The warning is evidence of a source-data gap, not a vehicle
  diagnosis.
- Journeys also explain that official XPENG exports may omit samples or split a
  drive even when the surrounding journey appears continuous.
- Older histories are reanalysed once when required by the new coverage logic.
  Reimporting the same file after that remains a fast duplicate skip.
- Repeated low-value parser notices are consolidated so Quality focuses on
  actionable observations.

## Navigation and layout

- Manually combined journey names now appear in global search.
- The four sidebar utility actions use a compact icon grid.
- English and Portuguese guidance and the onboarding tutorial have been
  updated for the current Drive and session behaviour.

All processing remains in the browser unless the user explicitly enables the
optional Google Drive features.
