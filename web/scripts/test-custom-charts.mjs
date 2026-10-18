import assert from "node:assert/strict";
import { buildCustomChart, CUSTOM_CHART_LIMITS, defaultCustomChart, validateCustomCharts } from "../src/custom-charts.js";

const unsafe = Array.from({ length: CUSTOM_CHART_LIMITS.charts + 5 }, (_, index) => ({
  id: index < 2 ? "duplicate" : `chart-${index}`,
  title: ` Chart ${index} \u0000 `,
  description: "x".repeat(400),
  dataset: index === 3 ? "not-a-dataset" : "daily",
  type: index === 4 ? "script" : "line",
  x: "date",
  y: ["distanceKm", "distanceKm", "netEnergyKwh", "regeneratedKwh", "wallEnergyKwh", "not-a-field"],
  period: "all",
  groupBy: "day",
}));
const cleaned = validateCustomCharts(unsafe);
assert.equal(cleaned.length, CUSTOM_CHART_LIMITS.charts);
assert.equal(new Set(cleaned.map((chart) => chart.id)).size, cleaned.length);
assert.ok(cleaned.every((chart) => chart.title.length <= CUSTOM_CHART_LIMITS.title));
assert.ok(cleaned.every((chart) => chart.description.length <= CUSTOM_CHART_LIMITS.description));
assert.ok(cleaned.every((chart) => chart.y.length <= CUSTOM_CHART_LIMITS.series));
assert.ok(cleaned.every((chart) => !chart.y.includes("not-a-field")));

const collisionSafe = validateCustomCharts([
  { ...defaultCustomChart(), id: "chart-3" },
  { ...defaultCustomChart(), id: "chart" },
  { ...defaultCustomChart(), id: "chart" },
]);
assert.equal(new Set(collisionSafe.map((chart) => chart.id)).size, collisionSafe.length, "generated IDs must remain unique even when a suffix already exists");
const invalidDates = validateCustomCharts([{ ...defaultCustomChart(), id: "dates", period: "custom", start: "2026-99-99", end: "2026-02-30" }])[0];
assert.equal(invalidDates.start, "");
assert.equal(invalidDates.end, "");

const data = {
  daily: [
    { date: "2026-10-02", distanceKm: 30, netEnergyKwh: 5, regeneratedKwh: 2 },
    { date: "2026-10-01", distanceKm: 20, netEnergyKwh: 4, regeneratedKwh: 1 },
  ],
  trips: [
    { startedAtUtc: "2026-10-16T08:00:00Z", distanceKm: 40, durationMinutes: 60 },
    { startedAtUtc: "2026-09-01T08:00:00Z", distanceKm: 10, durationMinutes: 20 },
  ],
};
const line = buildCustomChart(data, { ...defaultCustomChart(), id: "line", y: ["distanceKm", "netEnergyKwh"] }, { system: "metric", pressure: "bar" }, "en");
assert.equal(line.rows.length, 2);
assert.equal(line.series.length, 2);
assert.equal(line.rows[0].distanceKm, 20);
const imperial = buildCustomChart(data, { ...defaultCustomChart(), id: "imperial", y: ["distanceKm"] }, { system: "imperial", pressure: "psi" }, "en");
assert.ok(imperial.rows[0].distanceKm > 12 && imperial.rows[0].distanceKm < 13);
const histogram = buildCustomChart(data, { ...defaultCustomChart(), id: "histogram", type: "histogram", x: "distanceKm", y: [] }, { system: "metric", pressure: "bar" }, "en");
assert.ok(histogram.rows.reduce((total, row) => total + row.__count, 0) === 2);
const recentTripHistogram = buildCustomChart(data, { ...defaultCustomChart("trips"), id: "recent-histogram", type: "histogram", x: "distanceKm", y: [], period: "7" }, { system: "metric", pressure: "bar" }, "en");
assert.equal(recentTripHistogram.rows.reduce((total, row) => total + row.__count, 0), 1, "time periods must also filter charts with a numeric X axis");

console.log("Custom chart validation and calculations passed.");
