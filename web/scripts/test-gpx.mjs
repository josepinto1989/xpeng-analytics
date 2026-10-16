import assert from "node:assert/strict";
import { emptyState, exportHistory, importGps, importHistory, isNativeHistory } from "../src/engine/native-engine.js";
import { gpsSnapshot, parseGpxText, setGpsAssignment } from "../src/engine/gpx.js";

const start = Date.parse("2026-10-15T07:23:00Z") / 1000;
function fixture({ creator = "BasicAirData GPS Logger", interval = 1, offset = 0 } = {}) {
  const points = [];
  for (let index = 0; index <= 180; index += interval) {
    const timestamp = new Date((start + index + offset) * 1000).toISOString();
    points.push(`<trkpt lat="38.${700000 + index}" lon="-9.${100000 + index}"><ele>${100 + index / 10}</ele><time>${timestamp}</time></trkpt>`);
  }
  return `<?xml version="1.0"?><gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Test</name><trkseg>${points.join("")}</trkseg></trk></gpx>`;
}

const android = parseGpxText(fixture(), { sourceName: "android.gpx", sourceSha256: "a".repeat(64) });
const iphone = parseGpxText(fixture({ creator: "Open GPX Tracker", interval: 4, offset: 2 }), { sourceName: "iphone.gpx", sourceSha256: "b".repeat(64) });
assert.equal(android.length, 1);
assert.equal(android[0].stats.points, 181);
assert.ok(Number.isNaN(android[0].speedMps[0]), "missing GPX speed must stay unavailable");
assert.equal(iphone[0].creator, "Open GPX Tracker");

const journeys = [{ journeyId: "journey-1", startedAtUtc: new Date(start * 1000).toISOString(), endedAtUtc: new Date((start + 180) * 1000).toISOString(), distanceKm: android[0].stats.distanceKm }];
const matched = gpsSnapshot([...iphone, ...android], journeys);
assert.equal(matched.gps.matchedCount, 1);
assert.equal(matched.journeys[0].gps.sourceName, "android.gpx", "the more complete duplicate track should win");
assert.equal(matched.gps.unmatchedCount, 1);

const manuallyAssigned = setGpsAssignment({ gpsAssignments: {} }, iphone[0].trackId, "journey-1");
const manualSnapshot = gpsSnapshot([...iphone, ...android], journeys, manuallyAssigned.gpsAssignments);
assert.equal(manualSnapshot.journeys[0].gps.sourceName, "iphone.gpx");
assert.equal(manualSnapshot.journeys[0].gps.manual, true);

const trimmed = parseGpxText(fixture(), { sourceName: "trimmed.gpx", sourceSha256: "c".repeat(64), trimMeters: 5 });
assert.ok(trimmed[0].stats.points < android[0].stats.points);
assert.equal(trimmed[0].trimMeters, 5);

const multiSegment = fixture().replace("</trkseg></trk>", `</trkseg><trkseg><trkpt lat="38.800000" lon="-9.200000"><time>${new Date((start + 300) * 1000).toISOString()}</time></trkpt><trkpt lat="38.800100" lon="-9.200100"><time>${new Date((start + 301) * 1000).toISOString()}</time></trkpt></trkseg></trk>`);
const segmented = parseGpxText(multiSegment, { sourceName: "segments.gpx", sourceSha256: "d".repeat(64) });
assert.equal(segmented.length, 1, "segments from one GPX track should stay in one recording");
assert.equal(segmented[0].stats.points, 183);
assert.equal(segmented[0].stats.gapCount, 1);
assert.ok(segmented[0].stats.distanceKm < 1, "distance must not connect separate GPX segments");

const imported = await importGps(emptyState(), new Blob([fixture()]), "android.gpx", {}, () => {});
assert.equal(imported.trackCount, 1);
assert.equal(imported.state.gpsImports[0].trackCount, 1);
assert.equal(imported.state.gpsImports[0].pointCount, 181);
const exportableState = { ...imported.state, streams: Object.fromEntries(["operation", "energy", "status"].map((family) => [family, { time: new Uint32Array([start]), columns: {}, stats: { rows: 1 } }])) };
const history = await exportHistory(exportableState, () => {});
assert.ok(isNativeHistory(new Uint8Array(history)));
const restored = await importHistory(history, () => {});
assert.equal(restored.version, 4);
assert.equal(restored.gpsTracks.length, 1);
assert.equal(restored.gpsTracks[0].lat.length, 181);
assert.equal(restored.gpsTracks[0].sourceName, "android.gpx");

console.log(JSON.stringify({ androidPoints: android[0].stats.points, iphonePoints: iphone[0].stats.points, selected: matched.journeys[0].gps.sourceName, historyBytes: history.byteLength }));
