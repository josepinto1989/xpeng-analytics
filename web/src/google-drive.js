import { driveRegistryUpdates, planRawFileRetention } from "./raw-archive-registry.js";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const HISTORY_MIME = "application/vnd.xpeng.analytics-history";
const FOLDER_NAME = "XPENG Analytics";
const HISTORY_NAME = "xpeng-analytics-history.xpeng";
const HISTORY_APP_PROPERTY = "xpengAnalyticsHistory";
const HISTORY_APP_PROPERTY_VALUE = "1";
const BACKUP_ROLE_PROPERTY = "backupRole";
const BACKUP_ROLE_CURRENT = "current";
const BACKUP_ROLE_RECOVERY = "recovery";
const COVERAGE_START_PROPERTY = "coverageStart";
const COVERAGE_END_PROPERTY = "coverageEnd";
const HISTORY_VERSION_PROPERTY = "historyVersion";
const IMPORT_COUNT_PROPERTY = "importCount";
const ORIGINAL_FOLDER_NAME = "Raw Files";
const LEGACY_ORIGINAL_FOLDER_NAME = "Original XPENG exports";
const ORIGINAL_ARCHIVE_PROPERTY = "xpengOriginalExport";
const ORIGINAL_ARCHIVE_PROPERTY_VALUE = "1";
const ORIGINAL_DIGEST_PROPERTY = "sourceSha256";
const ORIGINAL_COVERAGE_START_PROPERTY = "sourceCoverageStart";
const ORIGINAL_COVERAGE_END_PROPERTY = "sourceCoverageEnd";
const GPS_FOLDER_NAME = "Original GPX files";
const GPS_ARCHIVE_PROPERTY = "xpengOriginalGps";
const GPS_ARCHIVE_PROPERTY_VALUE = "1";
const RECOVERY_LIMIT = 3;
const SETTINGS_KEY = "xpeng-analytics.google-drive.v1";
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

const defaultStorage = typeof localStorage === "undefined" ? null : localStorage;
const defaultClientId = typeof import.meta !== "undefined" ? (import.meta.env?.VITE_GOOGLE_CLIENT_ID || "").trim() : "";

function readJson(storage, key) {
  try { return JSON.parse(storage?.getItem(key) || "null") || {}; } catch { return {}; }
}

function writeJson(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* Preferences are best-effort. */ }
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function driveQuery(parameters) {
  const query = new URLSearchParams(parameters);
  return query.toString();
}

