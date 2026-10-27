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

### Adding optional GPS routes

The initial screen accepts XPENG exports and portable histories. After the
XPENG dashboard opens, go to **Data > Add more data**. This single importer
accepts later XPENG Data Act ZIPs, several `.gpx` files, or ZIPs containing GPX
files, either through the file picker or drag-and-drop. GPX 1.1 exports from
BasicAirData GPS Logger on Android and Open GPX Tracker on iPhone are the first
tested references; compatible GPX files from other applications should also
work when they contain timestamps and coordinates.

Before importing, you can optionally remove the first and last 100, 250, or
500 metres of every matched route. No trimming is applied by default. The app
clips recordings to exact XPENG trip timestamps and compares time coverage,
distance, speed, and recording quality. This means one all-day GPX can cover
several car trips while parked intervals, walks, and other movement are
excluded from the route shown for each journey. If two phones recorded the same
trip, the stronger route is selected automatically; no manual file management
is required.

XPENG exports can be delayed by a day. A complete GPX recording that does not
yet match a journey is therefore kept in the `.xpeng` history while its end is
within five days of the newest imported vehicle telemetry, or when it is newer
than that telemetry. Adding a later XPENG ZIP automatically retries the match.
Once vehicle telemetry has moved more than five days beyond an unmatched
recording, its coordinates are left out of the next history export.

GPS processing stays on the device. Coordinates are sensitive and become part
of the unencrypted `.xpeng` history. Protect that file accordingly.

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

Choose **Combine journeys** when XPENG has split one outing into separate
journeys. Select at least two journeys and optionally name the group. The new
group replaces those journeys only in the top-level list: use its tabs to
analyse the combined outing or any original journey individually. **Edit** can
change its name or members, and **Ungroup** removes only the definition, never
the underlying telemetry.

Stops between the selected journeys remain visible in the combined duration.
Any charging session whose timestamps overlap an intermediate stop is attached
to that stop. Consumption and driving energy still use only the original
driving segments, so charging is not treated as negative consumption. Group
definitions are retained in exported, locally saved, and Google Drive `.xpeng`
histories.

Use the classification control to mark a journey as personal, business,
commute, or a custom label. Classifications do not alter the original XPENG
telemetry and remain available in search, reports, CSV exports, and future
`.xpeng` restores.

The selected journey uses stacked full-width charts. Its journey list remains
available while the detail area is open, making it quicker to compare records.

Hovering a journey chart synchronises the same elapsed time across the other
journey charts. This makes it possible to compare speed, power, SOC, force, and
temperature at one moment.

When a GPX route is matched, the journey shows it over an OpenStreetMap
background. Opening that journey sends normal tile requests for the viewed
area to the tile provider, but does not upload the GPX file. The map retains
visible OpenStreetMap attribution. Move the pointer across any journey chart to
highlight the temporally corresponding position on the route.

### Driving

Summarises regeneration, moving time, strong acceleration, braking and
cornering, speed distribution, accelerator use, and observed dynamic events.
The driving profile is a software estimate, not an official XPENG value or a
safety assessment.

### Charging

Shows battery and grid energy, efficiency, duration, power, estimated losses,
charging habits, and separate AC/DC totals. Select a session to inspect its
technical telemetry. The history list can be filtered to All, AC, or DC;
distinct colours make the charging type visible before opening a session.

Charging sessions can also be categorized as home, work, public, or custom.
When a reusable electricity tariff is active, the app estimates charging cost
from the available energy. This is not an invoice or receipt.

Charging telemetry also uses stacked full-width charts while the session list
remains available for quick comparison between charges.

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

### Insights

Turns a longer history into four local analytical views:

- personal-baseline observations for unusual consumption, parked loss,
  charging efficiency, battery temperature, tyre pressure, or journey
  behaviour;
- battery-history trends with the eligible sample count, observation period,
  and a visible data-confidence state;
- an automatic monthly summary with comparisons against the preceding
  comparable month, including daily movement and AC/DC charging charts; and
- seasonal comparisons that show an explicit insufficient-data state when the
  available periods are not comparable.

These observations are software comparisons, not fault diagnoses or official
BMS health readings. Selected summaries, seasonal comparisons, and anomaly
observations can be saved as privacy-safe PNG cards. The default image excludes
coordinates, route shapes, filenames, exact timestamps, and internal IDs.
Use **OK** to hide an observation that has been reviewed. **Show everything
again** restores hidden observations; this preference does not remove data.

### Lifetime Highlights

Opens a fullscreen view of the best records observed across the complete
available history: top speed, peak drive power in kW and hp, longest journey
by distance and time, acceleration/braking/cornering forces, charging power,
and regenerated energy. An observed 0–100 km/h time is shown only when one
continuous acceleration from almost stationary to 100 km/h exists in the
telemetry. Use **Save image** to create a local PNG summary.

