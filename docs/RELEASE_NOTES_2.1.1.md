# XPENG Analytics 2.1.1

Released: 19 October 2026.

Version 2.1.1 is a focused correction release for the journey-detail view.
It does not change the `.xpeng` history format or require users to export their
data again.

## Journey timeline

Journey telemetry charts now use the actual local clock time on the horizontal
axis and in tooltip headings. This makes it easier to relate speed, power,
battery, pedal, force, motor, and tyre data to the time at which each sample
was recorded. Synchronized chart and map inspection continues to use the same
underlying telemetry timestamp.

## More compact journey details

The journey-detail panels use less vertical space, with shorter charts, tighter
panel spacing, a slightly more compact map, and denser summary metrics.
**Technical highlights** now appear before the route map. Mobile retains a
separate responsive chart and map height so controls and labels remain usable.

## Compatibility

This release remains fully compatible with existing XPENG Data Act ZIPs, GPX
imports, Google Drive backups, and `.xpeng` histories supported by version 2.1.
