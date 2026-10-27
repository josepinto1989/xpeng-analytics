import assert from "node:assert/strict";
import { assessBatteryHealth } from "../src/battery-health.js";

assert.deepEqual(assessBatteryHealth([]), {
  level: "insufficient", score: 0, sampleCount: 0, spanDays: 0, capacityMedianKwh: null,
  variabilityPct: null, medianSocGainPct: null, relativeChangePct: null,
  reasons: ["fewSamples", "shortWindow"],
});

const sparse = assessBatteryHealth([
  { date: "2026-10-01", capacityKwh: 68, rollingCapacityKwh: 68, socGainPct: 25 },
  { date: "2026-10-05", capacityKwh: 70, rollingCapacityKwh: 69, socGainPct: 30 },
]);
assert.equal(sparse.level, "insufficient");
assert.equal(sparse.sampleCount, 2);
assert.equal(sparse.spanDays, 4);

const strong = assessBatteryHealth(Array.from({ length: 10 }, (_, index) => ({
  date: `2026-${String(index + 1).padStart(2, "0")}-01`,
  capacityKwh: 68 + (index % 2 ? .3 : -.2),
  rollingCapacityKwh: 68 - index * .03,
  socGainPct: 55,
})));
assert.equal(strong.level, "high");
assert.equal(strong.sampleCount, 10);
assert.ok(strong.score >= 75);
assert.ok(strong.variabilityPct < 1);
assert.ok(strong.relativeChangePct < 0);

console.log("Battery health confidence passed.");
