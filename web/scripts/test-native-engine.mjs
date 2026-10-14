import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSnapshot, emptyState, exportHistory, importArchive, importHistory, isNativeHistory } from "../src/engine/native-engine.js";

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
  const start = 1_797_000_000, operation = ["timer,vmodel,esp_vehspd,esp_vehlongaccel,esp_vehlateralaccel,cdcu_totalodometer,eps_steeringangle,ldcu_accpedalsig,ldcu_brkpedalst"], energy = ["timer,vmodel,bms_battvolt,bms_battcurr,ldcu_chrgpwr,ldcu_bms_soc_disp,bms_batttempmax_gb,bms_batttempmin_gb,ldcu_dstbatdisp_dynamic,ipur_actrotspd,ipur_acttorq,ipur_rotoracttemp"], status = ["timer,vmodel,ldcu_tpmsprfl,ldcu_tpmsprfr,ldcu_tpmsprrl,ldcu_tpmsprrr"];
  for (let second = 0; second <= 360; second++) {
    const timer = start + second, driving = second <= 180, charging = second >= 220;
    operation.push(`${timer},G6,${driving ? drivingSpeed : 0},${driving ? (second % 20 < 10 ? .18 : -.16) : 0},${driving ? .08 : 0},${10000 + second / 720},${driving ? (second % 30) - 15 : 0},${driving ? 28 : 0},${driving && second % 20 >= 10 ? 1 : 0}`);
    energy.push(`${timer},G6,400,${charging ? -25 : driving ? 20 : 0},${charging ? 11 : 0},${60 + second / 120},${26 + second / 360},24,330,${driving ? 4200 : 0},${driving ? 80 : 0},${rearRotorTemp}`);
    status.push(`${timer},G6,250,251,249,250`);
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
assert.ok(snapshot.activity.heatmap.length >= 1, "expected activity heatmap");
assert.ok(snapshot.battery.tyres.length >= 1, "expected tyre data");
assert.ok(snapshot.trips[0].maxLateralG > 0, "expected maximum lateral acceleration");
assert.ok(snapshot.trips[0].maxSteeringAngleDeg > 0, "expected maximum steering angle");
assert.ok(snapshot.trips[0].maxRearTorqueNm > 0, "expected rear motor torque");
assert.ok(snapshot.trips[0].maxRearRotorTempC > 0, "expected rear rotor temperature");
assert.ok(snapshot.trips[0].series.some((row) => row.longitudinalG != null && row.lateralG != null), "expected journey force series");
assert.ok(snapshot.trips[0].series.some((row) => row.rearMotorTorqueNm != null && row.rearMotorRpm != null), "expected rear motor series");
assert.ok(snapshot.trips[0].series.some((row) => row.tyreFrontLeftKpa != null && row.tyreRearRightKpa != null), "expected journey tyre series");
assert.ok(snapshot.quality.coverage.every((row) => Array.isArray(row.availableColumns) && Number.isInteger(row.totalColumns)), "expected signal availability metadata");

const history = await exportHistory(imported.state);
assert.ok(isNativeHistory(new Uint8Array(history)), "expected native history signature");
const restored = await importHistory(history);
const restoredSnapshot = buildSnapshot(restored);
assert.equal(restoredSnapshot.trips.length, snapshot.trips.length);
assert.equal(restoredSnapshot.charges.length, snapshot.charges.length);
assert.equal(restoredSnapshot.trips[0].maxSteeringAngleDeg, snapshot.trips[0].maxSteeringAngleDeg);
assert.equal(restoredSnapshot.trips[0].series[0].rearMotorTorqueNm, snapshot.trips[0].series[0].rearMotorTorqueNm);
const duplicate = await importArchive(restored, source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "fixture.zip", () => {}, 2_000_000_000);
assert.equal(duplicate.skipped, true);
if (!process.argv[2]) {
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
