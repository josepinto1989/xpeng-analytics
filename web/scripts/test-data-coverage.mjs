import assert from "node:assert/strict";
import { formatCoverageDate, formatTelemetryCoverage, telemetryCoverage } from "../src/data-coverage.js";

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

console.log("Telemetry coverage range passed.");
