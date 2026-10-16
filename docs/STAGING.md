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
