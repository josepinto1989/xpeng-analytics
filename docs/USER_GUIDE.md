# XPENG Analytics user guide

> [European Portuguese version](USER_GUIDE.pt-PT.md)

XPENG Analytics turns an XPENG Data Act export into a private dashboard inside
your browser. There is no application account or vehicle-data server. Your
files are processed on your computer and remain in the current browser tab.

## 1. Before you start

You need:

- an XPENG Data Act ZIP export, a previously saved `.xpeng` history, or both;
- a recent version of Firefox, Chrome, or Edge;
- enough free memory for the period you want to analyse.

Other browsers may work but are not currently verified. A 30-day export usually
loads in around one minute on a recent computer, although file size, processor,
memory, and browser all affect the result.

Phones and tablets use a lower-memory import profile but retain the same data,
metrics, and charts as the desktop version. Mobile browsers may take longer on
large exports and should remain in the foreground while processing.

## 2. Request your XPENG export

1. Open the [XPENG Data Act portal](https://www.xpeng.com/data-act/my-data).
2. Request your vehicle-data export.
3. Download the ZIP when XPENG makes it available.
4. Keep the ZIP private. It may reveal travel times, charging behaviour, and
   other sensitive information.

You do not need to extract or modify the ZIP.

## 3. Import data

Open [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/) and
either:

- drag one or more XPENG ZIP files onto the large import area; or
- click the import area and select the files.

You can select several ZIP exports at once. The first completed file produces a
usable dashboard immediately; totals and charts are updated after each
additional file is merged.

Duplicate archives are detected from their content and are not imported twice.
Overlapping timestamps are merged, with the newer import taking precedence.

### Importing a `.xpeng` history

The same start-page importer recognises `.xpeng` histories automatically. If a
history and ZIP files are selected together, the history is restored first and
the ZIP files are then added to that local session.

Only one history can be selected at a time. Histories are not encrypted, so
only open files you trust.

## 4. During processing

The progress bar shows the current phase and file. Keep the browser tab open
until processing finishes. You can cancel an active import; information already
accepted into the current session remains available.

Closing or refreshing the page clears the session. XPENG Analytics does not
silently store it in browser storage.

## 5. Navigate the dashboard

### Overview

Shows the main distance, consumption, driving-time, charging, and energy-flow
totals. Recent journeys and charging sessions are clickable and open the exact
record in its detailed section.

### Journeys

Lists journeys from newest to oldest. Select one to inspect its segments,
consumption, speed, power, SOC, displayed range, temperature, driving forces,
pedal inputs, motor behaviour, and tyre signals when present in the export.

Hovering a journey chart synchronises the same elapsed time across the other
journey charts. This makes it possible to compare speed, power, SOC, force, and
temperature at one moment.

### Driving

Summarises regeneration, moving time, strong acceleration, braking and
cornering, speed distribution, accelerator use, and observed dynamic events.
The driving profile is a software estimate, not an official XPENG value or a
safety assessment.

### Charging

Shows battery and grid energy, efficiency, duration, power, estimated losses,
charging habits, and separate AC/DC totals. Select a session to inspect its
technical telemetry.

The four technical charging charts share one time cursor. Hover any chart to
see power, peak power, SOC, voltage, current, and battery temperature for the
same elapsed minute.

### Battery

Contains calculated range, estimated usable capacity, relative SOH, SOC and
temperature observations, charging efficiency, and parked-energy use. Capacity,
SOH, range, and loss figures are observational estimates and are not official
BMS readings.

### Tyres

Shows the four-tyre daily pressure trend and the left-to-right imbalance on each
axle. Use the sidebar selector to display pressure in bar or psi.

### Activity

Provides the actual-use heatmap, daily energy and consumption, monthly distance
and journey totals, weekday activity, start times, and charging activity.

### Trends

Aggregates the selected period by month for distance, consumption, indicated
range, estimated capacity, relative SOH, parked use, charging, and tyre
pressure. A month may contain only part of that month's data, so compare months
with coverage in mind.

The same page estimates urban-, road-, and motorway-style driving from short
telemetry blocks. It displays distance, time, energy used, regenerated energy,
consumption, and confidence. This is a software estimate based on speed, stops,
acceleration, and braking. It does not use GPS or identify the actual road.

### Report

Creates a local PDF for a selected date range. The report includes distance,
consumption, journeys, charging, AC/DC energy, regeneration, useful period
comparisons, and detailed daily and charging tables.

You may enter:

- an average electricity price to calculate estimated charging costs; and
- a reference such as a driver, company, or cost centre.

The PDF is an analytical summary, not an invoice, receipt, tax document, or
official XPENG report.

### Quality

Explains which signal families and fields were available in the imported files
and flags unusual or incomplete observations. Warnings describe data quality;
they do not diagnose the vehicle.

### Data

Adds more XPENG ZIPs, replaces the session from a portable history, exports the
current session, displays imported-file history, or clears the session. It also
contains the optional persistent-history controls.

## 6. Filters and display settings

Most analytical pages support 7 days, 15 days, 30 days, all data, or a custom
date range.

The top-right controls switch between English and European Portuguese and
between light and dark themes. The sidebar controls switch:

- Metric and Imperial distance, speed, consumption, and temperature units;
- tyre pressure independently between bar and psi.

The selected units are also used in newly generated PDF reports.

## 7. Save your session as `.xpeng`

Open **Data** and choose **Export history**. The resulting `.xpeng` file stores
the processed columnar history so it can usually be restored faster and more
compactly than rebuilding the same session from several ZIP files.

The file:

- remains on your computer unless you move or upload it;
- supports adding future XPENG ZIP exports after restoration;
- contains checksums for corruption detection;
- is compressed but **not encrypted**.

Treat it with the same care as the original XPENG export.

### Remember the history in this browser

Open **Data** and enable **Remember this history on this device**. This option
is off by default. Once enabled, the application creates the same processed
`.xpeng` payload and stores one copy in the browser's private IndexedDB
storage. It is reopened automatically on the next visit from that browser
profile, and successful ZIP additions replace the saved copy after
deduplication.

The Data page shows the saved size, last save, and last import. You can also
enable a local reminder and choose an interval of 7, 15, 25, or 30 days. The
calculated next reminder date is shown beside the interval. The reminder does
not access the XPENG account or download anything automatically.

Use **Delete saved history** to erase the stored copy. Because browsers and
operating systems may clear local storage, keep an exported `.xpeng` file as a
portable backup.

## 8. Troubleshooting

### Import appears slow

- Keep the tab visible and wait for the current file or phase to complete.
- Close memory-heavy applications or unused browser tabs.
- Try the latest Firefox, Chrome, or Edge version.
- Import fewer ZIP files in one selection, then add the remaining files from
  **Data**.

### A chart is empty

Not every XPENG export contains every signal. Check **Quality** for signal
availability and try a longer date range.

### A file is reported as already imported

The archive content is already present in the session. This is intentional and
prevents duplicate totals.

### Times do not match another person's dashboard

Time-based summaries use the timezone reported by the current browser. No
fixed Lisbon timezone is applied.

### The page was refreshed and the data disappeared

Without persistent local history this is the expected privacy model. Import the
original ZIPs again, restore a saved `.xpeng` history, or enable **Remember this
history on this device** from the Data page for future visits.

## 9. Privacy, support, and feedback

Never attach a real XPENG ZIP, `.xpeng` history, VIN, location, or unredacted
screenshot to a public issue.

- [Report a bug or request a feature](https://github.com/josepinto1989/xpeng-analytics/issues)
- [Read the privacy notes](../PRIVACY.md)
- [Read the security guidance](../SECURITY.md)
- [Support the project on Ko-fi](https://ko-fi.com/mpinto)

XPENG Analytics is an independent community project created and maintained by
Miguel Pinto. It is not affiliated with, endorsed by, or sponsored by XPENG.
