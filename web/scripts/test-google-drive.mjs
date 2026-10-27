import assert from "node:assert/strict";
import { createGoogleDriveClient, googleDriveConstants, googleDriveTestHelpers, readGoogleDriveSettings } from "../src/google-drive.js";
import { buildDriveBackupMetadata, detectLikelyImportGaps, telemetryCoverage } from "../src/drive-backup-metadata.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
let folderCreated = false;
let backupCreated = false;
let originalFolderCreated = false;
let gpsFolderCreated = false;
let currentProperties = {};
const recoveryFiles = [];
const originalFiles = [];
const gpsFiles = [];
let failNextUpload = false;
let pendingUpload = "history";
const calls = [];
const backupPayload = new Blob([new Uint8Array([88, 80, 69, 78, 71, 65, 0, 5, 1, 2, 3])]);
const originalPayload = new Blob([new Uint8Array([80, 75, 3, 4, 9, 8, 7])], { type: "application/zip" });
Object.defineProperty(originalPayload, "name", { value: "DA20261026000000TEST.zip" });
const gpsPayload = new Blob(["<gpx><trk/></gpx>"], { type: "application/gpx+xml" });
Object.defineProperty(gpsPayload, "name", { value: "route-2026-10-26.gpx" });

const jsonResponse = (value, init = {}) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json", ...(init.headers || {}) }, ...init });
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET", authorization: options.headers?.Authorization, body: options.body });
  assert.equal(options.headers?.Authorization, "Bearer unit-test-token");
  if (String(url).includes("/about?")) return jsonResponse({ user: { displayName: "Test Driver", emailAddress: "synthetic-account" } });
  if (String(url).includes("/upload/drive/v3/files") && ["POST", "PATCH"].includes(options.method)) {
    const metadata = JSON.parse(options.body);
    pendingUpload = metadata.appProperties?.[googleDriveConstants.GPS_ARCHIVE_PROPERTY] ? "gps" : metadata.appProperties?.[googleDriveConstants.ORIGINAL_ARCHIVE_PROPERTY] ? "original" : "history";
    currentProperties = metadata.appProperties || currentProperties;
    return jsonResponse({}, { headers: { Location: `https://upload.example/session-${pendingUpload}` } });
  }
  if (String(url) === "https://upload.example/session-history" && options.method === "PUT") {
    if (String(options.headers?.["Content-Range"] || "").startsWith("bytes */")) return new Response(null, { status: 308 });
    if (failNextUpload) {
      failNextUpload = false;
      throw new TypeError("Simulated interrupted upload");
    }
    backupCreated = true;
    assert.equal(options.body, backupPayload);
    return jsonResponse({ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"], appProperties: currentProperties });
  }
  if (String(url) === "https://upload.example/session-original" && options.method === "PUT") {
    assert.equal(options.body, originalPayload);
    const file = { id: "original-1", name: originalPayload.name, createdTime: "2026-10-26T12:00:00Z", modifiedTime: "2026-10-26T12:00:00Z", size: String(originalPayload.size), parents: ["original-folder-1"], appProperties: currentProperties };
    originalFiles.splice(0, originalFiles.length, file);
    return jsonResponse(file);
  }
  if (String(url) === "https://upload.example/session-gps" && options.method === "PUT") {
    assert.equal(options.body, gpsPayload);
    const file = { id: "gps-1", name: gpsPayload.name, createdTime: "2026-10-26T13:00:00Z", modifiedTime: "2026-10-26T13:00:00Z", size: String(gpsPayload.size), parents: ["gps-folder-1"], appProperties: currentProperties };
    gpsFiles.splice(0, gpsFiles.length, file);
    return jsonResponse(file);
  }
  if (String(url).includes("/files/folder-1?")) return jsonResponse({ id: "folder-1", name: googleDriveConstants.FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", trashed: false });
  if (String(url).includes("/files/original-folder-1?")) return jsonResponse({ id: "original-folder-1", name: googleDriveConstants.ORIGINAL_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"], trashed: false });
  if (String(url).includes("/files/gps-folder-1?")) return jsonResponse({ id: "gps-folder-1", name: googleDriveConstants.GPS_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"], trashed: false });
  if (String(url).includes("/files/original-1?alt=media")) return new Response(originalPayload, { status: 200, headers: { "Content-Type": "application/zip" } });
  if (String(url).includes("/files/original-1?") && options.method === "PATCH") {
    originalFiles.length = 0;
    return jsonResponse({ id: "original-1", trashed: true });
  }
  if (String(url).includes("/files/original-1?")) return jsonResponse({ ...originalFiles[0], trashed: false });
  if (String(url).includes("/files/gps-1?alt=media")) return new Response(gpsPayload, { status: 200, headers: { "Content-Type": "application/gpx+xml" } });
  if (String(url).includes("/files/gps-1?") && options.method === "PATCH") {
    gpsFiles.length = 0;
    return jsonResponse({ id: "gps-1", trashed: true });
  }
  if (String(url).includes("/files/gps-1?")) return jsonResponse({ ...gpsFiles[0], trashed: false });
  if (String(url).includes("/files/backup-1/copy?") && options.method === "POST") {
    const body = JSON.parse(options.body);
    const recovery = { id: `recovery-${recoveryFiles.length + 1}`, name: body.name, modifiedTime: `2026-10-18T12:0${recoveryFiles.length + 1}:00Z`, createdTime: `2026-10-18T12:0${recoveryFiles.length + 1}:00Z`, size: String(backupPayload.size), parents: ["folder-1"], appProperties: body.appProperties };
    recoveryFiles.unshift(recovery);
    return jsonResponse(recovery);
  }
  if (String(url).includes("/files/old-account-file?")) return jsonResponse({ error: { message: "File not found" } }, { status: 404 });
  if (String(url).includes("/files/backup-1?") && !String(url).includes("alt=media")) return jsonResponse({ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"], trashed: false, appProperties: currentProperties });
  const recoveryMatch = String(url).match(/\/files\/(recovery-\d+)\?/);
  if (recoveryMatch && options.method === "PATCH") {
    const index = recoveryFiles.findIndex((file) => file.id === recoveryMatch[1]);
    if (index >= 0) recoveryFiles.splice(index, 1);
    return jsonResponse({ id: recoveryMatch[1], trashed: true });
  }
  if (recoveryMatch && !String(url).includes("alt=media")) return jsonResponse({ ...recoveryFiles.find((file) => file.id === recoveryMatch[1]), trashed: false });
  if (recoveryMatch && String(url).includes("alt=media")) return new Response(backupPayload, { status: 200, headers: { "Content-Type": googleDriveConstants.HISTORY_MIME } });
  if (String(url).includes("/files/backup-1?alt=media")) return new Response(backupPayload, { status: 200, headers: { "Content-Type": googleDriveConstants.HISTORY_MIME } });
  if (String(url).includes("/files?") && String(url).includes("application%2Fvnd.google-apps.folder")) {
    if (String(url).includes(encodeURIComponent(googleDriveConstants.GPS_FOLDER_NAME))) return jsonResponse({ files: gpsFolderCreated ? [{ id: "gps-folder-1", name: googleDriveConstants.GPS_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"] }] : [] });
    if (String(url).includes(encodeURIComponent(googleDriveConstants.ORIGINAL_FOLDER_NAME))) return jsonResponse({ files: originalFolderCreated ? [{ id: "original-folder-1", name: googleDriveConstants.ORIGINAL_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"] }] : [] });
    if (String(url).includes(encodeURIComponent(googleDriveConstants.LEGACY_ORIGINAL_FOLDER_NAME))) return jsonResponse({ files: [] });
    return jsonResponse({ files: folderCreated ? [{ id: "folder-1", name: googleDriveConstants.FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }] : [] });
  }
  if (String(url).includes("/files?") && String(url).includes(googleDriveConstants.ORIGINAL_ARCHIVE_PROPERTY)) return jsonResponse({ files: originalFiles });
  if (String(url).includes("/files?") && String(url).includes(googleDriveConstants.GPS_ARCHIVE_PROPERTY)) return jsonResponse({ files: gpsFiles });
  if (String(url).includes("/files?") && String(url).includes("xpeng-analytics-history.xpeng")) {
    return jsonResponse({ files: backupCreated ? [{ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"], appProperties: currentProperties }] : [] });
  }
  if (String(url).includes("/files?") && String(url).includes("appProperties")) {
    return jsonResponse({ files: backupCreated ? [{ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"], appProperties: currentProperties }, ...recoveryFiles] : [] });
  }
  if (String(url).endsWith("/drive/v3/files?fields=id,name,mimeType,parents") && options.method === "POST") {
    const body = JSON.parse(options.body);
    if (body.name === googleDriveConstants.GPS_FOLDER_NAME) {
      gpsFolderCreated = true;
      return jsonResponse({ id: "gps-folder-1", name: googleDriveConstants.GPS_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"] });
    }
    originalFolderCreated = true;
    return jsonResponse({ id: "original-folder-1", name: googleDriveConstants.ORIGINAL_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: ["folder-1"] });
  }
  if (String(url).endsWith("/drive/v3/files?fields=id,name,mimeType") && options.method === "POST") {
    folderCreated = true;
    return jsonResponse({ id: "folder-1", name: googleDriveConstants.FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" });
  }
  throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
};

const loadIdentity = async () => ({
  accounts: {
    oauth2: {
      initTokenClient: ({ callback }) => ({
        callback,
        requestAccessToken() { this.callback({ access_token: "unit-test-token", expires_in: 3600 }); },
      }),
    },
  },
});

const client = createGoogleDriveClient({ clientId: "test.apps.googleusercontent.com", fetchImpl, storage, loadIdentity });
assert.equal(client.configured(), true);
await client.authorise();
assert.equal(client.isAuthorised(), true);

const initial = await client.refreshBackup();
assert.equal(initial.exists, false);
assert.equal(initial.user.emailAddress, "synthetic-account");
const metadata = { coverageStartUtc: "2026-09-01T00:00:00.000Z", coverageEndUtc: "2026-10-18T12:00:00.000Z", historyVersion: 5, importCount: 3 };
const uploaded = await client.uploadHistory(backupPayload, metadata);
assert.equal(uploaded.file.id, "backup-1");
assert.equal(uploaded.file.historyVersion, 5);
assert.equal(readGoogleDriveSettings(storage).fileId, "backup-1");
const uploadStartCall = calls.find((call) => call.method === "POST" && call.url.includes("upload/drive/v3/files"));
assert.equal(JSON.parse(uploadStartCall.body).appProperties[googleDriveConstants.HISTORY_APP_PROPERTY], googleDriveConstants.HISTORY_APP_PROPERTY_VALUE);
assert.equal(JSON.parse(uploadStartCall.body).appProperties[googleDriveConstants.BACKUP_ROLE_PROPERTY], googleDriveConstants.BACKUP_ROLE_CURRENT);

const updated = await client.uploadHistory(backupPayload, { ...metadata, coverageEndUtc: "2026-10-25T12:00:00.000Z", importCount: 4 });
assert.equal(updated.backups.filter((file) => file.role === googleDriveConstants.BACKUP_ROLE_RECOVERY).length, 1);
assert.equal(updated.backups.find((file) => file.role === googleDriveConstants.BACKUP_ROLE_CURRENT).coverageEndUtc, "2026-10-25T12:00:00.000Z");
const recovery = updated.backups.find((file) => file.role === googleDriveConstants.BACKUP_ROLE_RECOVERY);
const recovered = await client.downloadHistory(recovery.id);
assert.equal(recovered.file.role, googleDriveConstants.BACKUP_ROLE_RECOVERY);
for (let index = 0; index < 4; index += 1) await client.uploadHistory(backupPayload, { ...metadata, coverageEndUtc: `2026-10-${26 + index}T12:00:00.000Z`, importCount: 5 + index });
assert.equal((await client.listBackups()).filter((file) => file.role === googleDriveConstants.BACKUP_ROLE_RECOVERY).length, googleDriveConstants.RECOVERY_LIMIT);
failNextUpload = true;
const resumed = await client.uploadHistory(backupPayload, metadata);
assert.equal(resumed.file.id, "backup-1");

client.setArchiveOriginals(true);
assert.equal(readGoogleDriveSettings(storage).archiveOriginals, true);
const originalDigest = "a".repeat(64);
const archived = await client.uploadOriginalExport(originalPayload, { sha256: originalDigest, coverageStartUtc: "2026-10-01T00:00:00Z", coverageEndUtc: "2026-10-26T00:00:00Z" });
assert.equal(archived.skipped, false);
assert.equal(archived.file.digest, originalDigest);
assert.equal((await client.listOriginalExports()).length, 1);
const duplicateOriginal = await client.uploadOriginalExport(originalPayload, { sha256: originalDigest });
assert.equal(duplicateOriginal.skipped, true);
const originalDownload = await client.downloadOriginalExport("original-1");
assert.deepEqual(new Uint8Array(await originalDownload.blob.arrayBuffer()), new Uint8Array(await originalPayload.arrayBuffer()));
assert.equal((await client.deleteOriginalExport("original-1")).originals.length, 0);

client.setArchiveGps(true);
assert.equal(readGoogleDriveSettings(storage).archiveGps, true);
const gpsDigest = "b".repeat(64);
const gpsArchived = await client.uploadGpsExport(gpsPayload, { sha256: gpsDigest });
assert.equal(gpsArchived.skipped, false);
assert.equal(gpsArchived.file.digest, gpsDigest);
assert.equal((await client.uploadGpsExport(gpsPayload, { sha256: gpsDigest })).skipped, true);
const gpsDownload = await client.downloadOriginalExport("gps-1");
assert.deepEqual(new Uint8Array(await gpsDownload.blob.arrayBuffer()), new Uint8Array(await gpsPayload.arrayBuffer()));
assert.equal((await client.deleteOriginalExport("gps-1")).gpsOriginals.length, 0);

const downloaded = await client.downloadHistory();
assert.deepEqual(new Uint8Array(await downloaded.blob.arrayBuffer()), new Uint8Array(await backupPayload.arrayBuffer()));
assert.equal(downloaded.file.id, "backup-1");

// A fresh client in the same browser must use the persisted file ID directly,
// avoiding the eventual-consistency window of Drive list queries.
const restarted = createGoogleDriveClient({ clientId: "test.apps.googleusercontent.com", fetchImpl, storage, loadIdentity });
await restarted.authorise();
const restoredAfterRestart = await restarted.downloadHistory();
assert.equal(restoredAfterRestart.file.id, "backup-1");
assert.deepEqual(new Uint8Array(await restoredAfterRestart.blob.arrayBuffer()), new Uint8Array(await backupPayload.arrayBuffer()));

// A different browser/device has no cached IDs and must discover the marked
// app-created file. A stale ID left by another Google account must also fall
// back to that discovery path.
const otherDeviceStorage = new MemoryStorage();
const otherDevice = createGoogleDriveClient({ clientId: "test.apps.googleusercontent.com", fetchImpl, storage: otherDeviceStorage, loadIdentity });
await otherDevice.authorise();
const discovered = await otherDevice.refreshBackup();
assert.equal(discovered.exists, true);
assert.equal(readGoogleDriveSettings(otherDeviceStorage).fileId, "backup-1");

const switchedAccountStorage = new MemoryStorage();
switchedAccountStorage.setItem(googleDriveTestHelpers.SETTINGS_KEY, JSON.stringify({ fileId: "old-account-file" }));
const switchedAccount = createGoogleDriveClient({ clientId: "test.apps.googleusercontent.com", fetchImpl, storage: switchedAccountStorage, loadIdentity });
await switchedAccount.authorise();
const rediscovered = await switchedAccount.refreshBackup();
assert.equal(rediscovered.exists, true);
assert.equal(readGoogleDriveSettings(switchedAccountStorage).fileId, "backup-1");

client.setAutoSync(true);
assert.equal(readGoogleDriveSettings(storage).autoSync, true);
assert.equal(googleDriveTestHelpers.escapeDriveQuery("Jose's \\ Drive"), "Jose\\'s \\\\ Drive");
assert.ok(calls.length >= 8);

const sampleSnapshot = {
  generatedAtUtc: "2026-10-25T13:00:00Z",
  overview: { firstUtc: "2026-09-01T08:00:00Z", lastUtc: "2026-10-25T12:00:00Z" },
  quality: { coverage: [{ firstUtc: "2026-08-31T23:00:00Z", lastUtc: "2026-10-25T12:30:00Z" }] },
  imports: [
    { sourceStartUtc: "2026-09-01T00:00:00Z", sourceEndUtc: "2026-09-30T23:00:00Z" },
    { sourceStartUtc: "2026-10-05T00:00:00Z", sourceEndUtc: "2026-10-25T12:00:00Z" },
  ],
};
assert.deepEqual(telemetryCoverage(sampleSnapshot), { startUtc: "2026-08-31T23:00:00.000Z", endUtc: "2026-10-25T12:30:00.000Z" });
assert.equal(buildDriveBackupMetadata(sampleSnapshot, 5).importCount, 2);
assert.equal(detectLikelyImportGaps(sampleSnapshot.imports).length, 1);
console.log(`Google Drive backup client passed (${calls.length} API requests mocked).`);