### Coverage calendar and global search

The coverage calendar shows which dates contain journeys, charging, parked
telemetry, tyre observations, or matched GPS. A blank or partial day describes
only the imported history and does not prove that the vehicle was inactive.

Open global search from the interface or press `Ctrl+K` (`Cmd+K` on macOS).
Search for journeys, charging sessions, dates, saved charts, sections, or
settings. Use the arrow keys and Enter to open a result directly. Press `/` to
open search when focus is not inside a text field.

### Visual replay

Shows the dates with recorded journeys in a calendar. Choose a date and journey,
then start a local visual reconstruction with play, pause, restart, timeline
seeking, and 1x, 2x, 3x, 5x, or 10x speed. The HUD and synchronized charts
follow available speed, power, pedal, battery, steering, gear, door, and boot
observations. Missing signals are not presented as measured states.

The replay also includes one minute immediately before and after the moving
part of the trip when that telemetry exists. This captures events such as
opening a door or the boot just before departure or just after arrival. Boot
opening and closing phases and active window movement are shown from their
recorded state codes; they are not inferred as precise opening percentages.

When the journey has a matched GPX route, the map marker follows the replay by
timestamp. Without GPX, the journey can still be replayed from XPENG telemetry.
Long gaps in the source data are shortened and identified. The vehicle is an
original generic 2.5D visual, not an XPENG model or a safety-accurate simulator.
Its front wheels follow the observed steering direction and its brake lamps use
the recorded brake signal. Because the export does not currently expose a
lighting signal, low beams are a visual approximation between 20:00 and 08:00.
On mobile the same data is available in a lighter, vertically stacked layout.

### My charts

Builds personal visualisations from the information already processed in the
browser. Choose a data group, chart type, horizontal axis, up to three metrics,
date period, and optional daily or monthly grouping. The preview updates while
you edit. Line, area, bar, scatter, and histogram charts are available when the
selected fields support them.

Saved charts can be edited, duplicated, reordered, or deleted. Metric/Imperial
and bar/psi choices are applied when the chart is rendered. Only the compact
chart definition is stored in an exported `.xpeng`; no chart image or duplicate
telemetry is added. If a definition references a metric absent from a future
history, the chart remains saved and shows a clear unavailable-data message.

### Report

Creates a local PDF for a selected date range. The report includes distance,
consumption, journeys, charging, AC/DC energy, regeneration, useful period
comparisons, and detailed daily and charging tables.

You may enter:

- an average electricity price to calculate estimated charging costs; and
- a reference such as a driver, company, or cost centre.

You can also include selected saved My Charts, monthly summaries, and Lifetime
Highlights, or export a compact CSV with labelled journeys and categorized
charging sessions.

If journeys in the selected period have matched GPX data, you may also include
their route traces in the PDF. These diagrams are composed locally and do not
download an online basemap.

The PDF is an analytical summary, not an invoice, receipt, tax document, or
official XPENG report.

### Quality

Explains which signal families and fields were available in the imported files
and flags unusual or incomplete observations. Warnings describe data quality;
they do not diagnose the vehicle. Quality alerts start collapsed. Odometer-gap
alerts include their date, time interval, and affected distance. Alerts can be
dismissed individually, cleared together, and restored later without deleting
or changing the vehicle history.

### Data

Adds more XPENG ZIPs and GPX routes through one importer, reviews the automatic
GPS matching summary, replaces the session from a portable history, exports
the current session, displays
imported-file history, or clears the session. It also contains the optional
persistent-history controls.

Recognised GPS CSV files can be imported directly or inside a ZIP. Matching is
still automatic and based on timestamps; diagnostics identify partial matches,
sparse tracks, and likely clock differences.

## 6. Filters and display settings

Most analytical pages support 7 days, 15 days, 30 days, all data, or a custom
date range.

Open **Settings** from the lower part of the desktop sidebar or the dashboard
header on smaller screens. The same panel controls:

- Metric and Imperial distance, speed, consumption, and temperature units;
- tyre pressure independently between bar and psi.

The selected units are also used in newly generated PDF reports.

### First-use guide

On a first visit, the optional guide explains the XPENG export, local
processing, and the main dashboard areas. It can be skipped and restarted from
**Settings** at any time. A current `.xpeng` history does not interrupt a
returning user; a legacy history may introduce the new 2.0 areas once. Only the
local completion or dismissal choice is stored.

## 7. Save your session as `.xpeng`

Open **Data** and choose **Export history**. The resulting `.xpeng` file stores
the processed columnar history so it can usually be restored faster and more
compactly than rebuilding the same session from several ZIP files.

The file:

