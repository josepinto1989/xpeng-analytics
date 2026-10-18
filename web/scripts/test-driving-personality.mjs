import assert from "node:assert/strict";
import { calculateDrivingPersonality, DRIVING_PERSONALITY_KEYS } from "../src/driving-personality.js";

const smooth = calculateDrivingPersonality({
  trips: [
    { startedAtUtc: "2026-10-12T10:00:00", distanceKm: 30, energyUsedKwh: 5.1, regeneratedKwh: 1.4 },
    { startedAtUtc: "2026-10-13T10:00:00", distanceKm: 35, energyUsedKwh: 6, regeneratedKwh: 1.5 },
    { startedAtUtc: "2026-10-14T10:00:00", distanceKm: 25, energyUsedKwh: 4.2, regeneratedKwh: 1.2 },
  ],
  speedRows: [{ band: "30–50", minutes: 80 }, { band: "50–90", minutes: 40 }],
  pedalRows: [{ band: "10–25", minutes: 80 }, { band: "25–50", minutes: 15 }],
  events: [],
  profileScore: 5,
});
assert.equal(smooth.primary.key, "smoothOperator");
assert.ok(smooth.secondary.length <= 2);

const night = calculateDrivingPersonality({
  trips: [
    { startedAtUtc: "2026-10-12T22:00:00", distanceKm: 25, energyUsedKwh: 5, regeneratedKwh: .7 },
    { startedAtUtc: "2026-10-13T23:00:00", distanceKm: 20, energyUsedKwh: 4, regeneratedKwh: .6 },
    { startedAtUtc: "2026-10-14T21:00:00", distanceKm: 30, energyUsedKwh: 6, regeneratedKwh: .8 },
  ],
  speedRows: [{ band: "50–90", minutes: 80 }],
  pedalRows: [{ band: "25–50", minutes: 40 }],
  events: [],
  profileScore: 45,
});
assert.equal(night.primary.key, "nightOwl");

const sparse = calculateDrivingPersonality({ trips: [{ startedAtUtc: "2026-10-12T12:00:00", distanceKm: 2 }] });
assert.equal(sparse.primary.key, "allRounder");
assert.ok(DRIVING_PERSONALITY_KEYS.includes(sparse.primary.key));

console.log("Driving personality estimates passed.");
