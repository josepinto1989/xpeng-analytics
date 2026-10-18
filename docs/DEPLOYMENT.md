# GitHub Pages deployment

The site is built and deployed by `.github/workflows/pages.yml` whenever the
`main` branch changes. The workflow audits the public tree, runs the Python and
browser tests, builds the static application, and deploys only `web/dist`.

## One-time repository setting

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as
the source. A successful workflow publishes the project at:

`https://josepinto1989.github.io/xpeng-analytics/`

The Vite build uses relative asset paths, so the application and its Web Worker
remain functional below the repository subpath.

No backend, hosted database, analytics, or telemetry is part of this
deployment. Optional Google Drive backup communicates directly between the
browser and Google's APIs after user authorisation.

## Google Drive build configuration

Create an Actions repository variable named `GOOGLE_CLIENT_ID`. The Pages
workflow exposes it only as the public `VITE_GOOGLE_CLIENT_ID` build value. The
OAuth client must list `https://josepinto1989.github.io` as an authorised
JavaScript origin and the Drive API and consent screen must be enabled. See
[`GOOGLE_DRIVE_SETUP.md`](GOOGLE_DRIVE_SETUP.md). Never add a client secret.
