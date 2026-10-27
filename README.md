<p align="center">
  <img src="web/public/assets/xpeng-analytics-mark-minimal.png" width="88" alt="XPENG Analytics logo">
</p>

<h1 align="center">XPENG Analytics</h1>

<p align="center">
  Turn your XPENG Data Act export into useful, private vehicle insights.<br>
  Everything runs locally in your browser.
</p>

<p align="center">
  <a href="https://josepinto1989.github.io/xpeng-analytics/"><img alt="Open XPENG Analytics" src="https://img.shields.io/badge/open_the_app-00a87e?style=for-the-badge"></a>
  <a href="https://github.com/josepinto1989/xpeng-analytics/tags"><img alt="Latest version" src="https://img.shields.io/github/v/tag/josepinto1989/xpeng-analytics?sort=semver&style=for-the-badge&color=163a3a"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/josepinto1989/xpeng-analytics?style=for-the-badge&color=667f7d"></a>
</p>

<p align="center">
  <a href="https://josepinto1989.github.io/xpeng-analytics/"><strong>Try it in your browser</strong></a>
  ·
  <a href="docs/USER_GUIDE.md">User guide</a>
  ·
  <a href="https://github.com/josepinto1989/xpeng-analytics/issues">Report a problem</a>
  ·
  <a href="https://ko-fi.com/mpinto">Support the project</a>
</p>

## Why this exists

XPENG's Data Act export contains a surprising amount of useful information,
but it is not easy to explore. I built XPENG Analytics to turn that export
into something understandable without asking owners to upload their driving
history to somebody else's server.

The ZIP file is processed in your browser and kept in the current tab's
temporary memory. You can optionally remember one processed history in that
browser, export a portable `.xpeng` backup yourself, or explicitly save that
backup in your own Google Drive. Processing remains local; Drive is an optional
storage destination controlled by the user.

## What you can explore

- Distance, journeys, driving time, consumption, and recovered energy.
- Charging sessions, energy from the grid, efficiency, losses, power, and
  separate AC/DC totals and colours.
- Speed and accelerator distributions, a g-g diagram, dynamic events, and an
  actual-use heatmap.
- Journey-level driving forces, steering, pedal, rear-motor, rotor-temperature,
  and four-tyre telemetry where the export provides those signals. Journey
  charts share a synchronized time cursor for direct comparison.
- Non-destructive manual journey groups for outings that XPENG split into
  separate journeys. Analyse the complete group or each original segment, with
  charging sessions detected during intermediate stops.
- Synchronized charging telemetry: hovering any technical charging chart shows
  power, peak power, SOC, voltage, current, and battery temperature for the
  same moment.
- Full-width stacked journey and charging detail charts, with synchronized time
  inspection and a record list that remains available while comparing sessions.
- An estimated driving profile derived from accelerator, speed, and g-force
  patterns, clearly labelled as an unofficial software estimate.
- Charging schedules and limits when a repeated pattern is visible.
- Calculated range, usable-capacity, relative-SOH, and parked-use estimates.
- Real-world versus XPENG-indicated range, used SOC band, and battery
  temperature spread.
- A dedicated tyre area with full-scale pressure trends and left-to-right axle
  imbalance.
- Daily and monthly activity patterns with custom date ranges.
- Long-term monthly trends for consumption, range, estimated battery health,
  parked use, charging, and tyre pressure.
- A data-coverage calendar that distinguishes days containing journeys,
  charging, parked telemetry, tyre observations, and matched GPS.
- A dedicated Insights area with personal-baseline anomaly observations,
  battery-history confidence, automatic monthly summaries, and seasonal
  comparisons. Monthly summaries include compact distance, consumption, and
  AC/DC charging charts. Observations can be marked as seen and restored;
  calculated observations remain separate from official XPENG or BMS readings.
- A fullscreen Lifetime Highlights view with the strongest records found in
  the available history, including top speed, peak drive power in kW and hp,
  longest journeys, measured g-forces, and an observed 0–100 km/h result when
  the telemetry contains one complete acceleration. The view exports a local
  PNG card for sharing.
- Local global search across journeys, charging sessions, dates, saved charts,
  sections, and settings, with keyboard access and direct navigation.
- Privacy-safe PNG cards for selected insights. Default cards omit route
  coordinates, filenames, exact timestamps, and internal identifiers.
- Estimated urban-, road-, and motorway-style driving with distance, time,
  energy, regeneration, consumption, and confidence. These categories are
  software estimates and do not identify the actual road.
