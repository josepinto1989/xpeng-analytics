import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeJourneyDates,
  buildReplayTimeline,
  estimatedLowBeam,
  gearLabel,
  instantaneousConsumption,
  replayDuration,
  replayFrame,
  REPLAY_SPEEDS,
  REPLAY_COMPRESSED_GAP_MS,
  trunkPhase,
  trunkProgress,
  visualFrontWheelAngle,
  windowMotion,
} from "../src/replay.js";

const trips = [
  {
    tripId: "trip-a",
    series: [
      { timestampUtc: "2026-10-16T08:00:00.000Z", speedKmh: 0, powerKw: 0, brakePct: 1, driverDoorOpen: 1, gearLevel: 1 },
      { timestampUtc: "2026-10-16T08:00:10.000Z", speedKmh: 40, powerKw: 8, brakePct: 0, driverDoorOpen: 0, gearLevel: 4 },
    ],
  },
  {
    tripId: "trip-b",
    series: [
      { timestampUtc: "2026-10-16T08:05:00.000Z", speedKmh: 60, powerKw: 12, driverDoorOpen: 0, gearLevel: 4 },
      { timestampUtc: "2026-10-16T08:05:10.000Z", speedKmh: 80, powerKw: 16, driverDoorOpen: 0, gearLevel: 4 },
    ],
  },
];

const journey = { journeyId: "journey-a", date: "2026-10-16", tripIds: ["trip-b", "trip-a"] };
const timeline = buildReplayTimeline(journey, trips);
assert.equal(timeline.length, 4);
assert.equal(timeline[0].tripId, "trip-a", "telemetry must be ordered by its source timestamp");
assert.equal(timeline[2].playbackGapMs, REPLAY_COMPRESSED_GAP_MS, "long gaps must be compressed");
assert.equal(replayDuration(timeline), 30_000, "compressed replay duration must remain deterministic");
assert.deepEqual(REPLAY_SPEEDS, [1, 2, 3, 5, 10], "replay must expose the five supported playback rates");

const middle = replayFrame(timeline, 5_000);
assert.equal(middle.speedKmh, 20, "numeric telemetry must interpolate between samples");
assert.equal(middle.driverDoorOpen, 1, "discrete state must remain on the last observed value");
assert.equal(middle.brakePct, 1, "brake status must remain discrete rather than appearing as a false pedal position");
assert.equal(replayFrame(timeline, 999_999).speedKmh, 80, "seeking beyond the end must clamp to the final sample");
assert.equal(instantaneousConsumption({ speedKmh: 100, powerKw: 20 }), 20);
assert.equal(instantaneousConsumption({ speedKmh: 3, powerKw: 20 }), null, "near-zero speed must not produce an unstable consumption value");
assert.equal(gearLabel(1), "D");
assert.equal(gearLabel(2), "N");
assert.equal(gearLabel(3), "R");
assert.equal(gearLabel(4), "P");
assert.equal(gearLabel(0), null);
assert.equal(trunkPhase(1), "closed");
assert.equal(trunkPhase(2), "opening");
assert.equal(trunkPhase(5), "open");
assert.equal(trunkPhase(6), "closing");
assert.equal(trunkPhase(9), "partial");
assert.equal(trunkProgress(1), 0);
assert.equal(trunkProgress(5), 1);
assert.equal(windowMotion(4), "manualDown");
assert.equal(estimatedLowBeam("2026-10-16T22:00:00"), true, "dipped beams should be estimated on after 20:00 local time");
assert.equal(estimatedLowBeam("2026-10-16T07:59:00"), true, "dipped beams should remain estimated on before 08:00 local time");
assert.equal(estimatedLowBeam("2026-10-16T12:00:00"), false, "dipped beams should be estimated off during daytime");
assert.equal(visualFrontWheelAngle(160), 10, "steering-wheel telemetry should map to a plausible front-wheel visual angle");
assert.equal(visualFrontWheelAngle(900), 32, "the visual front-wheel angle must remain physically readable");

const exactJourney = { journeyId: "journey-exact", tripIds: ["trip-exact"] };
const exactTimeline = buildReplayTimeline(exactJourney, [{
  tripId: "trip-exact",
  replaySeries: [
    { timestampUtc: "2026-10-16T09:00:00.000Z", speedKmh: 0, driverDoorOpen: 1, trunkState: 5 },
    { timestampUtc: "2026-10-16T09:00:10.000Z", speedKmh: 20, driverDoorOpen: 0, trunkState: 1 },
  ],
  replayEvents: [
    { timestampUtc: "2026-10-16T09:00:00.000Z", driverDoorOpen: 0, trunkState: 1 },
    { timestampUtc: "2026-10-16T09:00:05.000Z", driverDoorOpen: 1, trunkState: 2 },
    { timestampUtc: "2026-10-16T09:00:07.000Z", driverDoorOpen: 0, trunkState: 5 },
  ],
}]);
assert.equal(replayFrame(exactTimeline, 4_000).driverDoorOpen, 0, "binned series must not move a door before its exact event");
assert.equal(replayFrame(exactTimeline, 6_000).driverDoorOpen, 1, "exact door event must be held until the next event");
assert.equal(replayFrame(exactTimeline, 8_000).trunkState, 5, "exact boot state must override binned replay values");

const dates = activeJourneyDates([
  { date: "2026-10-16" },
  { startedAtUtc: "2026-10-16T10:00:00Z" },
  { date: "2026-10-15" },
]);
assert.equal(dates.get("2026-10-16"), 2);
assert.equal(dates.get("2026-10-15"), 1);

const vehicleAsset = readFileSync(new URL("../public/assets/replay/generic-suv-body.png", import.meta.url));
assert.equal(vehicleAsset.toString("hex", 0, 8), "89504e470d0a1a0a", "the replay vehicle must be a valid PNG asset");
assert.equal(vehicleAsset.readUInt32BE(16), 1774, "the technical vehicle must retain its intended width");
assert.equal(vehicleAsset.readUInt32BE(20), 887, "the technical vehicle must retain its intended height");
assert.equal(vehicleAsset.readUInt8(25), 6, "the replay vehicle must retain its transparent RGBA background");

console.log(JSON.stringify({ timelinePoints: timeline.length, replayDurationMs: replayDuration(timeline), activeDates: dates.size, vehicleAssetBytes: vehicleAsset.byteLength }));
