# XPENG Analytics 1.7.0-beta.1

This private-staging beta starts roadmap Phase 9 with long-term trends and
estimated driving context.

## Trends page

The new **Trends** page aggregates the selected period by month and displays:

- distance and distance-weighted average consumption;
- XPENG-indicated range inferred at 100%;
- estimated usable capacity and relative SOH;
- observed parked power and median parked loss;
- grid and battery charging energy; and
- median tyre pressure.

Partial months are deliberately identified by their month without pretending
that every month has equal data coverage.

## Estimated driving context

Driving telemetry is divided into short blocks. Each block is scored from its
sustained speed pattern, stops, acceleration, and braking, then assigned an
urban-, road-, or motorway-style estimate. The dashboard shows distance, time,
energy used, regenerated energy, average consumption, and confidence for each
category.

These categories are software estimates. They do not use GPS, do not identify
the actual road, are not supplied by XPENG, and should not be treated as an
official or safety-related classification.

Current version 3 `.xpeng` histories contain the retained telemetry required
to recalculate these metrics. Older histories without the new derived fields
receive a visibly conservative, low-confidence trip-level fallback.

## Still planned in Phase 9

- personal and business journey labels;
- home, work, and public charging labels;
- optional tariff profiles and richer cost summaries; and
- PDF or CSV summaries that include those manual labels.
