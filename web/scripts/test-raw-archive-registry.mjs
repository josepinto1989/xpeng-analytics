import assert from "node:assert/strict";
import { driveRegistryUpdates, mergeRawArchiveRegistry, normaliseRawArchiveRegistry, planRawFileRetention } from "../src/raw-archive-registry.js";

const file = (id, digest, start, end, createdTime) => ({
  id,
  name: `${id}.zip`,
  digest,
  size: "1024",
  coverageStartUtc: `${start}T00:00:00.000Z`,
  coverageEndUtc: `${end}T23:59:59.000Z`,
  createdTime: `${createdTime}T12:00:00.000Z`,
});

const files = [
  file("raw-a", "a".repeat(64), "2026-01-01", "2026-01-30", "2026-01-31"),
  file("raw-b", "b".repeat(64), "2026-01-08", "2026-02-06", "2026-02-07"),
  file("raw-c", "c".repeat(64), "2026-01-15", "2026-02-13", "2026-02-14"),
  file("raw-d", "d".repeat(64), "2026-02-10", "2026-03-11", "2026-03-12"),
];

const plan = planRawFileRetention(files);
assert.equal(plan.overlapDays, 1);
assert.deepEqual(plan.retained.map((item) => item.id), ["raw-a", "raw-c", "raw-d"]);
assert.deepEqual(plan.retired.map((item) => item.id), ["raw-b"]);

const previousPolicyFiles = [
  file("policy-a", "1".repeat(64), "2026-01-01", "2026-01-10", "2026-01-11"),
  file("policy-b", "2".repeat(64), "2026-01-06", "2026-01-15", "2026-01-16"),
  file("policy-c", "3".repeat(64), "2026-01-09", "2026-01-30", "2026-01-31"),
];
const previousPolicyPlan = planRawFileRetention(previousPolicyFiles, { overlapDays: 4 });
assert.deepEqual(previousPolicyPlan.retained.map((item) => item.id), ["policy-a", "policy-b", "policy-c"]);
const revisedPolicyPlan = planRawFileRetention(previousPolicyFiles);
assert.deepEqual(revisedPolicyPlan.retained.map((item) => item.id), ["policy-a", "policy-c"]);
assert.deepEqual(revisedPolicyPlan.retired.map((item) => item.id), ["policy-b"]);

const replacement = file("raw-new", "e".repeat(64), "2026-01-01", "2026-03-20", "2026-03-21");
const replacementPlan = planRawFileRetention([...files, replacement]);
assert.deepEqual(replacementPlan.retained.map((item) => item.id), ["raw-new"]);
assert.equal(replacementPlan.retired.length, files.length);

const unknown = { id: "raw-unknown", name: "unknown.zip", digest: "f".repeat(64), size: "10" };
assert.ok(planRawFileRetention([replacement, unknown]).retained.some((item) => item.id === "raw-unknown"));

const updates = driveRegistryUpdates([...files, replacement], replacementPlan.retired, "2026-03-21T13:00:00.000Z");
assert.equal(updates.find((item) => item.sha256 === "e".repeat(64)).driveStatus, "retained");
assert.equal(updates.find((item) => item.sha256 === "a".repeat(64)).driveStatus, "retired");
assert.equal(updates.find((item) => item.sha256 === "a".repeat(64)).replacedBySha256, "e".repeat(64));

const registry = normaliseRawArchiveRegistry([], [{ name: "legacy.zip", sha256: "1".repeat(64), rows: 12, sourceStartUtc: "2026-01-01T00:00:00Z", sourceEndUtc: "2026-01-02T00:00:00Z" }]);
assert.equal(registry[0].driveStatus, "not_archived");
const merged = mergeRawArchiveRegistry(registry, [{ sha256: "1".repeat(64), driveStatus: "retained", driveFileId: "drive-1" }]);
assert.equal(merged[0].driveStatus, "retained");
assert.equal(merged[0].driveFileId, "drive-1");
assert.equal(merged[0].rows, 12);

console.log("Raw original retention registry passed.");