- Data-quality coverage, signal availability, and gaps in the exported
  telemetry. Odometer-gap alerts include their date and affected distance and
  can be dismissed, cleared, or restored without removing any vehicle data.
- A bilingual PDF report for a selected period, including optional estimated
  electricity costs, AC/DC use, regeneration, peak charging power, and useful
  journey comparisons for company-car or expense reporting.
- Metric or imperial display units and an independent bar/psi tyre-pressure
  selector.
- Optional persistent local history that reopens on the same browser and can
  show an on-device reminder when it is time to add a newer XPENG export.
- Optional Google Drive backup using Google's official sign-in and the limited
  `drive.file` permission. It creates one visible XPENG Analytics folder,
  supports restore on another computer, can update the backup while the
  current tab remains connected, and keeps only the latest processed history.
- Optional preservation of untouched XPENG source ZIPs in the Drive
  `Raw Files` folder. The `.xpeng` history records every source while Drive
  keeps the smallest practical set of originals spanning the observed period,
  with a preferred one-day overlap; replaced files are moved to Drive trash.
- Optional GPX route import from Android or iPhone, automatic trip-level
  timestamp matching, duplicate selection, and an OpenStreetMap journey map. Moving
  across any journey chart also highlights the corresponding route position.
- Optional local route traces in PDF reports. Matched routes and recent GPX
  recordings awaiting delayed XPENG data are preserved in the portable
  `.xpeng` history, then matched automatically after a later import.
- A local journey replay with a lightweight chase-camera view, synchronized
  speed, pedals, steering, brake indication, available door and boot signals,
  compact live telemetry, and the current GPX position.
- A personal chart studio for building, previewing, saving, reordering, and
  restoring custom charts without duplicating telemetry.
- A compact, grouped navigation system with one settings panel for language,
  theme, measurement system, tyre-pressure units, and the optional guide.
- A bilingual first-use guide that introduces imports and the main dashboard
  without accounts, analytics, or remote state.

The interface is available in European Portuguese and English, with light and
dark themes.

## How to use it

