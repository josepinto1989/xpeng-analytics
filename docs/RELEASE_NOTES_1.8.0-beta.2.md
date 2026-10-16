# XPENG Analytics 1.8.0-beta.2

This private-staging update improves the Phase 10 journey-map experience. It is
not yet a public release.

## Map loading

- Removed the OpenStreetMap show/hide control. The background now loads
  automatically when the selected journey has a matched GPX route.
- Fixed the OpenStreetMap 403 response by replacing the restrictive
  `no-referrer` policy with `strict-origin-when-cross-origin`, allowing the
  origin referrer required for website tile requests.
- Kept visible OpenStreetMap attribution and requests only the tiles needed for
  the currently viewed route.
- Added a clear fallback message if the background tiles do not respond; the
  GPX line remains available.

## Chart and route synchronisation

- Hovering the speed, power, battery, temperature, driving-force, pedal,
  rear-motor, or tyre-pressure chart now selects its active telemetry timestamp.
- The route map finds the closest GPX timestamp and displays a highlighted
  marker at that position.
- Marker tracking is limited to one update per animation frame and uses an
  indexed timestamp lookup, avoiding a complete journey re-render for every
  pointer movement.
- Existing cross-chart tooltip synchronisation remains active.

## Privacy

Opening a journey with a route now makes ordinary OpenStreetMap tile requests
automatically. Those requests reveal the viewed map area and standard
connection metadata to the tile service. The GPX file and XPENG telemetry are
not uploaded; matching and timestamp synchronisation remain in the browser.
