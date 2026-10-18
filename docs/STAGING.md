# Private staging workflow

The private repository `josepinto1989/xpeng-analytics-staging` is used for
hands-on validation before a change is promoted to the public project.

## Rules

- Never commit real XPENG ZIPs, `.xpeng` histories, GPX files, VINs, precise
  locations, or screenshots containing personal information.
- Keep the public repository as the authoritative release history.
- Develop a candidate on a `codex/` branch and push the reviewed commit to the
  private staging repository.
- Run the public-tree audit, Python tests, web tests, and production build before
  asking for owner testing.
- Do not enable GitHub Pages for staging. A private repository does not by
  itself guarantee that a Pages website is private.
- Promote the same reviewed commit or an explicitly reviewed follow-up commit;
  do not reimplement the feature separately in the public repository.

## v2.0.0 final candidate checklist

1. Open the candidate with no stored state and confirm the landing guide can be
   completed, skipped, and restarted.
2. Import a current `.xpeng` v5 history and confirm it opens directly without an
   automatic tutorial. Import a legacy v3 history in a clean profile and confirm
   the new dashboard guide appears once.
3. Confirm Overview, Journeys, Driving, Charging, Battery, Tyres, Activity,
   Trends, Report, My Charts, Replay, Quality, and Data open through the grouped
   navigation and mobile selector.
4. Open Settings and confirm language, theme, Metric/Imperial, bar/psi, and
   guide controls persist as expected.
5. Create and save a personal chart, export `.xpeng`, reset, restore the file,
   and confirm the chart definition and optional matched GPS routes return.
6. Replay a journey with and without GPS. Confirm play/pause/seeking,
   1x/2x/3x/5x/10x, analytical chart cursors, map position, brake indication,
   steering, and available door, window, and boot states.
7. Enable remembered history, refresh, add a later export, verify deduplication,
   then permanently delete the stored history.
8. Generate a PDF with the selected unit system, estimated costs, authorship,
   application URL, and optional route diagrams.
9. Repeat the main navigation, Settings, import, journey, replay, and report
   smoke tests in current Firefox, Chrome, and Edge. Check one mobile browser.
10. Confirm the displayed version is `2.0.0` and that no real ZIP, `.xpeng`, GPX,
    VIN, credential, generated report, or private screenshot is tracked.

## Phase 8 beta checklist

1. Import an XPENG ZIP or `.xpeng` history and confirm the dashboard totals.
2. Open **Data** and enable **Remember this history on this device**.
3. Wait for the saved status and note the displayed size and dates.
4. Refresh or close and reopen the app; the dashboard should restore without a
   file picker.
5. Add a newer ZIP and confirm that duplicate records are ignored and the saved
   date updates only after processing finishes.
6. Enable the local reminder, select 7, 15, 25, and 30 days, and confirm that
   each choice updates the next reminder date.
7. Refresh and confirm that the selected reminder interval remains.
8. Export a portable `.xpeng` backup and verify it still opens normally.
9. Select **Delete saved history**, confirm the warning, refresh, and verify
   that the dashboard is no longer restored automatically.
10. Repeat the key restore and delete checks in Firefox, Chrome, and Edge. Test
   at least one mobile browser separately because mobile storage may be evicted
   more aggressively.

## Phase 10 beta checklist

1. Import the supplied XPENG ZIP and confirm the existing journey totals before
   adding location data.
2. Open **Data**, use the same **Add more data** importer for a later XPENG ZIP,
   an individual GPX, and a ZIP containing several GPX files. Confirm file-type
   detection works through both the picker and drag-and-drop.
3. Check that two recordings of the same drive produce one automatic journey
   map and that the higher-quality recording is selected.
4. Open the matched journey and confirm that the OpenStreetMap background,
   route trace, and attribution appear automatically without a 403 error.
5. Move the pointer across each journey telemetry chart and confirm that the
   highlighted position moves to the corresponding point on the route.
6. Import a continuous GPX containing driving, parked time, and unrelated
   movement. Confirm only the points inside XPENG trip timestamps appear and
   that overlapping Android/iPhone recordings produce one route automatically.
7. Start from a fresh session and repeat the GPX import with 100, 250, or 500
   metres of end trimming; confirm the choice is visible on the route.
8. Generate a PDF first without and then with **Include GPS routes**. Only the
   second report should contain route pages.
9. Export a `.xpeng` history, reset the app, restore that file, and confirm the
   selected route slices, duplicate provenance, traces, and privacy warning are retained.
10. Repeat the core import, map, and history-restore checks in Firefox, Chrome,
    and Edge. No real XPENG or GPX file may be committed to staging.
