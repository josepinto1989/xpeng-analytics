# Roadmap

## Completed

### Phase 1 — Public-project foundation

Create an isolated, sanitised repository without copying private history or
real vehicle data.

### Phase 2 — Bilingual local-first interface

Build the browser interface in European Portuguese and English, with clear
privacy messaging and no application server.

### Phase 3 — Import and portable history

Process XPENG Data Act ZIP exports locally, deduplicate records, add more data
to the active session, and export or restore a versioned portable history.

### Phase 4 — Detailed analytics

Deliver overview, journeys, charging, battery observations, activity, quality,
and data-management views at the level of detail established by the private
reference project, using only information available in XPENG exports.

### Phase 5 — Public-release preparation

Add privacy and security documentation, synthetic automated tests, public-tree
auditing, GitHub Actions, GitHub Pages deployment, and a privacy-safe issue
form.

### Phase 6 — v1.0.0 release validation

Validate the deployed application in Firefox, Chrome, and Edge; complete a
real 30-day import; verify populated battery charts; export and restore a
JSON.GZ history; and publish the first stable release.

## Next

### Phase 7 — User acceptance and operational improvements

This phase is intentionally driven by real use after v1.0.0.

Phase 7 cycles through v1.5.0 delivered custom date ranges, expanded charging,
battery, parked-use, driving, tyres, and activity views, the smaller streaming
`.xpeng` v3 history format, fast progressive multi-ZIP imports, synchronized
journey and charging charts, Metric/Imperial and bar/psi controls, detailed
signal availability, and richer local PDF usage and cost reports. Phase 7
remains open for real-world feedback and incremental operational improvements.

- Test imports from different XPENG export periods and models.
- Compare representative totals with the source export and the private
  reference dashboard.
- Record browser version, import size, duration, and the exact failing step.
- Report reproducible bugs through GitHub Issues without attaching vehicle
  exports, histories, VINs, locations, or screenshots containing personal data.
- Improve long-running progress messages so expensive steps never look frozen.
- Collect feedback on the local PDF report from company-car and expense-report
  workflows.
- Triage compatibility, accessibility, memory use, and performance issues.
- Keep dependencies and browser runtimes current through reviewed patch or
  minor releases.
- Promote fixes only after automated tests and a clean public-tree audit pass.

Phase 7 has no fixed end date. It is the operating cycle for testing, feedback,
maintenance, and incremental releases.
