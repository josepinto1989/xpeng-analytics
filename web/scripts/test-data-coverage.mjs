import assert from "node:assert/strict";
import { buildCoverageCalendar, coverageCalendarSummary, formatCoverageDate, formatTelemetryCoverage, telemetryCoverage } from "../src/data-coverage.js";

const data = {
  overview: { firstUtc: "2026-09-10T08:00:00.000Z", lastUtc: "2026-10-18T20:00:00.000Z" },
  quality: {
    coverage: [
      { family: "operation", firstUtc: "2026-09-08T08:00:00.000Z", lastUtc: "2026-10-20T20:00:00.000Z" },
      { family: "energy", firstUtc: "2026-09-09T08:00:00.000Z", lastUtc: "2026-10-19T20:00:00.000Z" },
    ],
  },
};

assert.deepEqual(telemetryCoverage(data), {
  firstUtc: "2026-09-08T08:00:00.000Z",
  lastUtc: "2026-10-20T20:00:00.000Z",
});
assert.equal(formatCoverageDate("2026-09-08T12:00:00.000Z", "pt-PT"), "08/09/26");
assert.equal(formatCoverageDate("2026-09-08T12:00:00.000Z", "en"), "08 Sept 26");
assert.equal(formatTelemetryCoverage(data, "pt-PT"), "08/09/26 — 20/10/26");
assert.equal(telemetryCoverage({ overview: data.overview }).firstUtc, data.overview.firstUtc);
assert.equal(formatTelemetryCoverage({}, "en"), "");

const calendar = buildCoverageCalendar({
  ...data,
  journeys: [
    { date: "2026-10-10", gps: { segments: [[{ lat: 1, lon: 2 }]] } },
    { date: "2026-10-10" },
    { date: "2026-10-11" },
  ],
  charges: [{ date: "2026-10-10" }, { date: "2026-10-12" }],
  battery: {
    parking: [{ startedAtUtc: "2026-10-12T10:00:00.000Z", observedSeconds: 300 }],
    tyres: [{ date: "2026-10-11", samples: 20 }],
  },
});
assert.equal(calendar.firstDate, "2026-09-08");
assert.equal(calendar.lastDate, "2026-10-20");
assert.deepEqual(calendar.days.get("2026-10-10"), { date: "2026-10-10", journeys: 2, charges: 1, parking: 0, tyres: 0, gps: 1 });
assert.equal(calendar.days.get("2026-10-12").parking, 1);
assert.deepEqual(coverageCalendarSummary(calendar), { observedDays: 3, journeyDays: 2, chargingDays: 2, gpsDays: 1 });
assert.equal(buildCoverageCalendar({ battery: { parking: [{ startedAtUtc: "invalid", observedSeconds: 20 }] } }).days.size, 0);

console.log("Telemetry coverage range passed.");
