import assert from "node:assert/strict";
import { detectPersonalAnomalies } from "../src/anomaly-detection.js";

const dates = Array.from({ length: 12 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
const result = detectPersonalAnomalies({
  daily: dates.map((date, index) => ({ date, distanceKm: 30, consumptionKwh100: index === 11 ? 29 : 18 + (index % 2) * .3 })),
  charges: dates.slice(0, 8).map((date, index) => ({ date, chargeId: `c${index}`, chargeType: "AC", wallEnergyKwh: 20, efficiencyPct: index === 7 ? 75 : 92 + (index % 2) * .2 })),
  battery: {
    parking: dates.slice(0, 8).map((date, index) => ({ startedAtUtc: `${date}T20:00:00Z`, stopId: `p${index}`, durationHours: 10, coveragePct: 90, confidence: "high", socLossPerDay: index === 7 ? 2.5 : .25 + (index % 2) * .03 })),
    daily: dates.map((date, index) => ({ date, batteryTempMaxC: index === 11 ? 48 : 25 + (index % 2) })),
    tyres: dates.map((date, index) => ({ date, averageKpa: index === 11 ? 225 : 255 + (index % 2), frontImbalanceKpa: index === 10 ? 18 : 2, rearImbalanceKpa: 1 })),
  },
});
const metrics = new Set(result.anomalies.map((row) => row.metric));
assert.ok(metrics.has("consumption"));
assert.ok(metrics.has("parkedLoss"));
assert.ok(metrics.has("chargingEfficiency"));
assert.ok(metrics.has("batteryTemperature"));
assert.ok(metrics.has("tyrePressure"));
assert.ok(metrics.has("tyreImbalance"));
assert.equal(result.coverage.consumption.ready, true);
assert.equal(result.coverage.chargingEfficiency.ready, true);
assert.ok(result.anomalies.every((row) => row.comparisonSamples >= 5));
assert.deepEqual(detectPersonalAnomalies({}).anomalies, []);

console.log("Personal anomaly detection passed.");