1. Request your export from the [XPENG Data Act portal](https://www.xpeng.com/data-act/my-data).
2. Open [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/).
3. Select or drag in one or more XPENG ZIP files. You can also restore a
   `.xpeng` history; if selected together, the history is restored first and
   the ZIP exports are then merged into the same local session.
4. Explore the dashboard, add more exports, create a PDF report, export a
   compact `.xpeng` backup, explicitly remember the history in this browser,
   or save it to your own Google Drive.
5. Optionally open **Data** and use the same importer to add later XPENG ZIPs,
   individual GPX files, or ZIPs containing GPX. XPENG Analytics clips
   continuous recordings to the exact trip times and chooses duplicate routes
   automatically.

For detailed instructions, filters, reports, portable histories, units, and
troubleshooting, read the **[English user guide](docs/USER_GUIDE.md)** or the
**[European Portuguese guide](docs/USER_GUIDE.pt-PT.md)**.

A 30-day export normally takes around one minute on a recent computer, although
the exact time depends on available memory, processor, and browser. Firefox,
Chrome, and Edge are tested; other browsers may work but are not currently
verified.

## Private by design

- There is no XPENG Analytics application server, account, or tracking
  database. Google Drive upload is optional, explicit, and goes directly from
  the browser to the user's Google account.
- Persistent history is disabled by default. When enabled, one unencrypted
  processed history is stored in that browser's private IndexedDB storage and
  can be deleted from the **Data** page.
- Vehicle identifiers are not retained by the fast import engine or included in
  the dashboard snapshot.
- The public repository contains synthetic tests only — never real vehicle
  exports, histories, identifiers, or location data.
- Portable histories are not encrypted. Treat them like the original XPENG
  export and store them somewhere you trust.
- Google access tokens remain in memory and are not stored by the application.
  The optional Drive backup is still an unencrypted `.xpeng` file and is
  governed by the user's Google account and Drive settings.
- GPX import is optional. When used, precise route coordinates become part of
  the unencrypted `.xpeng` history. Opening a mapped journey loads its
  OpenStreetMap background and sends ordinary tile requests for the viewed
  area; the GPX file itself is not uploaded.

Battery capacity, SOH, range, charging losses, and costs are calculated
estimates derived from the available telemetry. They are not official BMS
readings, invoices, receipts, or fiscal documents.

Read the full [privacy notes](PRIVACY.md), [security guidance](SECURITY.md), and
[technical architecture](docs/ARCHITECTURE.md).

## Documentation

| Document | Purpose |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Complete English instructions for using the application |
| [User guide — European Portuguese](docs/USER_GUIDE.pt-PT.md) | Complete instructions in European Portuguese |
| [About the project](web/public/about.html) | Why XPENG Analytics exists and what it is designed to do |
| [Privacy](PRIVACY.md) | What stays local and how to handle sensitive files |
| [Security](SECURITY.md) | Safe reporting and importer security boundaries |
| [Architecture](docs/ARCHITECTURE.md) | Browser engine, data flow, and portable-history design |
| [Segmented `.xpeng` v7–v8 format](docs/XPENG_HISTORY_V7_SPEC.md) | Long-history shards, ownership metadata, lazy detail loading, compatibility, and integrity checks |
| [v2.4.0 release notes](docs/RELEASE_NOTES_2.4.0.md) | Labels, tariffs, report exports, GPS CSV, and safe Drive history refresh |
| [v2.3.0 release notes](docs/RELEASE_NOTES_2.3.0.md) | Lifetime highlights, manageable observations, monthly charts, and charging filters |
| [v2.2.2 release notes](docs/RELEASE_NOTES_2.2.2.md) | Session source cache, latest-only Drive backup, telemetry-gap detection, and quality/search corrections |
| [v2.2.1 release notes](docs/RELEASE_NOTES_2.2.1.md) | One-day Raw Files overlap and automatic re-evaluation on the next ZIP import |
| [v2.2.0 release notes](docs/RELEASE_NOTES_2.2.0.md) | Long histories, Insights, Drive recovery, and Raw Files retention |
| [v2.1.3 release notes](docs/RELEASE_NOTES_2.1.3.md) | Always-visible vehicle-data coverage dates |
| [v2.1.2 release notes](docs/RELEASE_NOTES_2.1.2.md) | Retention and later matching of recent GPX recordings |
| [v2.1.1 release notes](docs/RELEASE_NOTES_2.1.1.md) | Journey timeline and compact-layout corrections |
| [v2.1.0 release notes](docs/RELEASE_NOTES_2.1.0.md) | Complete summary of the 2.1 release |
| [Google Drive setup](docs/GOOGLE_DRIVE_SETUP.md) | OAuth configuration and release validation |
| [v1.8.0 beta notes](docs/RELEASE_NOTES_1.8.0-beta.3.md) | Private-staging notes for automatic GPX matching and journey maps |
| [v1.7.0 beta notes](docs/RELEASE_NOTES_1.7.0-beta.1.md) | Private-staging notes for long-term trends and driving context |
| [v1.6.0 beta notes](docs/RELEASE_NOTES_1.6.0-beta.2.md) | Private-staging notes for persistent local history testing |
| [v1.5.1 release notes](docs/RELEASE_NOTES_1.5.1.md) | Historical notes for the mobile import update |
| [Deployment](docs/DEPLOYMENT.md) | GitHub Pages build and deployment notes |
| [Private staging](docs/STAGING.md) | Safety rules and the pre-release owner test checklist |
| [Contributing](CONTRIBUTING.md) | How to propose a safe change |
| [Changelog](CHANGELOG.md) | User-visible changes by version |

## Run it locally

You need Python 3.11+, Node.js 22+, and pnpm.

```shell
git clone https://github.com/josepinto1989/xpeng-analytics.git
cd xpeng-analytics/web
pnpm install --frozen-lockfile
pnpm dev
```

The normal import path is a dedicated JavaScript Web Worker that streams the
ZIP, keeps the required signals in typed columns, and computes the dashboard in
memory. The earlier Python/WebAssembly processor remains bundled only so that
existing version 1 and 2 history files can still be opened. The native reader
accepts versions 3 through 8; new exports use segmented version 8.

## Open-source acknowledgement

The fast import architecture was inspired by
[LogbooX](https://github.com/schliflo/logboox), created by Florian
Schlittenbauer. Thank you for making the approach public and for authorising
its use here. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the MIT
licence notice.

## Contributing

Bug reports and thoughtful improvements are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) first and never attach real XPENG exports,
portable histories, VINs, locations, or screenshots containing personal data.

The project roadmap lives in [docs/ROADMAP.md](docs/ROADMAP.md), and public
changes are recorded in [CHANGELOG.md](CHANGELOG.md).

Built and maintained by **Miguel Pinto** as an independent community project.
XPENG Analytics is not affiliated with, endorsed by, or sponsored by XPeng
Inc. XPENG is a trademark of its respective owner.

Released under the [MIT Licence](LICENSE). Third-party acknowledgements are
listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
