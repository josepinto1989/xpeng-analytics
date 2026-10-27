import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSnapshot, emptyState, exportHistory, importArchive, importGps, importHistory, isNativeHistory, loadRecordDetails, odometerCoverageGaps, setCustomCharts, setJourneyGroups, setRawArchives } from "../src/engine/native-engine.js";

async function hydrateSnapshot(state, snapshot) {
  const details = await loadRecordDetails(state, { journeyIds: snapshot.journeys.map((row) => row.journeyId), chargeIds: snapshot.charges.map((row) => row.chargeId) });
  const replace = (rows, incoming, key) => { const map = new Map(incoming.map((row) => [row[key], row])); return rows.map((row) => map.get(row[key]) || row); };
  return { ...snapshot, trips: replace(snapshot.trips, details.trips, "tripId"), journeys: replace(snapshot.journeys, details.journeys, "journeyId"), charges: replace(snapshot.charges, details.charges, "chargeId") };
}

function storedZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function fixture(drivingSpeed = 50, rearRotorTemp = 42, start = 1_797_000_000) {
  const operation = ["timer,vmodel,esp_vehspd,esp_vehlongaccel,esp_vehlateralaccel,cdcu_totalodometer,eps_steeringangle,ldcu_accpedalsig,ldcu_brkpedalst,ldcu_currentgearlev"], energy = ["timer,vmodel,bms_battvolt,bms_battcurr,ldcu_chrgpwr,ldcu_bms_soc_disp,bms_batttempmax_gb,bms_batttempmin_gb,ldcu_dstbatdisp_dynamic,ipur_actrotspd,ipur_acttorq,ipur_rotoracttemp"], status = ["timer,vmodel,ldcu_tpmsprfl,ldcu_tpmsprfr,ldcu_tpmsprrl,ldcu_tpmsprrr,ldcu_driverdoorajarst,rdcu_psngrdoorajarst,ldcu_rldoorajarst,rdcu_rrdoorajarst,ldcu_flwinposstfb,frwinposstfb,ldcu_rlwinposstfb,rrwinposstfb,rdm_tropenersts"];
  for (let second = 0; second <= 360; second++) {
    const timer = start + second, driving = second >= 60 && second <= 240, charging = second >= 280;
    operation.push(`${timer},G6,${driving ? drivingSpeed : 0},${driving ? (second % 20 < 10 ? .18 : -.16) : 0},${driving ? .08 : 0},${10000 + second / 720},${driving ? (second % 30) - 15 : 0},${driving ? 28 : 0},${driving && second % 20 >= 10 ? 1 : 0},${driving ? 1 : 4}`);
    energy.push(`${timer},G6,400,${charging ? -25 : driving ? 20 : 0},${charging ? 11 : 0},${60 + second / 120},${26 + second / 360},24,330,${driving ? 4200 : 0},${driving ? 80 : 0},${rearRotorTemp}`);
    const trunkState = second < 5 ? 1 : second < 7 ? 2 : second < 9 ? 5 : second < 11 ? 6 : second < 13 ? 9 : 1;
    status.push(`${timer},G6,250,251,249,250,${second < 2 ? 1 : 0},0,0,0,0,0,0,0,${trunkState}`);
  }
  return storedZip({ "driving_operation.csv": operation.join("\n"), "driving_power_energy.csv": energy.join("\n"), "driving_status.csv": status.join("\n") });
}

