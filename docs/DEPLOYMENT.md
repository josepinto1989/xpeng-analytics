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

No backend, hosted database, analytics, telemetry, or vehicle-data upload is
part of this deployment.
