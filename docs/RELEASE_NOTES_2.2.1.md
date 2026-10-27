# XPENG Analytics 2.2.1

Version 2.2.1 reduces the preferred overlap between original XPENG ZIP files
preserved in Google Drive from four days to one day.

The application still prioritises complete observed coverage. If a one-day
overlap is unavailable, it falls back to the files needed to avoid a gap.
Originals whose coverage cannot be verified are preserved automatically.

For existing users, the next successful XPENG ZIP archive operation reviews
all managed files already present in `XPENG Analytics/Raw Files`. Files that
become redundant under the new policy are moved to Google Drive trash and can
still be recovered. The retained and retired states are written to the
portable `.xpeng` archive registry before the updated history is saved.

No original ZIP is rewritten or consolidated.
