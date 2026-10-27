# XPENG Analytics 2.2.0

This release combines the recent long-history, insight, journey, and Google
Drive work. Some of the newest functionality is still being validated with a
wider variety of vehicles, browsers, and real export histories; bug reports are
welcome.

## Long histories without loading everything

Portable `.xpeng` histories now use independently compressed monthly blocks.
The dashboard keeps summaries and record indexes ready, while detailed journey,
charging, map, and replay telemetry is loaded only for the selected month. Older
history versions are migrated locally when opened.

## Smarter original-file preservation

When original XPENG ZIP archiving is enabled, untouched exports are stored in
`XPENG Analytics/Raw Files` in the user's Google Drive. The app records each
source in the `.xpeng` history and keeps the smallest practical collection of
original files that spans the complete observed period, preferring four days of
overlap. Exact duplicates are skipped. Replaced files go to Drive trash rather
than being permanently deleted.

The original ZIP contents are never consolidated or rewritten. Exports without
reliable coverage metadata are retained automatically.

## Other new features

- personal Insights, monthly summaries, seasonal comparisons, and data coverage;
- battery trends and confidence information;
- global local search and privacy-safe insight cards;
- manual groups for journeys that belong to the same outing;
- richer Google Drive backup metadata and three recovery copies;
- resumable Drive uploads and clearer gap, quota, and authorisation states;
- original GPX preservation as a separate opt-in option;
- `.xpeng` version 7 with lazy monthly detail loading.

## Testing note

Please keep a separate copy of important source exports while the newest
functionality is being validated. The Raw Files feature moves redundant files
to Google Drive trash, so they can still be recovered if the retained coverage
is not what you expected. Please report any unexpected behaviour.
