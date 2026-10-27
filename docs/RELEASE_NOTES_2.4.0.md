# XPENG Analytics 2.4.0

Version 2.4 turns the existing vehicle history into a more useful personal and
company-car record, extends GPS compatibility, and makes long-term Google Drive
backups safer to upgrade.

## Ownership, labels, and costs

- Classify journeys as personal, business, commute, or a custom label.
- Categorize charging as home, work, public, or custom.
- Create reusable flat electricity tariffs and calculate estimated charging
  cost by session, period, distance, and category.
- Keep classifications and tariffs in exported, remembered, and Drive-backed
  `.xpeng` histories.
- Search classified records and include them in CSV and PDF reports.

Estimated costs are analytical values, not invoices, receipts, or fiscal
documents.

## Reports and GPS

- Select saved My Charts, monthly summaries, and Lifetime Highlights for local
  PDF reports with predictable page breaks.
- Export compact labelled-journey and categorized-charging CSV summaries.
- Import recognised GPS CSV files directly or from ZIP archives, alongside
  existing GPX support.
- See clearer diagnostics for partial GPS matches, sparse recordings, and
  likely clock differences.
- Compare software-estimated urban, road, and motorway-style activity without
  claiming an official road classification.

## Safer Drive history refresh

New histories use portable format version 8. When an older Google Drive backup
is opened and the retained RAW exports cover its complete period, the app can
recalculate it locally with the current engine after explicit confirmation.

The refresh:

- verifies continuous source coverage rather than checking only the first and
  last file;
- downloads and processes one source at a time to reduce peak memory use;
- preserves journey groups, labels, tariffs, saved charts, and GPS routes;
- uploads the replacement only after the rebuild succeeds; and
- shows real upload progress with a warning not to close the tab.

Opening without refreshing remains available. If complete RAW coverage is not
available, the existing history can still be opened normally.

## Reliability and accessibility

- Resumable uploads no longer assume an unacknowledged chunk was accepted.
- Drive and worker errors clear the busy state so the interface remains usable.
- The landing page now reaches full Lighthouse accessibility, best-practices,
  and SEO scores in the local release audit.

All analysis remains browser-based. Google Drive remains optional and uses the
limited `drive.file` permission for files created by XPENG Analytics.