function parseDriveError(response, payload) {
  const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.status || "";
  const message = payload?.error?.message || `${response.status} ${response.statusText}`;
  const error = new Error(message);
  if (["storageQuotaExceeded", "quotaExceeded"].includes(reason)) error.code = "driveQuota";
  else if (["rateLimitExceeded", "userRateLimitExceeded", "sharingRateLimitExceeded"].includes(reason) || response.status === 429) error.code = "driveRateLimit";
  else if (response.status === 401 || response.status === 403) error.code = "driveAuthorisation";
  else if (response.status === 404) error.code = "driveFileMissing";
  else error.code = "driveNetwork";
  return error;
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export function googleDriveConfiguration(clientId = defaultClientId) {
  return { configured: Boolean(clientId), clientId };
}

export function readGoogleDriveSettings(storage = defaultStorage) {
  const stored = readJson(storage, SETTINGS_KEY);
  return {
    autoSync: stored.autoSync === true,
    archiveOriginals: stored.archiveOriginals === true,
    archiveGps: stored.archiveGps === true,
    folderId: typeof stored.folderId === "string" ? stored.folderId : null,
    originalFolderId: typeof stored.originalFolderId === "string" ? stored.originalFolderId : null,
    gpsFolderId: typeof stored.gpsFolderId === "string" ? stored.gpsFolderId : null,
    fileId: typeof stored.fileId === "string" ? stored.fileId : null,
    modifiedTime: typeof stored.modifiedTime === "string" ? stored.modifiedTime : null,
    size: Number(stored.size || 0),
    coverageStartUtc: typeof stored.coverageStartUtc === "string" ? stored.coverageStartUtc : null,
    coverageEndUtc: typeof stored.coverageEndUtc === "string" ? stored.coverageEndUtc : null,
    historyVersion: Number(stored.historyVersion || 0),
  };
}

export function createGoogleDriveClient({
  clientId = defaultClientId,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = defaultStorage,
  loadIdentity = null,
} = {}) {
  let accessToken = null;
  let expiresAt = 0;
  let tokenClient = null;
  let identityPromise = null;
  let settings = readGoogleDriveSettings(storage);

  const persist = (updates) => {
    settings = { ...settings, ...updates };
    writeJson(storage, SETTINGS_KEY, settings);
    return { ...settings };
  };

  const configured = () => Boolean(clientId && fetchImpl);

  const loadGoogleIdentity = async () => {
    if (loadIdentity) return loadIdentity();
    if (globalThis.google?.accounts?.oauth2) return globalThis.google;
    if (identityPromise) return identityPromise;
    identityPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
      const script = existing || document.createElement("script");
      const onLoad = () => globalThis.google?.accounts?.oauth2 ? resolve(globalThis.google) : reject(Object.assign(new Error("Google Identity Services did not initialise."), { code: "driveUnavailable" }));
      const onError = () => reject(Object.assign(new Error("Google Identity Services could not be loaded."), { code: "driveUnavailable" }));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (!existing) {
        script.src = GIS_SCRIPT;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
    return identityPromise;
  };

  const authorise = async ({ prompt = "select_account" } = {}) => {
    if (!configured()) throw Object.assign(new Error("Google Drive is not configured."), { code: "driveNotConfigured" });
    if (accessToken && Date.now() < expiresAt - 60_000) return true;
    const googleApi = await loadGoogleIdentity();
    return new Promise((resolve, reject) => {
      let settled = false;
      const callback = (response) => {
        if (settled) return;
        settled = true;
        if (response?.error || !response?.access_token) {
          reject(Object.assign(new Error(response?.error_description || response?.error || "Google authorisation was not completed."), { code: response?.error === "access_denied" ? "driveAccessDenied" : "driveAuthorisation" }));
          return;
        }
        accessToken = response.access_token;
        expiresAt = Date.now() + Math.max(60, Number(response.expires_in || 3600)) * 1000;
        resolve(true);
      };
      const error_callback = (response) => {
        if (settled) return;
        settled = true;
        reject(Object.assign(new Error(response?.message || response?.type || "Google authorisation was not completed."), { code: response?.type === "popup_closed" ? "driveAccessDenied" : "driveAuthorisation" }));
      };
      tokenClient = googleApi.accounts.oauth2.initTokenClient({ client_id: clientId, scope: DRIVE_SCOPE, callback, error_callback });
      tokenClient.requestAccessToken({ prompt });
    });
  };

  const request = async (url, options = {}, allowedStatuses = []) => {
    if (!accessToken || Date.now() >= expiresAt - 60_000) throw Object.assign(new Error("Google Drive needs to be reconnected."), { code: "driveReconnect" });
    let response;
    try {
      response = await fetchImpl(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
    } catch (cause) {
      throw Object.assign(new Error("Google Drive could not be reached.", { cause }), { code: "driveNetwork" });
    }
    if (!response.ok && !allowedStatuses.includes(response.status)) throw parseDriveError(response, await responsePayload(response));
    return response;
  };

  const uploadedBytes = (response) => {
    const range = response?.headers?.get("Range") || response?.headers?.get("range") || "";
    const match = range.match(/bytes=0-(\d+)/i);
    return match ? Number(match[1]) + 1 : 0;
  };

  const resumableUpload = async (uploadUrl, blob, mimeType = HISTORY_MIME) => {
    let offset = 0;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const body = offset ? blob.slice(offset) : blob;
        const headers = { "Content-Type": mimeType };
        if (offset) headers["Content-Range"] = `bytes ${offset}-${blob.size - 1}/${blob.size}`;
        const response = await request(uploadUrl, { method: "PUT", headers, body }, [308]);
        if (response.ok) return response;
        offset = uploadedBytes(response);
      } catch (error) {
        lastError = error;
        if (!["driveNetwork", "driveRateLimit"].includes(error.code)) throw error;
        try {
          const status = await request(uploadUrl, {
            method: "PUT",
            headers: { "Content-Length": "0", "Content-Range": `bytes */${blob.size}` },
          }, [308]);
          if (status.ok) return status;
          offset = uploadedBytes(status);
        } catch (statusError) {
          lastError = statusError;
        }
      }
    }
    throw Object.assign(new Error(lastError?.message || "The resumable upload did not complete."), { code: lastError?.code || "driveUpload" });
  };

  const listFiles = async (q) => {
    const fields = "files(id,name,mimeType,modifiedTime,createdTime,size,parents,appProperties)";
    const response = await request(`${DRIVE_API}/files?${driveQuery({ q, spaces: "drive", fields, orderBy: "modifiedTime desc", pageSize: "1000" })}`);
    return (await response.json()).files || [];
  };

  const account = async () => {
    const response = await request(`${DRIVE_API}/about?fields=user(displayName,emailAddress,photoLink)`);
    return (await response.json()).user || null;
  };

  const fileMetadata = (file) => ({
    ...file,
    role: file?.appProperties?.[BACKUP_ROLE_PROPERTY] || (file?.name === HISTORY_NAME ? BACKUP_ROLE_CURRENT : BACKUP_ROLE_RECOVERY),
    coverageStartUtc: file?.appProperties?.[COVERAGE_START_PROPERTY] || null,
    coverageEndUtc: file?.appProperties?.[COVERAGE_END_PROPERTY] || null,
    historyVersion: Number(file?.appProperties?.[HISTORY_VERSION_PROPERTY] || 0),
    importCount: Number(file?.appProperties?.[IMPORT_COUNT_PROPERTY] || 0),
  });

  const backupProperties = (role, metadata = {}) => ({
    [HISTORY_APP_PROPERTY]: HISTORY_APP_PROPERTY_VALUE,
    [BACKUP_ROLE_PROPERTY]: role,
    ...(metadata.coverageStartUtc ? { [COVERAGE_START_PROPERTY]: String(metadata.coverageStartUtc) } : {}),
    ...(metadata.coverageEndUtc ? { [COVERAGE_END_PROPERTY]: String(metadata.coverageEndUtc) } : {}),
    ...(metadata.historyVersion ? { [HISTORY_VERSION_PROPERTY]: String(metadata.historyVersion) } : {}),
    ...(Number.isFinite(Number(metadata.importCount)) ? { [IMPORT_COUNT_PROPERTY]: String(Number(metadata.importCount)) } : {}),
  });

  const findFolder = async () => {
    if (settings.folderId) {
      try {
        const response = await request(`${DRIVE_API}/files/${encodeURIComponent(settings.folderId)}?fields=id,name,mimeType,trashed`);
        const folder = await response.json();
        if (!folder.trashed && folder.mimeType === FOLDER_MIME) return folder;
      } catch (error) {
        if (error.code !== "driveFileMissing") throw error;
      }
    }
    const folders = await listFiles(`name='${escapeDriveQuery(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`);
    if (!folders.length) return null;
    persist({ folderId: folders[0].id });
    return folders[0];
  };

  const ensureFolder = async () => {
    const existing = await findFolder();
    if (existing) return existing;
    const response = await request(`${DRIVE_API}/files?fields=id,name,mimeType`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    });
    const folder = await response.json();
    persist({ folderId: folder.id });
    return folder;
  };

  const findOriginalFolder = async () => {
    if (settings.originalFolderId) {
      try {
        const response = await request(`${DRIVE_API}/files/${encodeURIComponent(settings.originalFolderId)}?fields=id,name,mimeType,parents,trashed`);
        const folder = await response.json();
        if (!folder.trashed && folder.mimeType === FOLDER_MIME) return folder;
      } catch (error) {
        if (error.code !== "driveFileMissing") throw error;
        persist({ originalFolderId: null });
      }
    }
    const parent = await ensureFolder();
    let folders = await listFiles(`name='${escapeDriveQuery(ORIGINAL_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and '${escapeDriveQuery(parent.id)}' in parents and trashed=false`);
    if (!folders.length) folders = await listFiles(`name='${escapeDriveQuery(LEGACY_ORIGINAL_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and '${escapeDriveQuery(parent.id)}' in parents and trashed=false`);
    if (!folders.length) return null;
    persist({ originalFolderId: folders[0].id });
    return folders[0];
  };

  const ensureOriginalFolder = async () => {
    const existing = await findOriginalFolder();
    if (existing) return existing;
    const parent = await ensureFolder();
    const response = await request(`${DRIVE_API}/files?fields=id,name,mimeType,parents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ORIGINAL_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [parent.id] }),
    });
    const folder = await response.json();
    persist({ originalFolderId: folder.id });
    return folder;
  };

  const findGpsFolder = async () => {
    if (settings.gpsFolderId) {
      try {
        const response = await request(`${DRIVE_API}/files/${encodeURIComponent(settings.gpsFolderId)}?fields=id,name,mimeType,parents,trashed`);
        const folder = await response.json();
        if (!folder.trashed && folder.mimeType === FOLDER_MIME) return folder;
      } catch (error) {
        if (error.code !== "driveFileMissing") throw error;
        persist({ gpsFolderId: null });
      }
    }
    const parent = await ensureFolder();
    const folders = await listFiles(`name='${escapeDriveQuery(GPS_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and '${escapeDriveQuery(parent.id)}' in parents and trashed=false`);
    if (!folders.length) return null;
    persist({ gpsFolderId: folders[0].id });
    return folders[0];
  };

  const ensureGpsFolder = async () => {
    const existing = await findGpsFolder();
    if (existing) return existing;
    const parent = await ensureFolder();
    const response = await request(`${DRIVE_API}/files?fields=id,name,mimeType,parents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: GPS_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [parent.id] }),
    });
    const folder = await response.json();
    persist({ gpsFolderId: folder.id });
    return folder;
  };

  const rememberBackup = (file, fallbackFolderId = null) => {
    if (!file) return null;
    persist({
      fileId: file.id,
      folderId: file.parents?.[0] || fallbackFolderId || settings.folderId || null,
      modifiedTime: file.modifiedTime || null,
      size: Number(file.size || 0),
      coverageStartUtc: file.appProperties?.[COVERAGE_START_PROPERTY] || file.coverageStartUtc || null,
      coverageEndUtc: file.appProperties?.[COVERAGE_END_PROPERTY] || file.coverageEndUtc || null,
      historyVersion: Number(file.appProperties?.[HISTORY_VERSION_PROPERTY] || file.historyVersion || 0),
    });
    return fileMetadata(file);
  };

  const findBackup = async () => {
    // Prefer the exact ID returned by the upload. Drive list queries can take a
    // short time to reflect a newly created file, especially after a refresh.
    if (settings.fileId) {
      try {
        const response = await request(`${DRIVE_API}/files/${encodeURIComponent(settings.fileId)}?fields=id,name,modifiedTime,createdTime,size,parents,trashed,appProperties`);
        const file = await response.json();
        if (!file.trashed) return rememberBackup(file);
      } catch (error) {
        if (error.code !== "driveFileMissing") throw error;
        persist({ fileId: null, modifiedTime: null, size: 0 });
      }
    }

    // appProperties are private to this OAuth application and provide a
    // stable cross-device lookup without relying on a particular folder ID.
    const markedFiles = await listFiles(`appProperties has { key='${HISTORY_APP_PROPERTY}' and value='${HISTORY_APP_PROPERTY_VALUE}' } and trashed=false`);
    const markedCurrent = markedFiles.find((file) => file.appProperties?.[BACKUP_ROLE_PROPERTY] === BACKUP_ROLE_CURRENT || file.name === HISTORY_NAME);
    if (markedCurrent) return rememberBackup(markedCurrent);

    // Backwards compatibility for backups created before appProperties were
    // added. With drive.file this still searches only files available to the
    // application, not the user's entire Drive.
    const namedFiles = await listFiles(`name='${escapeDriveQuery(HISTORY_NAME)}' and trashed=false`);
    if (namedFiles.length) return rememberBackup(namedFiles[0]);

    const folder = await findFolder();
    if (!folder) return null;
    const files = await listFiles(`name='${escapeDriveQuery(HISTORY_NAME)}' and '${escapeDriveQuery(folder.id)}' in parents and trashed=false`);
    const file = files[0] || null;
    return rememberBackup(file, folder.id);
  };

  const listBackups = async () => {
    const marked = await listFiles(`appProperties has { key='${HISTORY_APP_PROPERTY}' and value='${HISTORY_APP_PROPERTY_VALUE}' } and trashed=false`);
    const named = marked.some((file) => file.name === HISTORY_NAME)
      ? []
      : await listFiles(`name='${escapeDriveQuery(HISTORY_NAME)}' and trashed=false`);
    const unique = new Map([...marked, ...named].map((file) => [file.id, fileMetadata(file)]));
    return [...unique.values()].sort((a, b) => String(b.modifiedTime || b.createdTime || "").localeCompare(String(a.modifiedTime || a.createdTime || "")));
  };

  const originalMetadata = (file) => ({
    ...file,
    digest: file?.appProperties?.[ORIGINAL_DIGEST_PROPERTY] || null,
    coverageStartUtc: file?.appProperties?.[ORIGINAL_COVERAGE_START_PROPERTY] || null,
    coverageEndUtc: file?.appProperties?.[ORIGINAL_COVERAGE_END_PROPERTY] || null,
  });

  const listOriginalExports = async () => {
    const files = await listFiles(`appProperties has { key='${ORIGINAL_ARCHIVE_PROPERTY}' and value='${ORIGINAL_ARCHIVE_PROPERTY_VALUE}' } and trashed=false`);
    return files.map(originalMetadata).sort((a, b) => String(b.createdTime || b.modifiedTime || "").localeCompare(String(a.createdTime || a.modifiedTime || "")));
  };

  const listGpsExports = async () => {
    const files = await listFiles(`appProperties has { key='${GPS_ARCHIVE_PROPERTY}' and value='${GPS_ARCHIVE_PROPERTY_VALUE}' } and trashed=false`);
    return files.map(originalMetadata).sort((a, b) => String(b.createdTime || b.modifiedTime || "").localeCompare(String(a.createdTime || a.modifiedTime || "")));
  };

  const optimiseOriginalExports = async (additionalFiles = []) => {
    const discovered = await listOriginalExports();
    const unique = new Map([...additionalFiles, ...discovered].filter(Boolean).map((file) => [file.id, originalMetadata(file)]));
    const allFiles = [...unique.values()];
    const plan = planRawFileRetention(allFiles, { overlapDays: 4 });
    const updates = driveRegistryUpdates(allFiles, plan.retired);
    for (const file of plan.retired) {
      await request(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?fields=id,trashed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
    }
    return { originals: plan.retained, retired: plan.retired, registryUpdates: updates, overlapDays: plan.overlapDays };
  };

  const uploadOriginalExport = async (file, { sha256, coverageStartUtc = null, coverageEndUtc = null } = {}) => {
    if (!(file instanceof Blob) || !file.size || !sha256) throw Object.assign(new Error("The original XPENG export is invalid."), { code: "driveOriginalInvalid" });
    const digest = String(sha256).toLowerCase();
    const existing = (await listOriginalExports()).find((candidate) => candidate.digest === digest);
    if (existing) return { skipped: true, file: existing, ...(await optimiseOriginalExports([existing])) };
    const folder = await ensureOriginalFolder();
    const appProperties = {
      [ORIGINAL_ARCHIVE_PROPERTY]: ORIGINAL_ARCHIVE_PROPERTY_VALUE,
      [ORIGINAL_DIGEST_PROPERTY]: digest,
      ...(coverageStartUtc ? { [ORIGINAL_COVERAGE_START_PROPERTY]: String(coverageStartUtc) } : {}),
      ...(coverageEndUtc ? { [ORIGINAL_COVERAGE_END_PROPERTY]: String(coverageEndUtc) } : {}),
    };
    const mimeType = file.type || "application/zip";
    const metadata = { name: file.name || `xpeng-export-${new Date().toISOString().slice(0, 10)}.zip`, mimeType, parents: [folder.id], appProperties };
    const start = await request(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,modifiedTime,createdTime,size,parents,appProperties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    });
    const uploadUrl = start.headers.get("Location");
    if (!uploadUrl) throw Object.assign(new Error("Google Drive did not return an upload location."), { code: "driveUpload" });
    const completed = await resumableUpload(uploadUrl, file, mimeType);
    const uploaded = originalMetadata({ ...(await completed.json()), appProperties });
    return { skipped: false, file: uploaded, ...(await optimiseOriginalExports([uploaded])) };
  };

  const uploadGpsExport = async (file, { sha256 } = {}) => {
    if (!(file instanceof Blob) || !file.size || !sha256) throw Object.assign(new Error("The original GPX source is invalid."), { code: "driveGpsInvalid" });
    const digest = String(sha256).toLowerCase();
    const existing = (await listGpsExports()).find((candidate) => candidate.digest === digest);
    if (existing) return { skipped: true, file: existing, gpsOriginals: await listGpsExports() };
    const folder = await ensureGpsFolder();
    const appProperties = { [GPS_ARCHIVE_PROPERTY]: GPS_ARCHIVE_PROPERTY_VALUE, [ORIGINAL_DIGEST_PROPERTY]: digest };
    const lower = String(file.name || "").toLowerCase();
    const mimeType = file.type || (lower.endsWith(".gpx") ? "application/gpx+xml" : "application/zip");
    const metadata = { name: file.name || `gps-source-${new Date().toISOString().slice(0, 10)}.gpx`, mimeType, parents: [folder.id], appProperties };
    const start = await request(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,modifiedTime,createdTime,size,parents,appProperties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    });
    const uploadUrl = start.headers.get("Location");
    if (!uploadUrl) throw Object.assign(new Error("Google Drive did not return an upload location."), { code: "driveUpload" });
    const completed = await resumableUpload(uploadUrl, file, mimeType);
    const uploaded = originalMetadata({ ...(await completed.json()), appProperties });
    const gpsOriginals = [uploaded, ...(await listGpsExports()).filter((candidate) => candidate.id !== uploaded.id)];
    return { skipped: false, file: uploaded, gpsOriginals };
  };

  const downloadOriginalExport = async (fileId) => {
    const response = await request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,createdTime,size,parents,trashed,appProperties`);
    const file = originalMetadata(await response.json());
    const managedOriginal = file.appProperties?.[ORIGINAL_ARCHIVE_PROPERTY] === ORIGINAL_ARCHIVE_PROPERTY_VALUE || file.appProperties?.[GPS_ARCHIVE_PROPERTY] === GPS_ARCHIVE_PROPERTY_VALUE;
    if (file.trashed || !managedOriginal) throw Object.assign(new Error("The original source file was not found."), { code: "driveFileMissing" });
    const content = await request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
    return { file, blob: await content.blob() };
  };

  const deleteOriginalExport = async (fileId) => {
    await request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,trashed`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    const [originals, gpsOriginals] = await Promise.all([listOriginalExports(), listGpsExports()]);
    return { originals, gpsOriginals };
  };

  const recoveryName = (date = new Date()) => `xpeng-analytics-recovery-${date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.xpeng`;

  const preserveCurrent = async (current) => {
    if (!current) return null;
    const properties = backupProperties(BACKUP_ROLE_RECOVERY, fileMetadata(current));
    const response = await request(`${DRIVE_API}/files/${encodeURIComponent(current.id)}/copy?fields=id,name,modifiedTime,createdTime,size,parents,appProperties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: recoveryName(), appProperties: properties }),
    });
    return fileMetadata(await response.json());
  };

  const pruneRecoveries = async () => {
    const files = (await listBackups()).filter((file) => file.role === BACKUP_ROLE_RECOVERY);
    for (const file of files.slice(RECOVERY_LIMIT)) {
      await request(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?fields=id,trashed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
    }
  };

  const uploadHistory = async (blob, historyMetadata = {}) => {
    const folder = await ensureFolder();
    const current = await findBackup();
    if (current) await preserveCurrent(current);
    const appProperties = backupProperties(BACKUP_ROLE_CURRENT, historyMetadata);
    const metadata = current
      ? { name: HISTORY_NAME, appProperties }
      : { name: HISTORY_NAME, mimeType: HISTORY_MIME, parents: [folder.id], appProperties };
    const endpoint = current
      ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(current.id)}?uploadType=resumable&fields=id,name,modifiedTime,size,parents`
      : `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,modifiedTime,size,parents`;
    const start = await request(endpoint, {
      method: current ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": HISTORY_MIME,
        "X-Upload-Content-Length": String(blob.size),
      },
      body: JSON.stringify(metadata),
    });
    const uploadUrl = start.headers.get("Location");
    if (!uploadUrl) throw Object.assign(new Error("Google Drive did not return an upload location."), { code: "driveUpload" });
    const completed = await resumableUpload(uploadUrl, blob);
    const file = await completed.json();
    const enriched = fileMetadata({ ...file, appProperties });
    persist({ fileId: file.id, folderId: folder.id, modifiedTime: file.modifiedTime || new Date().toISOString(), size: Number(file.size || blob.size), coverageStartUtc: enriched.coverageStartUtc, coverageEndUtc: enriched.coverageEndUtc, historyVersion: enriched.historyVersion });
    try { await pruneRecoveries(); } catch { /* The current backup succeeded; cleanup can be retried later. */ }
    return { ...settings, file: enriched, backups: await listBackups() };
  };

  const downloadHistory = async (fileId = null) => {
    let file = null;
    if (fileId) {
      const response = await request(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,createdTime,size,parents,trashed,appProperties`);
      const candidate = await response.json();
      if (!candidate.trashed) file = fileMetadata(candidate);
    } else file = await findBackup();
    if (!file) throw Object.assign(new Error("No XPENG Analytics backup was found."), { code: "driveNoBackup" });
    const response = await request(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`);
    const blob = await response.blob();
    if (file.role === BACKUP_ROLE_CURRENT || file.name === HISTORY_NAME) persist({ fileId: file.id, modifiedTime: file.modifiedTime || settings.modifiedTime, size: Number(file.size || blob.size), coverageStartUtc: file.coverageStartUtc, coverageEndUtc: file.coverageEndUtc, historyVersion: file.historyVersion });
    return { file, blob };
  };

  const refreshBackup = async () => {
    const file = await findBackup();
    const [user, backups, originals, gpsOriginals] = await Promise.all([account(), listBackups(), listOriginalExports(), listGpsExports()]);
    return { ...settings, exists: Boolean(file), file, user, backups, originals, gpsOriginals };
  };

  const disconnect = () => {
    const token = accessToken;
    accessToken = null;
    expiresAt = 0;
    if (token && globalThis.google?.accounts?.oauth2?.revoke) globalThis.google.accounts.oauth2.revoke(token, () => {});
  };

  return {
    configured,
    authorise,
    disconnect,
    isAuthorised: () => Boolean(accessToken && Date.now() < expiresAt - 60_000),
    settings: () => ({ ...settings }),
    setAutoSync: (autoSync) => persist({ autoSync: Boolean(autoSync) }),
    setArchiveOriginals: (archiveOriginals) => persist({ archiveOriginals: Boolean(archiveOriginals) }),
    setArchiveGps: (archiveGps) => persist({ archiveGps: Boolean(archiveGps) }),
    refreshBackup,
    listBackups,
    listOriginalExports,
    listGpsExports,
    optimiseOriginalExports,
    uploadOriginalExport,
    uploadGpsExport,
    downloadOriginalExport,
    deleteOriginalExport,
    uploadHistory,
    downloadHistory,
  };
}

export const googleDriveConstants = { DRIVE_SCOPE, FOLDER_NAME, HISTORY_NAME, HISTORY_MIME, HISTORY_APP_PROPERTY, HISTORY_APP_PROPERTY_VALUE, BACKUP_ROLE_PROPERTY, BACKUP_ROLE_CURRENT, BACKUP_ROLE_RECOVERY, COVERAGE_START_PROPERTY, COVERAGE_END_PROPERTY, HISTORY_VERSION_PROPERTY, IMPORT_COUNT_PROPERTY, ORIGINAL_FOLDER_NAME, LEGACY_ORIGINAL_FOLDER_NAME, ORIGINAL_ARCHIVE_PROPERTY, ORIGINAL_ARCHIVE_PROPERTY_VALUE, ORIGINAL_DIGEST_PROPERTY, ORIGINAL_COVERAGE_START_PROPERTY, ORIGINAL_COVERAGE_END_PROPERTY, GPS_FOLDER_NAME, GPS_ARCHIVE_PROPERTY, GPS_ARCHIVE_PROPERTY_VALUE, RECOVERY_LIMIT };
export const googleDriveTestHelpers = { escapeDriveQuery, driveQuery, SETTINGS_KEY };