const source = process.argv[2] ? await readFile(process.argv[2]) : fixture();
const imported = await importArchive(emptyState(), source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "fixture.zip", () => {}, 2_000_000_000);
assert.equal(imported.skipped, false);
const snapshot = await hydrateSnapshot(imported.state, buildSnapshot(imported.state));
assert.ok(snapshot.trips.length >= 1, "expected at least one trip");
assert.ok(snapshot.charges.length >= 1, "expected at least one charging session");
assert.ok(snapshot.driving.speed.length >= 1, "expected driving distribution");
assert.ok(snapshot.driving.contexts.length >= 1, "expected estimated driving-context segments");
assert.equal(snapshot.driving.contexts[0].context, "road", "50 km/h fixture should be estimated as road-style driving");
assert.ok(["low", "medium", "high"].includes(snapshot.driving.contexts[0].confidence), "expected a context confidence label");
assert.ok(snapshot.driving.contexts.reduce((total, row) => total + row.distanceKm, 0) > 0, "expected context distance");
assert.ok(Math.abs(snapshot.driving.contexts.reduce((total, row) => total + row.distanceKm, 0) - snapshot.overview.distanceKm) < .1, "context distance should reconcile with trip distance");
assert.ok(snapshot.activity.heatmap.length >= 1, "expected activity heatmap");
assert.ok(snapshot.battery.tyres.length >= 1, "expected tyre data");
assert.ok(snapshot.trips[0].maxLateralG > 0, "expected maximum lateral acceleration");
assert.ok(snapshot.trips[0].maxSteeringAngleDeg > 0, "expected maximum steering angle");
assert.ok(snapshot.trips[0].maxRearTorqueNm > 0, "expected rear motor torque");
assert.ok(snapshot.trips[0].maxRearRotorTempC > 0, "expected rear rotor temperature");
assert.ok(snapshot.trips[0].series.some((row) => row.longitudinalG != null && row.lateralG != null), "expected journey force series");
assert.ok(snapshot.trips[0].series.some((row) => row.rearMotorTorqueNm != null && row.rearMotorRpm != null), "expected rear motor series");
assert.ok(snapshot.trips[0].series.some((row) => row.tyreFrontLeftKpa != null && row.tyreRearRightKpa != null), "expected journey tyre series");
assert.ok(snapshot.trips[0].replayEvents.some((row) => row.driverDoorOpen === 1), "expected observed pre-trip driver-door state in replay telemetry");
assert.ok(snapshot.trips[0].replayEvents.some((row) => row.trunkState === 5), "expected observed pre-trip fully-open boot state in replay telemetry");
assert.ok(snapshot.trips[0].series.some((row) => row.gearLevel === 1), "expected observed drive gear state in replay telemetry");
assert.ok(Date.parse(snapshot.trips[0].replaySeries[0].timestampUtc) < Date.parse(snapshot.trips[0].startedAtUtc), "replay telemetry must include the pre-trip context");
assert.ok(Date.parse(snapshot.trips[0].replaySeries.at(-1).timestampUtc) > Date.parse(snapshot.trips[0].endedAtUtc), "replay telemetry must include the post-trip context");
assert.ok(snapshot.trips[0].replaySeries.length <= 300, "replay telemetry must stay within the memory budget");
assert.ok(snapshot.trips[0].series.every((row) => snapshot.trips[0].replaySeries.includes(row)), "journey charts and replay must reuse the same telemetry objects");
assert.deepEqual(snapshot.trips[0].replayEvents.map((row) => row.trunkState).filter((value) => value != null), [1, 2, 5, 6, 9, 1], "boot movement states must remain exact replay events");
assert.ok(snapshot.quality.coverage.every((row) => Array.isArray(row.availableColumns) && Number.isInteger(row.totalColumns)), "expected signal availability metadata");
const detectedCoverageGaps = odometerCoverageGaps({ time: new Uint32Array([100, 101, 180]), columns: { odometer_km: new Float32Array([1000, 1000.02, 1001.2]) } });
assert.equal(detectedCoverageGaps.length, 1, "odometer movement across a telemetry interval must be flagged");
assert.ok(detectedCoverageGaps[0].missingDistanceKm >= 1, "coverage warning must retain the observed odometer distance");

