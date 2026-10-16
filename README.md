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
browser, or export a portable `.xpeng` backup yourself. Both choices are
explicit and keep the data on your device.

## What you can explore

- Distance, journeys, driving time, consumption, and recovered energy.
- Charging sessions, energy from the grid, efficiency, losses, power, and
  separate AC/DC totals and colours.
- Speed and accelerator distributions, a g-g diagram, dynamic events, and an
  actual-use heatmap.
- Journey-level driving forces, steering, pedal, rear-motor, rotor-temperature,
  and four-tyre telemetry where the export provides those signals. Journey
  charts share a synchronized time cursor for direct comparison.
- Synchronized charging telemetry: hovering any technical charging chart shows
  power, peak power, SOC, voltage, current, and battery temperature for the
  same moment.
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
- Estimated urban-, road-, and motorway-style driving with distance, time,
  energy, regeneration, consumption, and confidence. These categories are
  software estimates and do not identify the actual road.
- Data-quality coverage, signal availability, and gaps in the exported
  telemetry.
- A bilingual PDF report for a selected period, including optional estimated
  electricity costs, AC/DC use, regeneration, peak charging power, and useful
  journey comparisons for company-car or expense reporting.
- Metric or imperial display units and an independent bar/psi tyre-pressure
  selector.
- Optional persistent local history that reopens on the same browser and can
  show an on-device reminder when it is time to add a newer XPENG export.

The interface is available in European Portuguese and English, with light and
dark themes.

## How to use it

1. Request your export from the [XPENG Data Act portal](https://www.xpeng.com/data-act/my-data).
2. Open [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/).
3. Select or drag in one or more XPENG ZIP files. You can also restore a
   `.xpeng` history; if selected together, the history is restored first and
   the ZIP exports are then merged into the same local session.
4. Explore the dashboard, add more exports, create a PDF report, export a
   compact `.xpeng` backup, or explicitly remember the history in this browser.

For detailed instructions, filters, reports, portable histories, units, and
troubleshooting, read the **[English user guide](docs/USER_GUIDE.md)** or the
**[European Portuguese guide](docs/USER_GUIDE.pt-PT.md)**.

A 30-day export normally takes around one minute on a recent computer, although
the exact time depends on available memory, processor, and browser. Firefox,
Chrome, and Edge are tested; other browsers may work but are not currently
verified.

## Private by design

- There is no application server, account, tracking database, or cloud upload.
- Persistent history is disabled by default. When enabled, one unencrypted
  processed history is stored in that browser's private IndexedDB storage and
  can be deleted from the **Data** page.
- Vehicle identifiers are not retained by the fast import engine or included in
  the dashboard snapshot.
- The public repository contains synthetic tests only — never real vehicle
  exports, histories, identifiers, or location data.
- Portable histories are not encrypted. Treat them like the original XPENG
  export and store them somewhere you trust.

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
| [Privacy](PRIVACY.md) | What stays local and how to handle sensitive files |
| [Security](SECURITY.md) | Safe reporting and importer security boundaries |
| [Architecture](docs/ARCHITECTURE.md) | Browser engine, data flow, and portable-history design |
| [`.xpeng` v3 format](docs/XPENG_HISTORY_V3_SPEC.md) | Technical format specification for developers |
| [v1.7.0 beta notes](docs/RELEASE_NOTES_1.7.0-beta.1.md) | Private-staging notes for long-term trends and driving context |
| [v1.6.0 beta notes](docs/RELEASE_NOTES_1.6.0-beta.2.md) | Private-staging notes for persistent local history testing |
| [v1.5.1 release notes](docs/RELEASE_NOTES_1.5.1.md) | Detailed summary of the current release |
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
existing version 1 and 2 history files can still be opened.

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
