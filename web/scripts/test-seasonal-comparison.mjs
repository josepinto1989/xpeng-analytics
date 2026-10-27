import assert from "node:assert/strict";
import { buildSeasonalPeriods, compareSeasonalPeriods } from "../src/seasonal-comparison.js";

const daily = [], journeys = [], batteryDaily = [], contexts = [];
for (const [month, distance, consumption, temperature] of [["2026-01", 20, 20, 8], ["2026-04", 25, 17, 20]]) {
  for (let day = 1; day <= 20; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    daily.push({ date, distanceKm: distance, netEnergyKwh: distance * consumption / 100, regeneratedKwh: 1 });
    journeys.push({ date, journeyId: date, gps: day % 2 ? { segments: [[1, 2]] } : null });
    batteryDaily.push({ date, batteryTempMaxC: temperature });
    contexts.push({ date, context: day % 2 ? "urban" : "road", seconds: 1200, distanceKm: distance });
  }
}
const periods = buildSeasonalPeriods({ daily, journeys, battery: { daily: batteryDaily }, driving: { contexts } });
assert.equal(periods.length, 2);
assert.equal(periods[0].season, "winter");
assert.equal(periods[1].season, "spring");
assert.equal(periods[0].sufficient, true);
assert.equal(periods[1].gpsCoveragePct, 50);
const comparison = compareSeasonalPeriods(periods[1], periods[0]);
assert.equal(comparison.comparable, true);
assert.ok(comparison.deltas.consumption < 0);
assert.equal(comparison.deltas.temperature, 12);
assert.equal(compareSeasonalPeriods(periods[0], periods[0]).comparable, false);
assert.deepEqual(buildSeasonalPeriods({}), []);

console.log("Seasonal comparison passed.");