const futureFixtureStart = 1_797_010_000;
const futureGpxPoints = [];
for (let second = 60; second <= 240; second++) futureGpxPoints.push(`<trkpt lat="${38.70 + (second - 60) * .00001}" lon="${-9.10 - (second - 60) * .00001}"><time>${new Date((futureFixtureStart + second) * 1000).toISOString()}</time></trkpt>`);
const futureGpx = `<?xml version="1.0"?><gpx version="1.1" creator="Future test"><trk><trkseg>${futureGpxPoints.join("")}</trkseg></trk></gpx>`;
const futureGpsImport = await importGps(imported.state, new Blob([futureGpx]), "future.gpx");
const futureGpsSnapshot = buildSnapshot(futureGpsImport.state);
assert.equal(futureGpsSnapshot.gps.matchedTripCount, 0);
assert.equal(futureGpsSnapshot.gps.matchedTripCount, 0, "a pending route must not be presented as a matched route");
const pendingHistory = await exportHistory(futureGpsImport.state);
const pendingRestored = await importHistory(pendingHistory);
assert.equal(buildSnapshot(pendingRestored).gps.matchedTripCount, 0, "a retained pending route must remain unmatched");
const futureSource = fixture(50, 42, futureFixtureStart);
const laterImport = await importArchive(pendingRestored, futureSource.buffer.slice(futureSource.byteOffset, futureSource.byteOffset + futureSource.byteLength), "future-fixture.zip", () => {}, 2_000_000_000);
const laterSnapshot = buildSnapshot(laterImport.state);
assert.equal(laterSnapshot.gps.matchedTripCount, 1, "a retained route must be matched automatically when later XPENG telemetry arrives");
assert.ok(laterSnapshot.journeys.some((journey) => journey.gps), "the later journey must expose its matched GPS route");

const oldGpxStart = 1_797_000_000 - 6 * 24 * 60 * 60;
const oldGpx = `<?xml version="1.0"?><gpx version="1.1" creator="Old test"><trk><trkseg><trkpt lat="38.70" lon="-9.10"><time>${new Date(oldGpxStart * 1000).toISOString()}</time></trkpt><trkpt lat="38.7001" lon="-9.1001"><time>${new Date((oldGpxStart + 60) * 1000).toISOString()}</time></trkpt></trkseg></trk></gpx>`;
const oldGpsImport = await importGps(imported.state, new Blob([oldGpx]), "old.gpx");
buildSnapshot(oldGpsImport.state);
const prunedHistory = await exportHistory(oldGpsImport.state);
const prunedRestored = await importHistory(prunedHistory);
assert.equal(buildSnapshot(prunedRestored).gps.tracks.length, 0, "an unmatched route older than the five-day telemetry window must be pruned");
assert.equal(prunedRestored.gpsImports.length, 1, "pruning coordinates must not remove lightweight GPX import provenance");

