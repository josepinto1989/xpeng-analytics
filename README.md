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
- Calculated range, usable-capacity, relative-SOH, and parked-use estimates.
- Daily and monthly activity patterns with custom date ranges.
- Data-quality coverage and gaps in the exported telemetry.
- A bilingual PDF report for a selected period, including optional estimated
  electricity costs for company-car or expense reporting.

The interface is available in European Portuguese and English, with light and
dark themes.

## How to use it

1. Request your export from the [XPENG Data Act portal](https://www.xpeng.com/data-act/my-data).
2. Open [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/).
3. Select the XPENG ZIP file and keep the tab open while it is processed.
4. Explore the dashboard, add more exports, create a PDF report, or save a
   compact `.xpeng` history for next time.

A 30-day export can take several minutes to process depending on the computer
and browser. Firefox, Chrome, and Edge are tested; other browsers may work but
are not currently verified.

## Private by design

- There is no application server, account, tracking database, or cloud upload.
- Vehicle identifiers are pseudonymised with a random key created locally.
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

The browser processor is assembled from the audited Python source during the
build. The analytics core itself has no runtime dependencies outside Python's
standard library.

## Contributing

Bug reports and thoughtful improvements are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) first and never attach real XPENG exports,
portable histories, VINs, locations, or screenshots containing personal data.

The project roadmap lives in [docs/ROADMAP.md](docs/ROADMAP.md), and public
changes are recorded in [CHANGELOG.md](CHANGELOG.md).

Built and maintained by **Miguel Pinto** as an independent community project.
XPENG Analytics is not affiliated with, endorsed by, or sponsored by XPeng
Inc. XPENG is a trademark of its respective owner.

Released under the [MIT Licence](LICENSE).
