import assert from "node:assert/strict";
import {
  dismissObservation,
  insightObservationId,
  qualityObservationId,
  readDismissed,
  restoreObservations,
  writeDismissed,
} from "../src/observation-dismissals.js";

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

const quality = { rule: "odometer_coverage_gap", family: "operation", startedAtUtc: "2026-10-02T08:00:00Z", endedAtUtc: "2026-10-02T08:12:00Z", severity: "medium" };
const insight = { metric: "consumption", group: "urban", date: "2026-10-02", sourceId: "trip-1", direction: "high" };
assert.equal(readDismissed("quality", storage).size, 0);
assert.equal(dismissObservation("quality", qualityObservationId(quality), storage).has(qualityObservationId(quality)), true);
assert.equal(readDismissed("quality", storage).size, 1);
assert.equal(writeDismissed("insights", [insightObservationId(insight), insightObservationId(insight)], storage).size, 1);
assert.equal(restoreObservations("quality", storage).size, 0);
assert.equal(readDismissed("quality", storage).size, 0);
console.log("Dismissible observations passed.");