const stateWithCharts = setCustomCharts(imported.state, [{ id: "distance", title: "Distance", dataset: "daily", type: "line", x: "date", y: ["distanceKm"], period: "all", groupBy: "none" }]);
const stateWithPreferences = setJourneyGroups(stateWithCharts, [{ groupId:"manual-test", name:"Test outing", journeyIds:["journey-a","journey-b"], tripIds:["trip-a","trip-b"], createdAtUtc:"2026-10-26T10:00:00Z" }]);
const stateWithRawArchive = setRawArchives(stateWithPreferences, [{ sha256: imported.archiveSha256, driveStatus: "retained", driveFileId: "drive-original-1", driveUpdatedAtUtc: "2026-10-27T12:00:00Z" }]);
assert.equal(buildSnapshot(stateWithCharts).customCharts.length, 1, "custom chart definitions must be exposed in the dashboard snapshot");
assert.equal(buildSnapshot(stateWithPreferences).journeyGroups.length, 1, "manual journey groups must be exposed in the dashboard snapshot");
const history = await exportHistory(stateWithRawArchive);
assert.ok(isNativeHistory(new Uint8Array(await history.slice(0, 8).arrayBuffer())), "expected native history signature");
const restored = await importHistory(history);
assert.equal(restored.version, 7);
assert.equal(restored.sourceHistoryVersion, 7, "the imported history source version must be preserved for migrations and onboarding");
assert.equal(restored.customCharts[0].id, "distance", "custom chart definitions must survive the .xpeng round trip");
assert.equal(restored.journeyGroups[0].groupId, "manual-test", "manual journey groups must survive the .xpeng round trip");
assert.equal(restored.rawArchives[0].driveStatus, "retained", "raw original retention state must survive the .xpeng round trip");
assert.equal(restored.rawArchives[0].driveFileId, "drive-original-1", "the Drive source reference must survive the .xpeng round trip");
const restoredSnapshot = await hydrateSnapshot(restored, buildSnapshot(restored));
assert.equal(restoredSnapshot.trips.length, snapshot.trips.length);
assert.equal(restoredSnapshot.charges.length, snapshot.charges.length);
assert.equal(restoredSnapshot.trips[0].maxSteeringAngleDeg, snapshot.trips[0].maxSteeringAngleDeg);
assert.equal(restoredSnapshot.trips[0].series[0].rearMotorTorqueNm, snapshot.trips[0].series[0].rearMotorTorqueNm);
const historyBytes = new Uint8Array(await history.arrayBuffer());
const segmentedManifestLength = new DataView(historyBytes.buffer, historyBytes.byteOffset + 8, 4).getUint32(0, false);
const segmentedManifest = JSON.parse(new TextDecoder().decode(historyBytes.subarray(12, 12 + segmentedManifestLength)));
const firstShard = segmentedManifest.shards[0].payload;
const legacyBytes = historyBytes.slice(12 + segmentedManifestLength + firstShard.offset, 12 + segmentedManifestLength + firstShard.offset + firstShard.bytes);
const originalManifestLength = new DataView(legacyBytes.buffer, legacyBytes.byteOffset + 8, 4).getUint32(0, false);
const olderManifest = JSON.parse(new TextDecoder().decode(legacyBytes.subarray(12, 12 + originalManifestLength)));
olderManifest.version = 4;
delete olderManifest.customCharts;
delete olderManifest.streams.operation.columns.steering_angle_deg;
const olderManifestBytes = new TextEncoder().encode(JSON.stringify(olderManifest));
const olderHeader = legacyBytes.slice(0, 8), olderLength = new Uint8Array(4);
olderHeader[7] = 4;
new DataView(olderLength.buffer).setUint32(0, olderManifestBytes.byteLength, false);
const olderHistory = new Blob([olderHeader, olderLength, olderManifestBytes, legacyBytes.subarray(12 + originalManifestLength)]);
const olderRestored = await importHistory(olderHistory);
assert.equal(olderRestored.version, 7);
assert.equal(olderRestored.sourceHistoryVersion, 4, "older portable histories must retain their original source version");
const olderDetails = await loadRecordDetails(olderRestored, { journeyIds: buildSnapshot(olderRestored).journeys.map((row) => row.journeyId) });
assert.ok(olderDetails.trips.every((trip) => trip.series.every((row) => row.steeringAngleDeg == null)), "signals absent from older histories must be restored as unavailable");
assert.equal(buildSnapshot(olderRestored).trips.length, snapshot.trips.length, "an older history with fewer signals must still build a complete dashboard");
const corruptManifest = new Uint8Array([88, 80, 69, 78, 71, 65, 0, 5, 0, 0, 0, 1, 123]);
await assert.rejects(() => importHistory(corruptManifest), /history_integrity/, "a malformed manifest must produce a controlled integrity error");
const mobileImported = await importArchive(emptyState(), new Blob([source]), "mobile-fixture.zip", () => {}, { mode: "mobile", memoryBudgetBytes: 1 });
assert.equal(mobileImported.totalRows, imported.totalRows, "mobile streaming import must retain every row without a conservative memory rejection");
const mobileRestored = await importHistory(new Blob([history]));
assert.equal(buildSnapshot(mobileRestored).trips.length, snapshot.trips.length, "mobile history streaming must retain every trip");
const duplicate = await importArchive(restored, source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "fixture.zip", () => {}, 2_000_000_000);
assert.equal(duplicate.skipped, true);
if (!process.argv[2]) {
  for (const [speed, expected] of [[25, "urban"], [65, "road"], [110, "motorway"]]) {
    const contextFixture = fixture(speed), contextImport = await importArchive(emptyState(), contextFixture.buffer.slice(contextFixture.byteOffset, contextFixture.byteOffset + contextFixture.byteLength), `${expected}.zip`, () => {}, 2_000_000_000);
    const contexts = buildSnapshot(contextImport.state).driving.contexts;
    assert.ok(contexts.length, `expected ${expected} context rows`);
    assert.ok(contexts.every((row) => row.context === expected), `${speed} km/h fixture should be classified as ${expected}`);
  }
  const changed = fixture(60);
  const overlap = await importArchive(restored, changed.buffer.slice(changed.byteOffset, changed.byteOffset + changed.byteLength), "overlap.zip", () => {}, 2_000_000_000);
  assert.equal(overlap.skipped, false);
  assert.equal(buildSnapshot(overlap.state).quality.coverage.find((row) => row.family === "operation").rows, buildSnapshot(restored).quality.coverage.find((row) => row.family === "operation").rows, "overlap must not duplicate timestamps");
  assert.ok(buildSnapshot(overlap.state).overview.distanceKm > snapshot.overview.distanceKm, "new overlapping values must win");
  const zeroTemperature = fixture(50, 0);
  const zeroTemperatureImport = await importArchive(emptyState(), zeroTemperature.buffer.slice(zeroTemperature.byteOffset, zeroTemperature.byteOffset + zeroTemperature.byteLength), "zero-temperature.zip", () => {}, 2_000_000_000);
  const zeroTemperatureSnapshot = await hydrateSnapshot(zeroTemperatureImport.state, buildSnapshot(zeroTemperatureImport.state));
  assert.equal(zeroTemperatureSnapshot.trips[0].maxRearRotorTempC, null, "zero-only rotor temperature must be treated as unavailable");
  assert.ok(zeroTemperatureSnapshot.trips[0].series.every((row) => row.rearRotorTempC == null), "zero-only rotor temperature series must be unavailable");

  let twoYearState = emptyState();
  for (let month = 0; month < 24; month++) {
    const start = Math.floor(Date.UTC(2024 + Math.floor(month / 12), month % 12, 10, 8) / 1000), monthly = fixture(45 + month % 5, 42, start);
    twoYearState = (await importArchive(twoYearState, monthly.buffer.slice(monthly.byteOffset, monthly.byteOffset + monthly.byteLength), `month-${month + 1}.zip`, () => {}, 2_000_000_000)).state;
  }
  const twoYearSnapshot = buildSnapshot(twoYearState);
  assert.equal(twoYearState.shards.length, 24, "two years must be stored as 24 independently loadable monthly shards");
  assert.equal(twoYearSnapshot.trips.length, 24, "the compact index must retain trips across all monthly shards");
  assert.ok(twoYearSnapshot.trips.every((trip) => !trip.series), "the always-loaded trip index must not retain detailed telemetry");
  const oneJourney = await loadRecordDetails(twoYearState, { journeyIds: [twoYearSnapshot.journeys[0].journeyId] });
  assert.equal(oneJourney.journeys.length, 1, "opening one journey must load only its detailed record");
  assert.ok(oneJourney.trips[0].series.length, "the selected monthly shard must restore detailed telemetry on demand");
  const twoYearHistory = await exportHistory(twoYearState), twoYearRestored = await importHistory(twoYearHistory);
  assert.equal(twoYearRestored.shards.length, 24, "the segmented portable history must preserve all monthly shards");
}

console.log(JSON.stringify({ rows: imported.totalRows, trips: snapshot.trips.length, charges: snapshot.charges.length, distanceKm: snapshot.overview.distanceKm, netEnergyKwh: snapshot.overview.netEnergyKwh, wallEnergyKwh: snapshot.overview.wallEnergyKwh, historyBytes: history.size }));