- remains on your computer unless you move or upload it;
- supports adding future XPENG ZIP exports after restoration;
- contains checksums for corruption detection;
- preserves automatically matched GPS route slices and recent complete GPX
  recordings that are still waiting for delayed XPENG data;
- preserves validated personal chart definitions;
- is compressed but **not encrypted**.

Current histories use monthly internal blocks. Dashboard totals, trends, and
the journey/charging indexes open from compact summaries; detailed charts,
maps, and replay telemetry are loaded only when you select the corresponding
record. Older `.xpeng` versions are migrated locally the first time they are
opened and the next export uses this long-history layout.

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

### Optional Google Drive backup

Open **Data → Google Drive backup** and choose **Connect Google Drive**. The
Google window handles account selection; XPENG Analytics never asks for or sees
your password. Choose **Save to Drive** to create the current
`xpeng-analytics-history.xpeng` file in a visible **XPENG Analytics** folder in
your Drive. The page shows the connected account, last successful save, file
size, included telemetry period, and portable-history format.

You can enable **Update automatically while connected**. Successful XPENG/GPX
imports and saved My Charts then update the backup during that browser session.
Google may require a new authorisation after the tab closes or the token
expires. Disconnecting ends the current connection but does not delete the
files from Drive. The app keeps only the latest processed `.xpeng` backup. The
restore panel lets you inspect its date, size, coverage, and format before
opening it. Recovery copies created by earlier releases are moved to Drive
trash after the next successful save.

Interrupted resumable uploads are probed and continued when Google reports a
recoverable position. Quota, rate-limit, expired-authorisation, and missing-file
errors remain explicit instead of being reported as a successful save.

When an older Drive backup is opened, the app may offer to refresh it for the
latest calculations. The rebuild requires explicit approval, verifies
continuous RAW coverage, processes sources one at a time, preserves personal
metadata and GPS, and replaces the Drive backup only after success. You may
instead open the existing history without refreshing it.

The Data page may also highlight long breaks between the coverage periods of
imported XPENG files. These are **likely import gaps**, not proof that vehicle
data is missing or that the car was inactive.

The official export itself can also omit telemetry or split a journey. The
Quality page flags likely cases where the odometer advanced across a recording
gap. This is evidence of incomplete delivered coverage, not a vehicle fault.

Drive backup is optional. Processing still happens locally, but the resulting
`.xpeng` files are uploaded to and stored by Google when you enable it. They
are compressed, not encrypted, and can contain timestamped telemetry and GPS
coordinates. Protect them like the original XPENG export.

#### Archive the original XPENG ZIPs

After connecting Drive, you can separately enable **Archive original XPENG
ZIPs**. Every ZIP that is successfully recognised as an XPENG export is then
copied unchanged to `XPENG Analytics/Raw Files`. The app uses the ZIP's SHA-256
digest to skip an identical file that is already archived.

If you import ZIPs before connecting Drive, their original files remain queued
for the active tab session. Connecting Drive and enabling source archiving can
therefore upload them without a second import. Closing or refreshing the tab
clears that temporary queue.

This is not the same as the `.xpeng` backup. The `.xpeng` file is the compact
working history used by the app; an original ZIP may contain the VIN and all raw
telemetry supplied by XPENG. Original ZIPs are unencrypted and consume your
Drive storage. The app keeps the smallest practical set spanning the complete
observed period, preferring one day of overlap. A redundant original is moved
to Drive trash only after its replacement has uploaded, and its provenance
remains recorded in `.xpeng`. Files without reliable coverage are always kept.

**Also archive GPX source files** is a second, independent option. It preserves
successfully recognised `.gpx` files and GPX ZIPs unchanged in
`XPENG Analytics/Original GPX files`, with the same hash-based duplicate check.
GPX originals may include precise locations outside matched journeys, so
enabling the XPENG ZIP option never enables this location archive automatically.

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

### Google Drive asks me to connect again

This is expected. The static app keeps the short-lived Google access token only
in the current tab's memory. Connect again, then save or open the backup. If the
button is unavailable in a local build, the developer must configure the public
Google OAuth client ID described in `GOOGLE_DRIVE_SETUP.md`.

## 9. Privacy, support, and feedback

Never attach a real XPENG ZIP, `.xpeng` history, VIN, location, or unredacted
screenshot to a public issue.

- [Report a bug or request a feature](https://github.com/josepinto1989/xpeng-analytics/issues)
- [Read the privacy notes](../PRIVACY.md)
- [Read the security guidance](../SECURITY.md)
- [Support the project on Ko-fi](https://ko-fi.com/mpinto)

XPENG Analytics is an independent community project created and maintained by
Miguel Pinto. It is not affiliated with, endorsed by, or sponsored by XPENG.
