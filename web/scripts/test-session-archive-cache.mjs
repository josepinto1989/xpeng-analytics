import assert from "node:assert/strict";
import { forgetUploadedSessionArchives, rememberSessionArchive, sessionArchivesToUpload } from "../src/session-archive-cache.js";

const first = { kind: "xpeng", file: { name: "first.zip" }, sha256: "a".repeat(64), coverageStartUtc: "2026-09-01T00:00:00Z", coverageEndUtc: "2026-09-30T23:59:59Z" };
const second = { kind: "xpeng", file: { name: "second.zip" }, sha256: "b".repeat(64), coverageStartUtc: "2026-10-01T00:00:00Z", coverageEndUtc: "2026-10-30T23:59:59Z" };
const gps = { kind: "gps", file: { name: "route.gpx" }, sha256: "c".repeat(64) };

let cache = rememberSessionArchive([], first);
cache = rememberSessionArchive(cache, second);
cache = rememberSessionArchive(cache, gps);
cache = rememberSessionArchive(cache, { ...first, file: { name: "first-copy.zip" } });
assert.equal(cache.length, 3);
assert.equal(cache[0].file.name, "first-copy.zip");
assert.deepEqual(sessionArchivesToUpload(cache, { archiveOriginals: false, archiveGps: false }), []);
assert.deepEqual(sessionArchivesToUpload(cache, { archiveOriginals: true }).map((item) => item.sha256), [first.sha256, second.sha256]);
assert.deepEqual(sessionArchivesToUpload(cache, { archiveGps: true }).map((item) => item.sha256), [gps.sha256]);
cache = forgetUploadedSessionArchives(cache, [first]);
assert.deepEqual(cache.map((item) => item.sha256), [second.sha256, gps.sha256]);

console.log("Session archive cache passed.");
