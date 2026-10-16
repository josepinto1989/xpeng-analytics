import assert from "node:assert/strict";
import { detectAdditionalFileKind, emptyState, exportHistory, importGps, importHistory, isNativeHistory } from "../src/engine/native-engine.js";
import { gpsSnapshot, parseGpxText } from "../src/engine/gpx.js";

const start = Date.parse("2026-10-15T07:23:00Z") / 1000;
function storedZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(body), local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes); offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function fixture({ creator = "BasicAirData GPS Logger", interval = 1, offset = 0, duration = 180 } = {}) {
  const points = [];
  for (let index = 0; index <= duration; index += interval) {
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
assert.equal(await detectAdditionalFileKind(new Blob([fixture()]), "track.gpx"), "gps");
assert.equal(await detectAdditionalFileKind(new Blob([storedZip({ "routes/track.gpx": fixture() })]), "routes.zip"), "gps");
assert.equal(await detectAdditionalFileKind(new Blob([storedZip({ "driving_operation.csv": "x", "driving_power_energy.csv": "x", "driving_status.csv": "x" })]), "xpeng.zip"), "xpeng");

const trips = [{ tripId: "trip-1", startedAtUtc: new Date(start * 1000).toISOString(), endedAtUtc: new Date((start + 180) * 1000).toISOString(), distanceKm: android[0].stats.distanceKm, avgSpeedKmh: android[0].stats.distanceKm / .05 }];
const journeys = [{ journeyId: "journey-1", startedAtUtc: trips[0].startedAtUtc, endedAtUtc: trips[0].endedAtUtc, distanceKm: trips[0].distanceKm, tripIds: [trips[0].tripId] }];
const matched = gpsSnapshot([...iphone, ...android], journeys, trips);
assert.equal(matched.gps.matchedCount, 1);
assert.equal(matched.journeys[0].gps.sourceName, "android.gpx", "the more complete duplicate track should win");
assert.equal(matched.gps.duplicateCount, 1);
assert.equal(matched.selectedTracks.length, 1, "only the selected route slice should be retained");
const rebuiltMatch = gpsSnapshot(matched.selectedTracks, journeys, trips);
assert.equal(rebuiltMatch.gps.duplicateCount, 1, "discarded duplicate provenance must survive dashboard rebuilds");
assert.deepEqual(rebuiltMatch.selectedTracks[0].ignoredSourceIds, matched.selectedTracks[0].ignoredSourceIds);

const incompleteDuplicate = parseGpxText(fixture({ creator: "Interrupted logger", interval: 4, duration: 60 }), { sourceName: "incomplete.gpx", sourceSha256: "f".repeat(64) });
const withIncompleteDuplicate = gpsSnapshot([...android, ...incompleteDuplicate], journeys, trips);
assert.equal(withIncompleteDuplicate.journeys[0].gps.sourceName, "android.gpx");
assert.equal(withIncompleteDuplicate.gps.duplicateCount, 1, "an overlapping but incomplete secondary recording should be discarded as a duplicate");

const trimmed = parseGpxText(fixture(), { sourceName: "trimmed.gpx", sourceSha256: "c".repeat(64), trimMeters: 5 });
assert.equal(trimmed[0].stats.points, android[0].stats.points, "privacy trimming must wait until a trip slice is selected");
const trimmedMatch = gpsSnapshot(trimmed, journeys, trips);
assert.ok(trimmedMatch.selectedTracks[0].stats.points < android[0].stats.points);
assert.equal(trimmedMatch.selectedTracks[0].trimMeters, 5);
const rebuiltTrimmedMatch = gpsSnapshot(trimmedMatch.selectedTracks, journeys, trips);
assert.equal(rebuiltTrimmedMatch.selectedTracks[0].stats.points, trimmedMatch.selectedTracks[0].stats.points, "rebuilding the dashboard must not trim a selected route twice");

const allDayPoints = [];
for (let index = -600; index <= 780; index += 5) allDayPoints.push(`<trkpt lat="38.${700000 + index + 600}" lon="-9.${100000 + index + 600}"><time>${new Date((start + index) * 1000).toISOString()}</time></trkpt>`);
const allDay = parseGpxText(`<?xml version="1.0"?><gpx version="1.1" creator="All day"><trk><trkseg>${allDayPoints.join("")}</trkseg></trk></gpx>`, { sourceName: "all-day.gpx", sourceSha256: "e".repeat(64) });
const allDayMatch = gpsSnapshot(allDay, journeys, trips);
assert.equal(allDayMatch.selectedTracks.length, 1);
assert.ok(allDayMatch.selectedTracks[0].time[0] >= start && allDayMatch.selectedTracks[0].time.at(-1) <= start + 180, "walking and parked positions outside the XPENG trip must be discarded");

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
const exportableState = { ...imported.state, gpsSelectedTracks: matched.selectedTracks, streams: Object.fromEntries(["operation", "energy", "status"].map((family) => [family, { time: new Uint32Array([start]), columns: {}, stats: { rows: 1 } }])) };
const history = await exportHistory(exportableState, () => {});
assert.ok(isNativeHistory(new Uint8Array(history)));
const restored = await importHistory(history, () => {});
assert.equal(restored.version, 4);
assert.equal(restored.gpsTracks.length, 1);
assert.equal(restored.gpsTracks[0].lat.length, matched.selectedTracks[0].lat.length);
assert.equal(restored.gpsTracks[0].sourceName, "android.gpx");
assert.deepEqual(restored.gpsTracks[0].ignoredSourceIds, matched.selectedTracks[0].ignoredSourceIds, "discarded duplicate provenance must survive .xpeng export and restore");

console.log(JSON.stringify({ androidPoints: android[0].stats.points, iphonePoints: iphone[0].stats.points, selected: matched.journeys[0].gps.sourceName, historyBytes: history.byteLength }));
