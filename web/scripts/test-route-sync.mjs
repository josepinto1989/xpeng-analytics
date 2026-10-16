import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTimestampLookup, nearestTimestampPoint, telemetryPointFromChart } from "../src/route-sync.js";

const series = [
  { elapsed: 0, timestampUtc: "2026-10-15T08:00:00.000Z", speedKmh: 0 },
  { elapsed: 1, timestampUtc: "2026-10-15T08:01:00.000Z", speedKmh: 40 },
  { elapsed: 2, timestampUtc: "2026-10-15T08:02:00.000Z", speedKmh: 65 },
];
assert.equal(telemetryPointFromChart({ activePayload: [{ payload: series[1] }] }, series), series[1]);
assert.equal(telemetryPointFromChart({ activeLabel: 1.8 }, series), series[2]);
assert.equal(telemetryPointFromChart({}, series), null);

const route = [
  { timestampUtc: "2026-10-15T08:00:05.000Z", lat: 38.7, lon: -9.1 },
  { timestampUtc: "2026-10-15T08:01:04.000Z", lat: 38.71, lon: -9.11 },
  { timestampUtc: "2026-10-15T08:02:03.000Z", lat: 38.72, lon: -9.12 },
];
assert.equal(nearestTimestampPoint(route, series[1].timestampUtc), route[1]);
const lookup = createTimestampLookup([route[2], route[0], route[1]]);
assert.equal(nearestTimestampPoint(lookup, series[1].timestampUtc), route[1]);
assert.equal(nearestTimestampPoint(route, null), null);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin" \/>/);
assert.doesNotMatch(html, /content="no-referrer"/);

console.log("Journey chart-to-map synchronisation passed.");
