# Design QA — Journey Replay analytical workbench

## Evidence

- Source visual truth: private design reference reviewed during implementation;
  the reference image is intentionally not committed.
- Source pixels: 1488 × 1058 PNG.
- Browser-rendered implementation: local production preview reviewed during the
  implementation session; captures containing private test data are
  intentionally not committed.
- Desktop viewport: 1265 × 710 CSS px, device scale 1.
- Mobile viewport: requested 390 × 844 CSS px; browser content measured 375 CSS px wide, with `scrollWidth === clientWidth === 375`.
- State: English, light theme, real imported XPENG journey, replay running and then paused. The available persisted journey did not include a matched GPX route, so the map region was verified in its supported no-route state while the unchanged Leaflet route component remained covered by route-sync tests.
- Primary interactions tested: open Replay, select/start journey, live playback, pause, select 3× and 10×, and seek the timeline.
- Browser console: no warnings or errors after the interaction pass.

## Full-view comparison

The rendered implementation preserves the selected concept's defining composition: a roughly 60/40 map-to-telemetry split, compact row-based live telemetry, a technical top-down vehicle status panel, a full-width event timeline with integrated playback controls, and four synchronized analytical charts below. It intentionally retains the product's existing sidebar and page shell, which the standalone concept image omitted.

The comparison was performed from the source mock and the desktop in-app-browser captures shown in the same design-validation session. A second focused capture covered the event timeline and four-chart workbench.

## Required fidelity surfaces

- Fonts and typography: existing XPENG Analytics type stack retained; hierarchy, compact labels, tabular values, and small chart annotations match the selected analytical direction. No clipping or unintended wrapping was visible.
- Spacing and layout rhythm: the 60/40 upper grid, thin separators, dense telemetry rows, timeline rhythm, and four-column chart grid match the source. Existing application sidebar width is preserved as an intentional shell constraint.
- Colors and visual tokens: existing off-white, navy, mint, violet, cyan, coral, muted text, and hairline tokens are reused consistently. Status and event colors remain semantically distinct.
- Image quality and asset fidelity: the former photorealistic driving scene was removed. A dedicated transparent top-down generic SUV asset is sharp, correctly cropped, brandless, and integrated without a visible raster box.
- Copy and content: English and pt-PT strings are complete and translation parity passes. Labels reflect actual telemetry and clearly separate calculated reconstruction from official vehicle data.

## Focused region comparison

- Telemetry and vehicle status: values align on a disciplined three-column row grid; progress bars are compact and the vehicle/status list remains legible at desktop and mobile widths.
- Event timeline: the playhead, timestamps, five event lanes, event markers, 1×/2×/3×/5×/10× controls, and seek slider remain synchronized and readable.
- Charts: speed, power, pedal positions, and steering each have a dedicated chart with a moving cursor, active data point, and live value synchronized to the map and replay timeline.

## Comparison history

1. Initial implementation finding — P2: at the start of playback, the playhead label overlapped the event labels and the native range control rendered as a heavy dark bar.
   - Fix: split timeline labels from the plotting region, anchored the playhead inside the plot, and added consistent WebKit/Firefox range-track and thumb styling.
   - Post-fix evidence: the second in-app-browser capture shows the `00:01` playhead fully inside the plotting area and a thin muted seek track with a mint thumb.
2. Mobile verification — no horizontal overflow at 375 CSS px; telemetry becomes a vertical reading sequence, the vehicle remains fully visible, and the lower workbench stacks safely.
3. Playback follow-up — added 5× and 10× rates, then strengthened chart synchronization with a visible playhead, active points, and current values. A browser pass confirmed 10× advances the shared replay clock and updates all chart readouts.

## Findings

- No actionable P0, P1, or P2 visual or interaction findings remain.

## Open questions

- None blocking. A future polish pass may use a GPX-backed fixture for a pixel-level comparison of the populated Leaflet map state, but route synchronization and matching are already covered by automated tests.

## Implementation checklist

- [x] Replace the 3D/videogame scene with the selected analytical workbench.
- [x] Integrate real telemetry, vehicle states, event markers, charts, playback rates, and seek behavior.
- [x] Add a brandless technical top-down SUV asset.
- [x] Verify desktop and mobile layouts.
- [x] Run translation parity, replay tests, full test suite, and production build.

## Follow-up polish

- P3: consider adding hover descriptions to event marker types if user testing shows that the color legend alone is insufficient.

final result: passed
