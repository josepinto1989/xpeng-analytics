import assert from "node:assert/strict";
import { createGoogleDriveClient, googleDriveConstants, googleDriveTestHelpers, readGoogleDriveSettings } from "../src/google-drive.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
let folderCreated = false;
let backupCreated = false;
const calls = [];
const backupPayload = new Blob([new Uint8Array([88, 80, 69, 78, 71, 65, 0, 5, 1, 2, 3])]);

const jsonResponse = (value, init = {}) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json", ...(init.headers || {}) }, ...init });
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET", authorization: options.headers?.Authorization, body: options.body });
  assert.equal(options.headers?.Authorization, "Bearer unit-test-token");
  if (String(url).includes("/upload/drive/v3/files") && options.method === "POST") {
    return jsonResponse({}, { headers: { Location: "https://upload.example/session" } });
  }
  if (String(url) === "https://upload.example/session" && options.method === "PUT") {
    backupCreated = true;
    assert.equal(options.body, backupPayload);
    return jsonResponse({ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"] });
  }
  if (String(url).includes("/files/folder-1?")) return jsonResponse({ id: "folder-1", name: googleDriveConstants.FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", trashed: false });
  if (String(url).includes("/files/old-account-file?")) return jsonResponse({ error: { message: "File not found" } }, { status: 404 });
  if (String(url).includes("/files/backup-1?") && !String(url).includes("alt=media")) return jsonResponse({ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"], trashed: false });
  if (String(url).includes("/files/backup-1?alt=media")) return new Response(backupPayload, { status: 200, headers: { "Content-Type": googleDriveConstants.HISTORY_MIME } });
  if (String(url).includes("/files?") && String(url).includes("application%2Fvnd.google-apps.folder")) {
    return jsonResponse({ files: folderCreated ? [{ id: "folder-1", name: googleDriveConstants.FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }] : [] });
  }
  if (String(url).includes("/files?") && String(url).includes("xpeng-analytics-history.xpeng")) {
    return jsonResponse({ files: backupCreated ? [{ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"] }] : [] });
  }
  if (String(url).includes("/files?") && String(url).includes("appProperties")) {
    return jsonResponse({ files: backupCreated ? [{ id: "backup-1", name: googleDriveConstants.HISTORY_NAME, modifiedTime: "2026-10-18T12:00:00Z", size: String(backupPayload.size), parents: ["folder-1"] }] : [] });
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
const uploaded = await client.uploadHistory(backupPayload);
assert.equal(uploaded.file.id, "backup-1");
assert.equal(readGoogleDriveSettings(storage).fileId, "backup-1");
const uploadStartCall = calls.find((call) => call.method === "POST" && call.url.includes("upload/drive/v3/files"));
assert.equal(JSON.parse(uploadStartCall.body).appProperties[googleDriveConstants.HISTORY_APP_PROPERTY], googleDriveConstants.HISTORY_APP_PROPERTY_VALUE);

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
console.log(`Google Drive backup client passed (${calls.length} API requests mocked).`);
