# XPENG Analytics 2.0.0

Planned public release: 19 October 2026.

Version 2.0 turns XPENG Analytics from a session-only dashboard into a more
complete, still local-first ownership toolkit. Vehicle exports, processed
history, optional GPS coordinates, saved charts, and reports remain on the
user's device. There is still no XPENG Analytics account, vehicle-data server,
or application telemetry.

## Keep a history locally

Users can explicitly choose **Remember this history on this device**. One
processed history is stored in that browser profile's IndexedDB storage and is
restored on the next visit. The Data page shows the stored size, save date, and
latest import, and provides a permanent delete action.

An optional on-device reminder can be set to 7, 15, 25, or 30 days. It only
appears when the application is opened and never signs in to XPENG or downloads
an export automatically. A separately exported `.xpeng` file remains the
recommended portable backup.

## Long-term analysis

The new Trends area adds monthly views for distance, consumption, indicated
range, estimated capacity, relative SOH, parked use, charging, and tyre
pressure. It also estimates urban-, road-, and motorway-style driving from
short telemetry blocks using speed, sustained movement, stops, acceleration,
and braking. These categories include confidence and are clearly presented as
software estimates, not detected road types or official XPENG data.

## Optional GPS journey maps

After the first XPENG import, the Data page accepts later XPENG ZIPs, GPX files,
and ZIPs containing GPX through the same importer. Recordings are clipped to
XPENG trip timestamps, so an all-day GPX can cover several vehicle journeys
without retaining parked periods, walks, or unrelated movement. When several
recordings cover the same trip, the strongest match is chosen automatically.

Matched journeys show an OpenStreetMap background and a route marker that
follows the synchronized chart cursor. PDF reports can optionally include local
route diagrams. GPX coordinates are sensitive and become part of the
unencrypted `.xpeng` history; opening an online map requests normal tiles for
the viewed area, but the selected GPX file is not uploaded by the application.

## My charts

The new **My charts** workspace lets users build personal charts from supported
journey, charging, battery, tyre, activity, and trend data. It provides guided
field selection, a live preview, relevant filters and grouping, Metric/Imperial
conversion, and line, area, bar, scatter, and histogram views.

Saved definitions can be edited, duplicated, reordered, or deleted. Only the
small validated definition is stored in `.xpeng` version 5; chart images and
duplicate telemetry are not added to the file.

## Interactive journey replay

The replay workspace provides a three-month activity calendar, journey
selection, play, pause, restart, timeline seeking, and 1x, 2x, 3x, 5x, and 10x
playback. Long source gaps are compressed and identified. Analytical charts and
the optional GPX map follow the same recorded timestamp.

A lightweight, original generic vehicle visual reflects the available speed,
power, accelerator, brake, steering, gear, door, window, and boot signals.
Brake lamps follow the recorded brake state. When the export has no lamp
signal, low beams use a visual night-time approximation between 20:00 and 08:00.
The replay remains useful without GPS and is explicitly a reconstruction, not
an official XPENG simulation or safety-accurate digital twin.

## Calmer navigation and first-use help

Desktop navigation is grouped into driving, vehicle, tools, and data areas.
Mobile uses a labelled section selector. Language, light/dark theme,
Metric/Imperial units, bar/psi, and the optional guide now share one settings
panel while Data, Ko-fi, local-state information, and the version remain easy
to reach.

The bilingual first-use guide introduces the XPENG export, local processing,
main workspaces, later ZIP and GPX additions, `.xpeng` backups, and optional
local persistence. It can be skipped, restarted, and used with a keyboard. A
current `.xpeng` history does not trigger it automatically; an older history
can introduce the new 2.0 areas once.

## Portable-history compatibility

New exports use `.xpeng` version 5. The native reader accepts versions 3, 4,
and 5, while the compatibility reader continues to support legacy version 1
JSON.GZ and version 2 SQLite/XZ histories. Version 5 remains compressed,
checksummed, local, portable, and unencrypted.

## Performance and validation

Version 2.0 splits optional workspaces into separate browser chunks, bounds
heavy visual samples, defers expensive journey details, avoids rebuilding
static replay charts, and updates Leaflet markers in place. Large-history modal
and journey interactions were also isolated from unrelated chart rendering.

Automated tests cover translation parity, file selection, persistent history,
onboarding, personal charts, GPX matching, chart-to-map synchronization, replay,
driving personalities, native-history round trips, and the browser runtime. The
release candidate is also built and audited to ensure no real vehicle export,
history, GPX route, VIN, credential, or private report is included.

## Known boundaries

- XPENG does not currently provide a supported API for automatic export
  retrieval, so users still request and select the files themselves.
- Persistent history is limited to one remembered vehicle history per browser
  profile and can be cleared by the browser or operating system.
- GPS matching currently targets timestamped GPX. CSV GPS support and an
  independently licensed offline basemap remain research items.
- Selecting personal charts for inclusion in PDF reports is planned as a later
  improvement and does not block the chart studio.
- Native Windows, macOS, and Linux packages remain a future phase.

XPENG Analytics is an independent community project created and maintained by
Miguel Pinto. It is not affiliated with, endorsed by, or sponsored by XPENG.
