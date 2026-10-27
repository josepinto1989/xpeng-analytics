import assert from "node:assert/strict";
import { buildMonthlySummaries } from "../src/monthly-summary.js";

const daily = [];
for (const [month, distance, consumption] of [["2026-08", 20, 18], ["2026-09", 30, 22]]) {
  for (let day = 1; day <= 10; day++) daily.push({ date: `${month}-${String(day).padStart(2, "0")}`, distanceKm: distance, netEnergyKwh: distance * consumption / 100, regeneratedKwh: 1 });
}
const journeys = daily.map((row, index) => ({ date: row.date, journeyId: `j${index}`, gps: index % 2 ? { segments: [[1, 2]] } : null }));
const charges = [
  { date: "2026-08-03", wallEnergyKwh: 30, batteryEnergyKwh: 27 },
  { date: "2026-09-03", wallEnergyKwh: 40, batteryEnergyKwh: 36 },
];
const summaries = buildMonthlySummaries({ daily, journeys, charges, battery: {
  parking: [{ startedAtUtc: "2026-09-05T12:00:00Z", durationHours: 12, energyKwh: .4, socLossPerDay: .8 }],
  history: [{ date: "2026-09-03", capacityKwh: 68, rollingCapacityKwh: 68.5, relativeSohPct: 99 }],
  daily: [{ date: "2026-09-03", batteryTempMaxC: 32 }],
} }, { energyPrice: .2 });

assert.equal(summaries.length, 2);
assert.equal(summaries[1].distanceKm, 300);
assert.equal(Math.round(summaries[1].consumptionKwh100), 22);
assert.equal(summaries[1].gpsCoveragePct, 50);
assert.equal(summaries[1].estimatedCost, 8);
assert.equal(summaries[1].comparison.comparable, true);
assert.ok(summaries[1].comparison.changes.some((row) => row.metric === "distance"));
assert.equal(buildMonthlySummaries({}).length, 0);

console.log("Automatic monthly summary passed.");
