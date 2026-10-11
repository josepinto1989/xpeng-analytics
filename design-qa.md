# Design QA

- Source visual truth: `C:\Users\seque\AppData\Local\Temp\codex-clipboard-84886386-b19c-4549-bb0c-7afa1462a9ac.png` and `C:\Users\seque\AppData\Local\Temp\codex-clipboard-f95ccd4e-8d03-4afc-8372-96cc2bc9d94e.png`
- Implementation: `http://127.0.0.1:4174/`
- Implementation screenshot evidence: inline Chrome DevTools captures from page 9 (landing, loading at 18%, overview, battery and parked-consumption region)
- Viewport: 1390 × 1000 CSS px, device scale factor 1
- Source pixels: 1390 × 1079 (annotated landing) and 856 × 466 (blank-chart crop)
- Implementation pixels: 1390 px wide full-page landing capture and 1390 × 1000 viewport captures
- State: light theme; idle landing, XPENG ZIP import, overview with 30-day data, and battery view
- Density normalization: 1× browser captures; browser chrome excluded from implementation comparison

## Full-view comparison evidence

The marked “Private by design” eyebrow is absent. The landing hierarchy, two-column privacy/import layout and established light visual system remain intact. The new project mark occupies the former XA slot without changing the brand lockup dimensions. The processing-time notice and Ko-fi support block extend the page below the original primary task rather than displacing it.

The import state was captured at 18% with the percentage as the dominant label, the progress bar directly below it and the changing phase text on its own line. The same progress component is used above the dashboard while additional files or histories are processed.

## Focused-region comparison evidence

The blank parked-consumption reference was compared with the same battery region using the supplied 30-day archive. The implementation now filters invalid/null observations and renders 13 measurable daily-loss observations as bars. If no valid observations exist, the chart is replaced with an explanatory empty state rather than empty axes.

## Findings

- No actionable P0, P1 or P2 differences remain for the requested annotations.
- P3: the generated mark contains fine internal detail that may simplify further in a future dedicated brand pass, but it remains legible at the current 42 px application size and loads correctly in both themes.

## Required fidelity surfaces

- Fonts and typography: existing system family, hierarchy, weights and wrapping preserved; percentage uses the existing metric weight.
- Spacing and layout rhythm: original card grid and content width preserved; new alert and support card use the established spacing scale.
- Colors and tokens: existing mint, evergreen, amber warning and light/dark tokens reused.
- Image quality and asset fidelity: original transparent PNG project mark generated for the product; no third-party automotive logo reused.
- Copy and content: PT-PT and English parity verified; owner and Ko-fi destination shown consistently.

## Interaction and runtime checks

- Theme toggle tested: light default and dark option work.
- Ko-fi links: two landing links and persistent dashboard/footer link point to `https://ko-fi.com/mpinto`.
- 30-day import tested: 3,426,417 rows, 126 trips, 69 journeys, 11 charges.
- Loading state captured at 18%; dashboard rendered after completion.
- Browser console checked: no errors or warnings.
- Production build, translation parity, browser runtime and Python pipeline tests passed.

## Comparison history

1. P1 source issue: progress state did not foreground percentage or separate the current phase. Fixed with a percentage-first progress component and verified at 18% during a real import.
2. P1 source issue: parked-consumption chart displayed empty axes. Fixed by filtering usable observations and adding an explicit empty state; post-fix capture shows populated bars from the supplied archive.
3. P2 source issue: placeholder XA mark and incomplete ownership/support attribution. Fixed with an original project mark, owner credit and Ko-fi CTAs; verified in landing and dashboard captures.

## Implementation checklist

- [x] Remove annotated eyebrow.
- [x] Show percentage, bar and changing phase during processing.
- [x] Add long-processing notice.
- [x] Replace XA with original project mark and favicon.
- [x] Add Miguel Pinto owner credit and Ko-fi links.
- [x] Prevent blank parked-consumption charts.
- [x] Verify with the supplied 30-day archive.

final result: passed
