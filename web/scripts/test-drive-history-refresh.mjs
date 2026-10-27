import assert from "node:assert/strict";
import { rawSourcesCoverBackup } from "../src/drive-history-refresh.js";

const metadata = {
  coverageStartUtc: "2026-09-01T00:00:00.000Z",
  coverageEndUtc: "2026-10-01T00:00:00.000Z",
};

assert.equal(rawSourcesCoverBackup([
  { coverageStartUtc: "2026-09-01T00:00:00.000Z", coverageEndUtc: "2026-09-16T00:00:00.000Z" },
  { coverageStartUtc: "2026-09-15T00:00:00.000Z", coverageEndUtc: "2026-10-01T00:00:00.000Z" },
], metadata), true, "overlapping RAW exports must cover the backup");

assert.equal(rawSourcesCoverBackup([
  { coverageStartUtc: "2026-09-01T00:00:00.000Z", coverageEndUtc: "2026-09-10T00:00:00.000Z" },
  { coverageStartUtc: "2026-09-20T00:00:00.000Z", coverageEndUtc: "2026-10-01T00:00:00.000Z" },
], metadata), false, "an internal RAW coverage gap must block a destructive refresh");

assert.equal(rawSourcesCoverBackup([
  { coverageStartUtc: "2026-09-02T00:00:00.000Z", coverageEndUtc: "2026-09-30T00:00:00.000Z" },
], metadata), true, "the documented one-day boundary tolerance must be accepted");

assert.equal(rawSourcesCoverBackup([], metadata), false);
assert.equal(rawSourcesCoverBackup([{ coverageStartUtc: "invalid", coverageEndUtc: "invalid" }], metadata), false);

console.log("Drive history refresh coverage tests passed.");
