import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSnapshot, emptyState, exportHistory, importArchive, importGps, importHistory, isNativeHistory, setCustomCharts } from "../src/engine/native-engine.js";

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

function fixture(drivingSpeed = 50, rearRotorTemp = 42) {
  const start = 1_797_000_000, operation = ["timer,vmodel,esp_vehspd,esp_vehlongaccel,esp_vehlateralaccel,cdcu_totalodometer,eps_steeringangle,ldcu_accpedalsig,ldcu_brkpedalst,ldcu_currentgearlev"], energy = ["timer,vmodel,bms_battvolt,bms_battcurr,ldcu_chrgpwr,ldcu_bms_soc_disp,bms_batttempmax_gb,bms_batttempmin_gb,ldcu_dstbatdisp_dynamic,ipur_actrotspd,ipur_acttorq,ipur_rotoracttemp"], status = ["timer,vmodel,ldcu_tpmsprfl,ldcu_tpmsprfr,ldcu_tpmsprrl,ldcu_tpmsprrr,ldcu_driverdoorajarst,rdcu_psngrdoorajarst,ldcu_rldoorajarst,rdcu_rrdoorajarst,ldcu_flwinposstfb,frwinposstfb,ldcu_rlwinposstfb,rrwinposstfb,rdm_tropenersts"];
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
const snapshot = buildSnapshot(imported.state);
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

const futureGpxStart = 1_797_010_000;
const futureGpx = `<?xml version="1.0"?><gpx version="1.1" creator="Future test"><trk><trkseg><trkpt lat="38.70" lon="-9.10"><time>${new Date(futureGpxStart * 1000).toISOString()}</time></trkpt><trkpt lat="38.71" lon="-9.11"><time>${new Date((futureGpxStart + 60) * 1000).toISOString()}</time></trkpt></trkseg></trk></gpx>`;
const futureGpsImport = await importGps(imported.state, new Blob([futureGpx]), "future.gpx");
const futureGpsSnapshot = buildSnapshot(futureGpsImport.state);
assert.equal(futureGpsSnapshot.gps.matchedTripCount, 0);
assert.equal(futureGpsImport.state.gpsTracks.length, 1, "an unmatched route must remain available in the active session for a later XPENG ZIP");
assert.equal(futureGpsImport.state.gpsSelectedTracks.length, 0, "unmatched routes must not be selected for portable history export");

const stateWithCharts = setCustomCharts(imported.state, [{ id: "distance", title: "Distance", dataset: "daily", type: "line", x: "date", y: ["distanceKm"], period: "all", groupBy: "none" }]);
assert.equal(buildSnapshot(stateWithCharts).customCharts.length, 1, "custom chart definitions must be exposed in the dashboard snapshot");
const history = await exportHistory(stateWithCharts);
assert.ok(isNativeHistory(new Uint8Array(history)), "expected native history signature");
const restored = await importHistory(history);
assert.equal(restored.version, 5);
assert.equal(restored.sourceHistoryVersion, 5, "the imported history source version must be preserved for migrations and onboarding");
assert.equal(restored.customCharts[0].id, "distance", "custom chart definitions must survive the .xpeng round trip");
const restoredSnapshot = buildSnapshot(restored);
assert.equal(restoredSnapshot.trips.length, snapshot.trips.length);
assert.equal(restoredSnapshot.charges.length, snapshot.charges.length);
assert.equal(restoredSnapshot.trips[0].maxSteeringAngleDeg, snapshot.trips[0].maxSteeringAngleDeg);
assert.equal(restoredSnapshot.trips[0].series[0].rearMotorTorqueNm, snapshot.trips[0].series[0].rearMotorTorqueNm);
const historyBytes = new Uint8Array(history);
const originalManifestLength = new DataView(historyBytes.buffer, historyBytes.byteOffset + 8, 4).getUint32(0, false);
const olderManifest = JSON.parse(new TextDecoder().decode(historyBytes.subarray(12, 12 + originalManifestLength)));
olderManifest.version = 4;
delete olderManifest.customCharts;
delete olderManifest.streams.operation.columns.steering_angle_deg;
const olderManifestBytes = new TextEncoder().encode(JSON.stringify(olderManifest));
const olderHeader = historyBytes.slice(0, 8), olderLength = new Uint8Array(4);
olderHeader[7] = 4;
new DataView(olderLength.buffer).setUint32(0, olderManifestBytes.byteLength, false);
const olderHistory = new Blob([olderHeader, olderLength, olderManifestBytes, historyBytes.subarray(12 + originalManifestLength)]);
const olderRestored = await importHistory(olderHistory);
assert.equal(olderRestored.version, 5);
assert.equal(olderRestored.sourceHistoryVersion, 4, "older portable histories must retain their original source version");
assert.ok(olderRestored.streams.operation.columns.steering_angle_deg.every(Number.isNaN), "signals absent from older histories must be restored as unavailable");
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
  assert.equal(overlap.state.streams.operation.time.length, restored.streams.operation.time.length, "overlap must not duplicate timestamps");
  assert.ok(buildSnapshot(overlap.state).overview.distanceKm > snapshot.overview.distanceKm, "new overlapping values must win");
  const zeroTemperature = fixture(50, 0);
  const zeroTemperatureImport = await importArchive(emptyState(), zeroTemperature.buffer.slice(zeroTemperature.byteOffset, zeroTemperature.byteOffset + zeroTemperature.byteLength), "zero-temperature.zip", () => {}, 2_000_000_000);
  const zeroTemperatureSnapshot = buildSnapshot(zeroTemperatureImport.state);
  assert.equal(zeroTemperatureSnapshot.trips[0].maxRearRotorTempC, null, "zero-only rotor temperature must be treated as unavailable");
  assert.ok(zeroTemperatureSnapshot.trips[0].series.every((row) => row.rearRotorTempC == null), "zero-only rotor temperature series must be unavailable");
}

console.log(JSON.stringify({ rows: imported.totalRows, trips: snapshot.trips.length, charges: snapshot.charges.length, distanceKm: snapshot.overview.distanceKm, netEnergyKwh: snapshot.overview.netEnergyKwh, wallEnergyKwh: snapshot.overview.wallEnergyKwh, historyBytes: history.byteLength }));
