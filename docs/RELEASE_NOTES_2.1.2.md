# XPENG Analytics 2.1.2

Released: 20 October 2026.

Version 2.1.2 improves how optional GPX recordings are preserved while XPENG
vehicle exports are still delayed. It does not change the `.xpeng` file format
and remains compatible with existing version 5 histories.

## Recent unmatched GPX recordings

A GPX recording made today may not yet have matching vehicle telemetry because
the newest XPENG export can lag behind. Complete unmatched recordings now stay
inside the portable `.xpeng` history while they end within five days of the
newest imported vehicle data, including recordings newer than that data.

When a later XPENG ZIP is added, XPENG Analytics automatically retries route
matching. A retained GPX can then become the map for the corresponding journey
without being imported again.

## Controlled retention

The retention boundary follows the newest imported vehicle timestamp rather
than the computer clock. Once XPENG telemetry has advanced more than five days
beyond a recording that still has no matching journey, its coordinates are
omitted from the next `.xpeng` export. Lightweight import provenance remains
available for data-quality context.

Matched journey maps continue to store only their relevant route slices for
display, while a recent complete source recording may temporarily coexist so
future journeys from the same GPX can still be matched.

## Compatibility and privacy

The existing version 5 GPS block schema already supports unmatched records, so
no history migration is required. GPX timestamps and coordinates remain
sensitive, local data. Portable histories are compressed but not encrypted and
should be protected accordingly.
