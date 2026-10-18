const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const HISTORY_MIME = "application/vnd.xpeng.analytics-history";
const FOLDER_NAME = "XPENG Analytics";
const HISTORY_NAME = "xpeng-analytics-history.xpeng";
const HISTORY_APP_PROPERTY = "xpengAnalyticsHistory";
const HISTORY_APP_PROPERTY_VALUE = "1";
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
  if (response.status === 401 || response.status === 403) error.code = reason === "storageQuotaExceeded" ? "driveQuota" : "driveAuthorisation";
  else if (response.status === 404) error.code = "driveFileMissing";
  else if (response.status === 429) error.code = "driveRateLimit";
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
    folderId: typeof stored.folderId === "string" ? stored.folderId : null,
    fileId: typeof stored.fileId === "string" ? stored.fileId : null,
    modifiedTime: typeof stored.modifiedTime === "string" ? stored.modifiedTime : null,
    size: Number(stored.size || 0),
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

  const request = async (url, options = {}) => {
    if (!accessToken || Date.now() >= expiresAt - 60_000) throw Object.assign(new Error("Google Drive needs to be reconnected."), { code: "driveReconnect" });
    let response;
    try {
      response = await fetchImpl(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
    } catch (cause) {
      throw Object.assign(new Error("Google Drive could not be reached.", { cause }), { code: "driveNetwork" });
    }
    if (!response.ok) throw parseDriveError(response, await responsePayload(response));
    return response;
  };

  const listFiles = async (q) => {
    const fields = "files(id,name,mimeType,modifiedTime,createdTime,size,parents)";
    const response = await request(`${DRIVE_API}/files?${driveQuery({ q, spaces: "drive", fields, orderBy: "modifiedTime desc", pageSize: "20" })}`);
    return (await response.json()).files || [];
  };

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

  const rememberBackup = (file, fallbackFolderId = null) => {
    if (!file) return null;
    persist({
      fileId: file.id,
      folderId: file.parents?.[0] || fallbackFolderId || settings.folderId || null,
      modifiedTime: file.modifiedTime || null,
      size: Number(file.size || 0),
    });
    return file;
  };

  const findBackup = async () => {
    // Prefer the exact ID returned by the upload. Drive list queries can take a
    // short time to reflect a newly created file, especially after a refresh.
    if (settings.fileId) {
      try {
        const response = await request(`${DRIVE_API}/files/${encodeURIComponent(settings.fileId)}?fields=id,name,modifiedTime,size,parents,trashed`);
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
    if (markedFiles.length) return rememberBackup(markedFiles[0]);

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

  const uploadHistory = async (blob) => {
    const folder = await ensureFolder();
    const current = await findBackup();
    const appProperties = { [HISTORY_APP_PROPERTY]: HISTORY_APP_PROPERTY_VALUE };
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
    const completed = await request(uploadUrl, { method: "PUT", headers: { "Content-Type": HISTORY_MIME }, body: blob });
    const file = await completed.json();
    persist({ fileId: file.id, folderId: folder.id, modifiedTime: file.modifiedTime || new Date().toISOString(), size: Number(file.size || blob.size) });
    return { ...settings, file };
  };

  const downloadHistory = async () => {
    const file = await findBackup();
    if (!file) throw Object.assign(new Error("No XPENG Analytics backup was found."), { code: "driveNoBackup" });
    const response = await request(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`);
    const blob = await response.blob();
    persist({ fileId: file.id, modifiedTime: file.modifiedTime || settings.modifiedTime, size: Number(file.size || blob.size) });
    return { file, blob };
  };

  const refreshBackup = async () => {
    const file = await findBackup();
    return { ...settings, exists: Boolean(file), file };
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
    refreshBackup,
    uploadHistory,
    downloadHistory,
  };
}

export const googleDriveConstants = { DRIVE_SCOPE, FOLDER_NAME, HISTORY_NAME, HISTORY_MIME, HISTORY_APP_PROPERTY, HISTORY_APP_PROPERTY_VALUE };
export const googleDriveTestHelpers = { escapeDriveQuery, driveQuery, SETTINGS_KEY };
