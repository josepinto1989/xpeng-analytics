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
temporary memory. Close or refresh the page and the session is gone, unless
you choose to export a portable `.xpeng` history yourself.

## What you can explore

- Distance, journeys, driving time, consumption, and recovered energy.
- Charging sessions, energy from the grid, efficiency, losses, and power.
- Speed and accelerator distributions, a g-g diagram, dynamic events, and an
  actual-use heatmap.
- Charging schedules and limits when a repeated pattern is visible.
- Calculated range, usable-capacity, relative-SOH, and parked-use estimates.
- XPENG-indicated range, used SOC band, battery temperature spread, and tyre
  pressure trends.
- Daily and monthly activity patterns with custom date ranges.
- Data-quality coverage and gaps in the exported telemetry.
- A bilingual PDF report for a selected period, including optional estimated
  electricity costs for company-car or expense reporting.

The interface is available in European Portuguese and English, with light and
dark themes.

## How to use it

1. Request your export from the [XPENG Data Act portal](https://www.xpeng.com/data-act/my-data).
2. Open [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/).
3. Select or drag in one or more XPENG ZIP files. You can also restore a
   `.xpeng` history; if selected together, the history is restored first and
   the ZIP exports are then merged into the same local session.
4. Explore the dashboard, add more exports, create a PDF report, or save a
   compact `.xpeng` history for next time.

A 30-day export normally takes around one minute on a recent computer, although
the exact time depends on available memory, processor, and browser. Firefox,
Chrome, and Edge are tested; other browsers may work but are not currently
verified.

## Private by design

- There is no application server, account, tracking database, or cloud upload.
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
