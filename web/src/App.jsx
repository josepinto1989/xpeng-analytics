import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultLocale, translator } from "./i18n.js";
import { APP_VERSION } from "./version.js";
import { classifyLocalFiles, createImportPlan } from "./file-selection.js";
import TutorialOverlay from "./TutorialOverlay.jsx";
import { completeTutorialMode, nextTutorialMode, readTutorialState, shouldShowDashboardTutorialForHistory, tutorialStates, writeTutorialState } from "./onboarding.js";
import { createGoogleDriveClient, googleDriveConfiguration, readGoogleDriveSettings } from "./google-drive.js";
import { buildDriveBackupMetadata } from "./drive-backup-metadata.js";
import { mergeRawArchiveRegistry } from "./raw-archive-registry.js";
import { forgetUploadedSessionArchives, rememberSessionArchive, sessionArchivesToUpload } from "./session-archive-cache.js";
import {
  deletePersistentHistory,
  importReminderDays,
  importReminderEnabled,
  latestImportAt,
  readPersistentHistory,
  rememberHistoryEnabled,
  reminderDue,
  requestDurableStorage,
  savePersistentHistory,
  setImportReminderDays,
  setImportReminderEnabled,
  setRememberHistoryEnabled,
  storageEstimate,
  supportsPersistentHistory,
} from "./persistent-history.js";

const Dashboard = React.lazy(() => import("./Dashboard.jsx"));

const phaseKeys = {
  runtime_load: "phaseRuntimeLoad",
  engine_init: "phaseEngineInit",
  archive_write: "phaseArchiveWrite",
  archive_import: "phaseArchiveImport",
  analytics_rebuild: "phaseAnalyticsRebuild",
  validation: "phaseValidation",
  history_read: "phaseHistoryRead",
  history_export: "phaseHistoryExport",
  history_export_complete: "phaseHistoryExportComplete",
  persistent_history_save: "phasePersistentHistorySave",
  persistent_history_saved: "phasePersistentHistorySaved",
  drive_backup_save: "phaseDriveBackupSave",
  drive_backup_saved: "phaseDriveBackupSaved",
  drive_backup_open: "phaseDriveBackupOpen",
  drive_original_archive: "phaseDriveOriginalArchive",
  complete: "phaseComplete",
  reset: "phaseReset",
  native_ready: "phaseNativeReady",
  native_scan: "phaseNativeScan",
  native_parse: "phaseNativeParse",
  native_merge: "phaseNativeMerge",
  native_analytics: "phaseNativeAnalytics",
  native_snapshot: "phaseNativeSnapshot",
  history_segment: "phaseHistorySegment",
  gps_parse: "phaseGpsParse",
  gps_match: "phaseGpsMatch",
};

const errorKeys = {
  invalid_archive: "errorInvalidArchive",
  missing_families: "errorMissingFamilies",
  invalid_data: "errorInvalidData",
  out_of_memory: "errorMemory",
  invalid_history: "errorInvalidHistory",
  history_version: "errorHistoryVersion",
  history_integrity: "errorHistoryIntegrity",
  engine_error: "errorEngine",
  unknown_error: "errorUnknown",
  cancelled: "errorCancelled",
  invalid_selection: "errorInvalidSelection",
  multiple_histories: "errorMultipleHistories",
  invalid_gpx: "errorInvalidGpx",
  gps_trim_too_large: "errorGpsTrimTooLarge",
};

function formatNumber(value, locale, options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value ?? 0));
}

function formatDateRange(startUtc, endUtc, locale) {
  if (!startUtc || !endUtc) return null;
  const formatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  return `${formatter.format(new Date(startUtc))} — ${formatter.format(new Date(endUtc))}`;
}

function createWorker() {
  return new Worker(new URL("./engine/worker.js", import.meta.url), {
    type: "module",
    name: "xpeng-analytics-native-processor",
  });
}

function createLegacyWorker() {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  const workerUrl = new URL("import-worker.js", base);
  workerUrl.searchParams.set("v", APP_VERSION);
  return new Worker(workerUrl, {
    type: "module",
    name: "xpeng-analytics-processor",
  });
}

function isMobileDevice() {
  if (typeof navigator.userAgentData?.mobile === "boolean") return navigator.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || window.matchMedia?.("(pointer: coarse) and (max-width: 1024px)")?.matches;
}

function processingProfile() {
  const gib = 1024 ** 3;
  const reported = Number(navigator.deviceMemory || 0);
  const heap = Number(globalThis.performance?.memory?.jsHeapSizeLimit || 0);
  const mobile = isMobileDevice();
  const inferred = heap ? heap * .42 : reported ? reported * gib * .12 : mobile ? 420 * 1024 ** 2 : 1.5 * gib;
  const memoryBudgetBytes = Math.max(mobile ? 300 * 1024 ** 2 : 900 * 1024 ** 2, Math.min(mobile ? 640 * 1024 ** 2 : 2.5 * gib, inferred));
  return { mode: mobile ? "mobile" : "desktop", memoryBudgetBytes };
}

const nativeHistoryPrefix = [88, 80, 69, 78, 71, 65, 0];
const isNativeHistory = (buffer) => {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  return bytes.length === 8 && nativeHistoryPrefix.every((value, index) => bytes[index] === value) && [3, 4, 5, 6, 7].includes(bytes[7]);
};

export default function App() {
  const [locale, setLocale] = useState(defaultLocale);
  const [theme, setTheme] = useState("light");
  const [tutorialStatus, setTutorialStatus] = useState(() => readTutorialState());
  const [tutorialMode, setTutorialMode] = useState(null);
  const [dashboardTutorialEligible, setDashboardTutorialEligible] = useState(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState({ percent: 2, phase: "runtime_load" });
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [persistence, setPersistence] = useState({
    supported: supportsPersistentHistory(),
    loading: true,
    enabled: false,
    hasSavedHistory: false,
    saving: false,
    savedAtUtc: null,
    lastImportAtUtc: null,
    byteLength: 0,
    importCount: 0,
    durable: false,
    reminderEnabled: false,
    reminderDays: 30,
    reminderDue: false,
    error: null,
  });
  const [drive, setDrive] = useState(() => {
    const settings = readGoogleDriveSettings();
    return {
      configured: googleDriveConfiguration().configured,
      connected: false,
      busy: false,
      autoSync: settings.autoSync,
      archiveOriginals: settings.archiveOriginals,
      archiveGps: settings.archiveGps,
      hasBackup: Boolean(settings.fileId),
      modifiedTime: settings.modifiedTime,
      byteLength: settings.size,
      coverageStartUtc: settings.coverageStartUtc,
      coverageEndUtc: settings.coverageEndUtc,
      historyVersion: settings.historyVersion,
      account: null,
      backups: [],
      originals: [],
      gpsOriginals: [],
      originalArchiveBusy: false,
      originalArchiveError: null,
      error: null,
    };
  });
  const inputRef = useRef(null);
  const workerRef = useRef(null);
  const workerModeRef = useRef("native");
  const replaceWorkerRef = useRef(null);
  const pendingMessageRef = useRef(null);
  const queueRef = useRef([]);
  const historyFollowupQueueRef = useRef([]);
  const additionalQueueRef = useRef([]);
  const activeFileRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const dragDepthRef = useRef(0);
  const snapshotRef = useRef(null);
  const persistenceEnabledRef = useRef(false);
  const savedHistoryRef = useRef(null);
  const startupRestoreAttemptedRef = useRef(false);
  const restoringSavedHistoryRef = useRef(false);
  const exportPurposeRef = useRef(null);
  const driveClientRef = useRef(null);
  if (!driveClientRef.current) driveClientRef.current = createGoogleDriveClient();
  const driveConnectedRef = useRef(false);
  const driveAutoSyncRef = useRef(drive.autoSync);
  const driveAfterPersistenceRef = useRef(false);
  const driveArchiveOriginalsRef = useRef(drive.archiveOriginals);
  const driveArchiveGpsRef = useRef(drive.archiveGps);
  const pendingOriginalArchivesRef = useRef([]);
  const restoringDriveRef = useRef(false);
  const tutorialAutoStartedRef = useRef({ landing: false, dashboard: false });
  const detailRequestsRef = useRef(new Set());
  const t = useMemo(() => translator(locale), [locale]);
  const tutorialSteps = useMemo(() => tutorialMode === "dashboard" ? [
    { target: [".dashboard-topbar"], title: t("tutorialDashboardTitle"), body: t("tutorialDashboardBody") },
    { target: [".period-bar", ".mobile-nav"], title: t("tutorialFiltersTitle"), body: t("tutorialFiltersBody") },
    { target: ["[data-tutorial='driving']", ".mobile-nav"], title: t("tutorialNavigationTitle"), body: t("tutorialNavigationBody") },
    { target: ["[data-tutorial='vehicle']", ".mobile-nav"], title: t("tutorialVehicleTitle"), body: t("tutorialVehicleBody") },
    { target: ["[data-tutorial='tools']", ".mobile-nav"], title: t("tutorialToolsTitle"), body: t("tutorialToolsBody") },
    { target: [".topbar-data-action"], title: t("tutorialMoreDataTitle"), body: t("tutorialMoreDataBody") },
    { target: ["[data-tutorial='data']", ".mobile-nav"], title: t("tutorialDataTitle"), body: t("tutorialDataBody") },
    { target: [".settings-trigger"], title: t("tutorialSettingsTitle"), body: t("tutorialSettingsBody") },
  ] : [
    { target: [".hero-copy"], title: t("tutorialWelcomeTitle"), body: t("tutorialWelcomeBody") },
    { target: [".data-source-card"], title: t("tutorialGetDataTitle"), body: t("tutorialGetDataBody") },
    { target: [".landing-drop-zone"], title: t("tutorialImportTitle"), body: t("tutorialImportBody") },
    { target: [".start-options"], title: t("tutorialContinueTitle"), body: t("tutorialContinueBody") },
    { target: [".gpx-next-step"], title: t("tutorialPortableTitle"), body: t("tutorialPortableBody") },
  ], [tutorialMode, t]);

  useEffect(() => {
    if (busy || persistence.loading || tutorialMode) return;
    const mode = nextTutorialMode(tutorialStatus, Boolean(snapshot), dashboardTutorialEligible === true);
    if (!mode || tutorialAutoStartedRef.current[mode]) return;
    tutorialAutoStartedRef.current[mode] = true;
    const timer = setTimeout(() => setTutorialMode(mode), 350);
    return () => clearTimeout(timer);
  }, [busy, dashboardTutorialEligible, persistence.loading, snapshot, tutorialMode, tutorialStatus]);

  const skipTutorial = () => {
    const next = writeTutorialState(tutorialStates.DISMISSED);
    setTutorialStatus(next);
    setTutorialMode(null);
  };
  const finishTutorial = () => {
    const next = writeTutorialState(completeTutorialMode(tutorialMode));
    setTutorialStatus(next);
    setTutorialMode(null);
  };
  const startTutorial = () => setTutorialMode(snapshot ? "dashboard" : "landing");

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supported = supportsPersistentHistory();
      const enabled = supported && rememberHistoryEnabled();
      const reminderEnabled = importReminderEnabled();
      const reminderDays = importReminderDays();
      let record = null;
      let estimate = { usage: null, quota: null };
      let persistenceError = null;
      try {
        [record, estimate] = await Promise.all([
          enabled ? readPersistentHistory() : Promise.resolve(null),
          storageEstimate(),
        ]);
      } catch (loadError) {
        console.error("Could not read the saved local history:", loadError);
        persistenceError = "persistentHistoryLoadError";
      }
      if (!active) return;
      persistenceEnabledRef.current = enabled;
      savedHistoryRef.current = record;
      setPersistence({
        supported,
        loading: false,
        enabled,
        hasSavedHistory: Boolean(record?.blob),
        saving: false,
        savedAtUtc: record?.savedAtUtc || null,
        lastImportAtUtc: record?.lastImportAtUtc || null,
        byteLength: Number(record?.byteLength || record?.blob?.size || 0),
        importCount: Number(record?.importCount || 0),
        durable: false,
        reminderEnabled,
        reminderDays,
        reminderDue: reminderDue(record?.lastImportAtUtc, reminderEnabled, reminderDays),
        usage: estimate.usage,
        quota: estimate.quota,
        error: persistenceError,
      });
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      const message = event.data ?? {};
      if (message.type === "progress") {
        setProgress({ percent: message.percent ?? 0, phase: message.phase, detail: message.detail || "" });
      } else if (message.type === "ready") {
        setEngineReady(true);
        if (pendingMessageRef.current) {
          const pending = pendingMessageRef.current;
          pendingMessageRef.current = null;
          workerRef.current.postMessage(pending, pending.archive ? [pending.archive] : []);
        } else {
          setBusy(false);
          setProgress({ percent: 0, phase: null });
        }
      } else if (message.type === "imported") {
        const importedFile = activeFileRef.current;
        if (importedFile?.name?.toLowerCase().endsWith(".zip")) {
          pendingOriginalArchivesRef.current = rememberSessionArchive(pendingOriginalArchivesRef.current, { kind: "xpeng", file: importedFile, sha256: message.result?.archiveSha256, coverageStartUtc: message.result?.sourceStartUtc, coverageEndUtc: message.result?.sourceEndUtc });
        }
        setDashboardTutorialEligible(true);
        snapshotRef.current = message.snapshot;
        setSnapshot(message.snapshot);
        setHistory((current) => [{
          name: activeFileRef.current?.name ?? "—",
          status: message.result.skipped ? "alreadyImported" : "added",
          rows: message.result.totalRows ?? 0,
          sourceStartUtc: message.result?.sourceStartUtc || null,
          sourceEndUtc: message.result?.sourceEndUtc || null,
        }, ...current]);
        requestAnimationFrame(() => setTimeout(processNext, 0));
      } else if (message.type === "history_imported") {
        const sourceHistoryVersion = Number(message.metadata?.sourceVersion ?? message.metadata?.version ?? 0);
        setDashboardTutorialEligible(shouldShowDashboardTutorialForHistory(sourceHistoryVersion));
        snapshotRef.current = message.snapshot;
        setSnapshot(message.snapshot);
        setHistory([{ name: activeFileRef.current?.name ?? "—", status: "historyLoaded", rows: message.snapshot?.overview?.tripCount ?? 0 }]);
        activeFileRef.current = null;
        const followupArchives = historyFollowupQueueRef.current;
        historyFollowupQueueRef.current = [];
        const restoredSavedHistory = restoringSavedHistoryRef.current;
        const restoredDriveHistory = restoringDriveRef.current;
        restoringSavedHistoryRef.current = false;
        restoringDriveRef.current = false;
        if (followupArchives.length) {
          queueRef.current = followupArchives;
          processNext();
        } else if (persistenceEnabledRef.current && !restoredSavedHistory) {
          driveAfterPersistenceRef.current = driveConnectedRef.current && driveAutoSyncRef.current && !restoredDriveHistory;
          queuePersistentSave();
        } else if (driveConnectedRef.current && driveAutoSyncRef.current && !restoredDriveHistory) {
          queueDriveSave(true);
        } else {
          setBusy(false);
          setProgress({ percent: 100, phase: "complete" });
        }
      } else if (message.type === "additional_imported") {
        const importedFile = activeFileRef.current;
        if (message.kind !== "gps" && importedFile?.name?.toLowerCase().endsWith(".zip")) pendingOriginalArchivesRef.current = rememberSessionArchive(pendingOriginalArchivesRef.current, { kind: "xpeng", file: importedFile, sha256: message.result?.archiveSha256, coverageStartUtc: message.result?.sourceStartUtc, coverageEndUtc: message.result?.sourceEndUtc });
        if (message.kind === "gps" && /\.(gpx|zip)$/i.test(importedFile?.name || "")) pendingOriginalArchivesRef.current = rememberSessionArchive(pendingOriginalArchivesRef.current, { kind: "gps", file: importedFile, sha256: message.result?.sourceSha256 });
        snapshotRef.current = message.snapshot;
        setSnapshot(message.snapshot);
        setHistory((current) => [{
          name: activeFileRef.current?.name ?? "—",
          status: message.kind === "gps" ? "gpsAdded" : message.result.skipped ? "alreadyImported" : "added",
          rows: message.kind === "gps" ? message.result.pointCount ?? 0 : message.result.totalRows ?? 0,
          sourceStartUtc: message.kind === "gps" ? null : message.result?.sourceStartUtc || null,
          sourceEndUtc: message.kind === "gps" ? null : message.result?.sourceEndUtc || null,
        }, ...current]);
        requestAnimationFrame(() => setTimeout(processAdditionalNext, 0));
      } else if (message.type === "custom_charts_updated") {
        const updated = { ...snapshotRef.current, customCharts: message.charts || [] };
        snapshotRef.current = updated;
        setSnapshot(updated);
        if (persistenceEnabledRef.current) {
          driveAfterPersistenceRef.current = driveConnectedRef.current && driveAutoSyncRef.current;
          queuePersistentSave();
        } else if (driveConnectedRef.current && driveAutoSyncRef.current) queueDriveSave(true);
      } else if (message.type === "journey_groups_updated") {
        const updated = message.snapshot || { ...snapshotRef.current, journeyGroups: message.groups || [] };
        snapshotRef.current = updated;
        setSnapshot(updated);
        if (persistenceEnabledRef.current) {
          driveAfterPersistenceRef.current = driveConnectedRef.current && driveAutoSyncRef.current;
          queuePersistentSave();
        } else if (driveConnectedRef.current && driveAutoSyncRef.current) queueDriveSave(true);
      } else if (message.type === "raw_archives_updated") {
        const updated = { ...snapshotRef.current, rawArchives: message.rawArchives || [] };
        snapshotRef.current = updated;
        setSnapshot(updated);
      } else if (message.type === "details_loaded") {
        detailRequestsRef.current.delete(message.requestId);
        const details = message.details || {}, current = snapshotRef.current;
        if (!current) return;
        const replace = (existing, incoming, key) => {
          const updates = new Map((incoming || []).map((row) => [row[key], row]));
          return (existing || []).map((row) => updates.has(row[key]) ? { ...row, ...updates.get(row[key]) } : row);
        };
        const updated = {
          ...current,
          trips: replace(current.trips, details.trips, "tripId"),
          journeys: replace(current.journeys, details.journeys, "journeyId"),
          charges: replace(current.charges, details.charges, "chargeId"),
        };
        snapshotRef.current = updated;
        setSnapshot(updated);
      } else if (message.type === "history_exported") {
        const blob = new Blob([message.payload], { type: "application/octet-stream" });
        const purpose = message.purpose || exportPurposeRef.current || "download";
        exportPurposeRef.current = null;
        if (purpose === "persist") {
          const currentSnapshot = snapshotRef.current;
          const metadata = {
            lastImportAtUtc: latestImportAt(currentSnapshot),
            importCount: currentSnapshot?.imports?.length || 0,
            historyVersion: message.metadata?.version || 0,
          };
          setPersistence((current) => ({ ...current, saving: true, error: null }));
          savePersistentHistory(blob, metadata).then(async (record) => {
            const estimate = await storageEstimate();
            savedHistoryRef.current = record;
            setPersistence((current) => ({
              ...current,
              saving: false,
              enabled: true,
              hasSavedHistory: true,
              savedAtUtc: record.savedAtUtc,
              lastImportAtUtc: record.lastImportAtUtc,
              byteLength: record.byteLength,
              importCount: record.importCount,
              reminderDue: reminderDue(record.lastImportAtUtc, current.reminderEnabled, current.reminderDays),
              usage: estimate.usage,
              quota: estimate.quota,
              error: null,
            }));
            if (driveAfterPersistenceRef.current) {
              driveAfterPersistenceRef.current = false;
              queueDriveSave(true);
            } else {
              setBusy(false);
              setProgress({ percent: 100, phase: "persistent_history_saved" });
            }
          }).catch((saveError) => {
            console.error("Could not save the local history:", saveError);
            driveAfterPersistenceRef.current = false;
            setPersistence((current) => ({ ...current, saving: false, error: "persistentHistorySaveError" }));
            setBusy(false);
            setProgress({ percent: 100, phase: "complete" });
          });
          return;
        }
        if (purpose === "drive") {
          const backupMetadata = buildDriveBackupMetadata(snapshotRef.current, message.metadata?.version || 0);
          setDrive((current) => ({ ...current, busy: true, error: null }));
          driveClientRef.current.uploadHistory(blob, backupMetadata).then((result) => {
            driveConnectedRef.current = true;
            setDrive((current) => ({
              ...current,
              connected: true,
              busy: false,
              hasBackup: true,
              modifiedTime: result.modifiedTime || result.file?.modifiedTime || new Date().toISOString(),
              byteLength: Number(result.size || result.file?.size || blob.size),
              coverageStartUtc: result.file?.coverageStartUtc || backupMetadata.coverageStartUtc,
              coverageEndUtc: result.file?.coverageEndUtc || backupMetadata.coverageEndUtc,
              historyVersion: Number(result.file?.historyVersion || backupMetadata.historyVersion || 0),
              backups: result.backups || current.backups,
              error: null,
            }));
            setBusy(false);
            setProgress({ percent: 100, phase: "drive_backup_saved" });
          }).catch((driveError) => {
            console.error("Could not save the Google Drive backup:", driveError);
            if (["driveReconnect", "driveAuthorisation"].includes(driveError.code)) driveConnectedRef.current = false;
            setDrive((current) => ({ ...current, connected: driveConnectedRef.current, busy: false, error: driveError.code || "driveUpload" }));
            setBusy(false);
            setProgress({ percent: 100, phase: "complete" });
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = message.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setBusy(false);
        setProgress({ percent: 100, phase: "history_export_complete" });
      } else if (message.type === "reset_complete") {
        additionalQueueRef.current = [];
        pendingOriginalArchivesRef.current = [];
        driveAfterPersistenceRef.current = false;
        setDashboardTutorialEligible(null);
        snapshotRef.current = null;
        setSnapshot(null);
        setHistory([]);
        setBusy(false);
        setProgress({ percent: 100, phase: "reset" });
      } else if (message.type === "error") {
        if (message.code === "cancelled") {
          queueRef.current = [];
          historyFollowupQueueRef.current = [];
          additionalQueueRef.current = [];
          activeFileRef.current = null;
          setError(null);
          setBusy(false);
          setProgress({ percent: 0, phase: null });
          return;
        }
        if (message.detail) console.error("XPENG Analytics processor error:", message.detail);
        setError(message.code ?? "unknown_error");
        const failedName = activeFileRef.current?.name;
        if (failedName) {
          setHistory((current) => [{ name: failedName, status: "failed", rows: 0 }, ...current]);
        }
        queueRef.current = [];
        historyFollowupQueueRef.current = [];
        additionalQueueRef.current = [];
        activeFileRef.current = null;
        setBusy(false);
      }
    };
    const onError = () => {
      setError("engine_error");
      setBusy(false);
    };
    const attach = (mode, pending = null) => {
      workerRef.current?.terminate();
      const worker = mode === "legacy" ? createLegacyWorker() : createWorker();
      workerModeRef.current = mode;
      pendingMessageRef.current = pending;
      workerRef.current = worker;
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      setEngineReady(false);
      worker.postMessage({ type: "initialise" });
    };
    replaceWorkerRef.current = attach;
    attach("native");
    return () => workerRef.current?.terminate();
  }, []);

  const queuePersistentSave = () => {
    if (!persistenceEnabledRef.current || !snapshotRef.current || !workerRef.current) {
      setBusy(false);
      setProgress({ percent: 100, phase: "complete" });
      return;
    }
    exportPurposeRef.current = "persist";
    setBusy(true);
    setError(null);
    setPersistence((current) => ({ ...current, saving: true, error: null }));
    setProgress({ percent: 5, phase: "persistent_history_save" });
    workerRef.current.postMessage({ type: "export_history", purpose: "persist" });
  };

  const queueDriveSave = (automatic = false) => {
    if (!snapshotRef.current || !workerRef.current || !driveClientRef.current.isAuthorised()) {
      if (automatic) setDrive((current) => ({ ...current, connected: false, error: "driveReconnect" }));
      setBusy(false);
      setProgress({ percent: 100, phase: "complete" });
      return;
    }
    exportPurposeRef.current = "drive";
    setBusy(true);
    setError(null);
    setDrive((current) => ({ ...current, busy: true, error: null }));
    setProgress({ percent: 5, phase: "drive_backup_save" });
    workerRef.current.postMessage({ type: "export_history", purpose: "drive" });
  };

  const completeDataChange = async () => {
    const originals = sessionArchivesToUpload(pendingOriginalArchivesRef.current, { archiveOriginals: driveArchiveOriginalsRef.current, archiveGps: driveArchiveGpsRef.current });
    const uploadedOriginals = [];
    if (originals.length && driveConnectedRef.current) {
      setBusy(true);
      if (!driveClientRef.current.isAuthorised()) {
        setDrive((current) => ({ ...current, connected: false, originalArchiveBusy: false, error: "driveReconnect" }));
        driveConnectedRef.current = false;
      } else {
        setDrive((current) => ({ ...current, originalArchiveBusy: true, originalArchiveError: null }));
        setProgress({ percent: 5, phase: "drive_original_archive" });
        try {
          let archived = null, archivedGps = null;
          const registryUpdates = [];
          for (const original of originals) {
            if (original.kind === "gps") archivedGps = await driveClientRef.current.uploadGpsExport(original.file, original);
            else {
              archived = await driveClientRef.current.uploadOriginalExport(original.file, original);
              registryUpdates.push(...(archived.registryUpdates || []));
            }
            uploadedOriginals.push(original);
          }
          if (registryUpdates.length) {
            const rawArchives = mergeRawArchiveRegistry(snapshotRef.current?.rawArchives, registryUpdates);
            snapshotRef.current = { ...snapshotRef.current, rawArchives };
            setSnapshot(snapshotRef.current);
            workerRef.current.postMessage({ type: "set_raw_archives", updates: registryUpdates });
          }
          setDrive((current) => ({ ...current, originals: archived?.originals || current.originals, gpsOriginals: archivedGps?.gpsOriginals || current.gpsOriginals, originalArchiveBusy: false, originalArchiveError: null }));
        } catch (archiveError) {
          console.error("Could not archive the original XPENG export:", archiveError);
          if (["driveReconnect", "driveAuthorisation"].includes(archiveError.code)) {
            driveConnectedRef.current = false;
            setDrive((current) => ({ ...current, connected: false, originalArchiveBusy: false, error: archiveError.code }));
          } else setDrive((current) => ({ ...current, originalArchiveBusy: false, originalArchiveError: archiveError.code || "driveOriginalUpload" }));
        }
      }
    }
    if (uploadedOriginals.length) pendingOriginalArchivesRef.current = forgetUploadedSessionArchives(pendingOriginalArchivesRef.current, uploadedOriginals);
    const autoDrive = driveConnectedRef.current && driveAutoSyncRef.current;
    if (persistenceEnabledRef.current && snapshotRef.current) {
      driveAfterPersistenceRef.current = autoDrive;
      queuePersistentSave();
    } else if (autoDrive) queueDriveSave(true);
    else {
      setBusy(false);
      setProgress({ percent: 100, phase: "complete" });
    }
  };

  const processNext = () => {
    const next = queueRef.current.shift();
    if (!next) {
      activeFileRef.current = null;
      completeDataChange();
      return;
    }
    activeFileRef.current = next;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 8, phase: "archive_write" });
    if (workerModeRef.current === "native") {
      if (cancelRequestedRef.current) {
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 0, phase: null });
        return;
      }
      workerRef.current.postMessage({ type: "import", filename: next.name, file: next, processingProfile: processingProfile() });
      return;
    }
    next.arrayBuffer().then((archive) => {
      if (cancelRequestedRef.current) {
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 0, phase: null });
        return;
      }
      workerRef.current.postMessage({ type: "import", filename: next.name, archive, memoryBudgetBytes: processingProfile().memoryBudgetBytes }, [archive]);
    }).catch(() => {
      setError("invalid_archive");
      setBusy(false);
    });
  };

  const processAdditionalNext = () => {
    const next = additionalQueueRef.current.shift();
    if (!next) {
      activeFileRef.current = null;
      completeDataChange();
      return;
    }
    activeFileRef.current = next.file;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 4, phase: "native_scan", detail: next.file.name });
    workerRef.current.postMessage({ type: "import_additional", filename: next.file.name, file: next.file, options: next.options || {}, processingProfile: processingProfile() });
  };

  const chooseFiles = (files) => {
    const selected = [...files].filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (!selected.length || busy || !engineReady) return;
    queueRef.current = selected;
    processNext();
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseAdditionalFiles = (files, options = {}) => {
    const selected = [...(files || [])].filter((file) => /\.(gpx|zip)$/i.test(file.name));
    if (!selected.length || busy || !engineReady || workerModeRef.current !== "native") return;
    additionalQueueRef.current = selected.map((file) => ({ file, options }));
    processAdditionalNext();
  };

  const importHistoryFile = (selected, followupArchives = [], options = {}) => {
    if (!selected || busy || !engineReady) return;
    if (snapshotRef.current && !options.skipConfirm && !window.confirm(t("replaceWithHistoryConfirm"))) return;
    historyFollowupQueueRef.current = followupArchives;
    activeFileRef.current = selected;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 5, phase: "history_read" });
    selected.slice(0, nativeHistoryPrefix.length + 1).arrayBuffer().then(async (header) => {
      if (cancelRequestedRef.current) {
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 0, phase: null });
        return;
      }
      const mode = isNativeHistory(header) ? "native" : "legacy";
      if (mode === "native") {
        const message = { type: "import_history", filename: selected.name, file: selected };
        if (workerModeRef.current !== mode) replaceWorkerRef.current?.(mode, message);
        else workerRef.current.postMessage(message);
        return;
      }
      const archive = await selected.arrayBuffer();
      const message = { type: "import_history", filename: selected.name, archive };
      if (workerModeRef.current !== mode) replaceWorkerRef.current?.(mode, message);
      else workerRef.current.postMessage(message, [archive]);
    }).catch(() => {
      setError("invalid_history");
      historyFollowupQueueRef.current = [];
      setBusy(false);
    });
  };

  const restoreSavedHistory = () => {
    const record = savedHistoryRef.current;
    if (!record?.blob || busy || !engineReady) return;
    restoringSavedHistoryRef.current = true;
    const file = new File([record.blob], "xpeng-analytics-saved-history.xpeng", { type: "application/octet-stream" });
    importHistoryFile(file, [], { skipConfirm: true });
  };

  useEffect(() => {
    if (persistence.loading || !persistence.enabled || !persistence.hasSavedHistory || !engineReady || busy || snapshotRef.current || startupRestoreAttemptedRef.current) return;
    startupRestoreAttemptedRef.current = true;
    restoreSavedHistory();
  }, [persistence.loading, persistence.enabled, persistence.hasSavedHistory, engineReady, busy]);

  const chooseHistory = (files) => {
    const { histories } = classifyLocalFiles(files);
    const selected = histories[0];
    if (!selected) return;
    importHistoryFile(selected);
  };

  const chooseLocalFiles = (files) => {
    if (busy || !engineReady) return;
    const plan = createImportPlan(files);
    if (plan.kind === "history") {
      importHistoryFile(plan.history, plan.archives);
    } else if (plan.kind === "archives") {
      chooseFiles(plan.archives);
    } else {
      setError(plan.kind);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const forgetSavedHistory = async () => {
    if (busy || !persistence.supported || !window.confirm(t("forgetSavedHistoryConfirm"))) return;
    try {
      await deletePersistentHistory();
      setRememberHistoryEnabled(false);
      persistenceEnabledRef.current = false;
      savedHistoryRef.current = null;
      setPersistence((current) => ({
        ...current,
        enabled: false,
        hasSavedHistory: false,
        saving: false,
        savedAtUtc: null,
        lastImportAtUtc: null,
        byteLength: 0,
        importCount: 0,
        reminderDue: false,
        error: null,
      }));
    } catch (forgetError) {
      console.error("Could not remove the saved local history:", forgetError);
      setPersistence((current) => ({ ...current, error: "persistentHistoryDeleteError" }));
    }
  };

  const toggleRememberHistory = async (enabled) => {
    if (busy || !persistence.supported) return;
    if (!enabled) {
      await forgetSavedHistory();
      return;
    }
    setRememberHistoryEnabled(true);
    persistenceEnabledRef.current = true;
    setPersistence((current) => ({ ...current, enabled: true, error: null }));
    const durable = await requestDurableStorage();
    setPersistence((current) => ({ ...current, durable }));
    if (snapshotRef.current) queuePersistentSave();
  };

  const toggleImportReminder = (enabled) => {
    setImportReminderEnabled(enabled);
    setPersistence((current) => ({
      ...current,
      reminderEnabled: enabled,
      reminderDue: reminderDue(current.lastImportAtUtc, enabled, current.reminderDays),
    }));
  };

  const changeImportReminderDays = (days) => {
    const reminderDays = setImportReminderDays(days);
    setPersistence((current) => ({
      ...current,
      reminderDays,
      reminderDue: reminderDue(current.lastImportAtUtc, current.reminderEnabled, reminderDays),
    }));
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    if (busy || !engineReady) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = busy || !engineReady ? "none" : "copy";
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    chooseLocalFiles(event.dataTransfer?.files);
  };

  const authoriseGoogleDrive = async ({ prompt = "select_account" } = {}) => {
    if (!drive.configured || drive.busy) return false;
    setDrive((current) => ({ ...current, busy: true, error: null }));
    try {
      await driveClientRef.current.authorise({ prompt });
      driveConnectedRef.current = true;
      const backup = await driveClientRef.current.refreshBackup();
      setDrive((current) => ({
        ...current,
        connected: true,
        busy: false,
        hasBackup: backup.exists,
        modifiedTime: backup.modifiedTime || backup.file?.modifiedTime || null,
        byteLength: Number(backup.size || backup.file?.size || 0),
        coverageStartUtc: backup.file?.coverageStartUtc || backup.coverageStartUtc || null,
        coverageEndUtc: backup.file?.coverageEndUtc || backup.coverageEndUtc || null,
        historyVersion: Number(backup.file?.historyVersion || backup.historyVersion || 0),
        account: backup.user || null,
        backups: backup.backups || [],
        originals: backup.originals || [],
        gpsOriginals: backup.gpsOriginals || [],
        error: null,
      }));
      return true;
    } catch (driveError) {
      console.error("Could not connect to Google Drive:", driveError);
      driveConnectedRef.current = false;
      setDrive((current) => ({ ...current, connected: false, busy: false, error: driveError.code || "driveAuthorisation" }));
      return false;
    }
  };

  const connectGoogleDrive = async () => {
    const connected = await authoriseGoogleDrive({ prompt: "select_account" });
    if (connected && sessionArchivesToUpload(pendingOriginalArchivesRef.current, { archiveOriginals: driveArchiveOriginalsRef.current, archiveGps: driveArchiveGpsRef.current }).length) await completeDataChange();
    return connected;
  };

  const saveGoogleDrive = async () => {
    if (!snapshotRef.current || busy || drive.busy) return;
    const authorised = driveClientRef.current.isAuthorised() || await authoriseGoogleDrive({ prompt: "select_account" });
    if (authorised) queueDriveSave(false);
  };

  const openGoogleDrive = async (backupId = null) => {
    if (busy || drive.busy || !engineReady) return;
    if (snapshotRef.current && !window.confirm(t("replaceWithHistoryConfirm"))) return;
    const authorised = driveClientRef.current.isAuthorised() || await authoriseGoogleDrive({ prompt: "select_account" });
    if (!authorised) return;
    setDrive((current) => ({ ...current, busy: true, error: null }));
    setBusy(true);
    setProgress({ percent: 5, phase: "drive_backup_open" });
    try {
      const { file: metadata, blob } = await driveClientRef.current.downloadHistory(backupId);
      setDrive((current) => ({
        ...current,
        connected: true,
        busy: false,
        hasBackup: true,
        modifiedTime: metadata.modifiedTime || current.modifiedTime,
        byteLength: Number(metadata.size || blob.size),
        coverageStartUtc: metadata.coverageStartUtc || current.coverageStartUtc,
        coverageEndUtc: metadata.coverageEndUtc || current.coverageEndUtc,
        historyVersion: Number(metadata.historyVersion || current.historyVersion || 0),
        error: null,
      }));
      restoringDriveRef.current = true;
      const file = new File([blob], metadata.name || "xpeng-analytics-history.xpeng", { type: "application/octet-stream" });
      importHistoryFile(file, [], { skipConfirm: true });
    } catch (driveError) {
      console.error("Could not open the Google Drive backup:", driveError);
      if (["driveReconnect", "driveAuthorisation"].includes(driveError.code)) driveConnectedRef.current = false;
      setDrive((current) => ({ ...current, connected: driveConnectedRef.current, busy: false, error: driveError.code || "driveDownload" }));
      setBusy(false);
      setProgress({ percent: 100, phase: "complete" });
    }
  };

  const disconnectGoogleDrive = () => {
    driveClientRef.current.disconnect();
    driveClientRef.current.setAutoSync(false);
    driveClientRef.current.setArchiveOriginals(false);
    driveClientRef.current.setArchiveGps(false);
    driveConnectedRef.current = false;
    driveAutoSyncRef.current = false;
    driveArchiveOriginalsRef.current = false;
    driveArchiveGpsRef.current = false;
    setDrive((current) => ({ ...current, connected: false, busy: false, autoSync: false, archiveOriginals: false, archiveGps: false, account: null, backups: [], originals: [], gpsOriginals: [], originalArchiveBusy: false, originalArchiveError: null, error: null }));
  };

  const toggleGoogleDriveAutoSync = (enabled) => {
    const next = Boolean(enabled && driveConnectedRef.current);
    driveClientRef.current.setAutoSync(next);
    driveAutoSyncRef.current = next;
    setDrive((current) => ({ ...current, autoSync: next, error: null }));
  };

  const toggleGoogleDriveOriginalArchive = (enabled) => {
    const next = Boolean(enabled && driveConnectedRef.current);
    driveClientRef.current.setArchiveOriginals(next);
    driveArchiveOriginalsRef.current = next;
    setDrive((current) => ({ ...current, archiveOriginals: next, originalArchiveError: null, error: null }));
    if (next && pendingOriginalArchivesRef.current.length) void completeDataChange();
  };

  const toggleGoogleDriveGpsArchive = (enabled) => {
    const next = Boolean(enabled && driveConnectedRef.current);
    driveClientRef.current.setArchiveGps(next);
    driveArchiveGpsRef.current = next;
    setDrive((current) => ({ ...current, archiveGps: next, originalArchiveError: null, error: null }));
    if (next && pendingOriginalArchivesRef.current.length) void completeDataChange();
  };

  const downloadGoogleDriveOriginal = async (fileId) => {
    if (busy || drive.busy || drive.originalArchiveBusy || !fileId) return;
    try {
      const { file, blob } = await driveClientRef.current.downloadOriginalExport(fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || "xpeng-original-export.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (driveError) {
      setDrive((current) => ({ ...current, error: driveError.code || "driveDownload" }));
    }
  };

  const deleteGoogleDriveOriginal = async (fileId) => {
    if (busy || drive.busy || drive.originalArchiveBusy || !fileId || !window.confirm(t("driveOriginalDeleteConfirm"))) return;
    setDrive((current) => ({ ...current, originalArchiveBusy: true, originalArchiveError: null }));
    try {
      const deletedRaw = drive.originals?.find((file) => file.id === fileId);
      const sources = await driveClientRef.current.deleteOriginalExport(fileId);
      if (deletedRaw?.digest) {
        const updates = [{ sha256: deletedRaw.digest, driveStatus: "retired", driveFileId: null, driveUpdatedAtUtc: new Date().toISOString() }];
        const rawArchives = mergeRawArchiveRegistry(snapshotRef.current?.rawArchives, updates);
        snapshotRef.current = { ...snapshotRef.current, rawArchives };
        setSnapshot(snapshotRef.current);
        workerRef.current.postMessage({ type: "set_raw_archives", updates });
      }
      setDrive((current) => ({ ...current, originals: sources.originals, gpsOriginals: sources.gpsOriginals, originalArchiveBusy: false, originalArchiveError: null }));
    } catch (driveError) {
      setDrive((current) => ({ ...current, originalArchiveBusy: false, originalArchiveError: driveError.code || "driveOriginalDeleteError" }));
    }
  };

  const exportHistory = () => {
    if (!snapshot || busy || !engineReady) return;
    exportPurposeRef.current = "download";
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 5, phase: "history_export" });
    workerRef.current.postMessage({ type: "export_history" });
  };

  const saveCustomCharts = (charts) => {
    if (!snapshotRef.current || !engineReady || workerModeRef.current !== "native") return;
    workerRef.current.postMessage({ type: "set_custom_charts", charts });
  };

  const requestRecordDetails = useCallback((request) => {
    if (!workerRef.current || !snapshotRef.current?.storage?.segmented) return;
    const normalized = {
      journeyIds: [...new Set(request?.journeyIds || [])],
      tripIds: [...new Set(request?.tripIds || [])],
      chargeIds: [...new Set(request?.chargeIds || [])],
    };
    const requestId = JSON.stringify(normalized);
    if (detailRequestsRef.current.has(requestId)) return;
    detailRequestsRef.current.add(requestId);
    workerRef.current.postMessage({ type: "load_details", requestId, request: normalized });
  }, []);

  const saveJourneyGroups = (groups) => {
    if (!snapshotRef.current || !engineReady || workerModeRef.current !== "native") return;
    workerRef.current.postMessage({ type: "set_journey_groups", groups });
  };

  const reset = () => {
    if (!window.confirm(t("resetConfirm"))) return;
    startupRestoreAttemptedRef.current = true;
    setBusy(true);
    setError(null);
    workerRef.current.postMessage({ type: "reset" });
  };

  const cancelProcessing = () => {
    if (!busy || workerModeRef.current !== "native") return;
    cancelRequestedRef.current = true;
    queueRef.current = [];
    historyFollowupQueueRef.current = [];
    additionalQueueRef.current = [];
    workerRef.current.postMessage({ type: "cancel" });
  };

  const statusText = busy
    ? t(phaseKeys[progress.phase] ?? "loadingEngine")
    : error
      ? t(errorKeys[error] ?? "errorUnknown")
      : t(phaseKeys[progress.phase] ?? "ready");

  if (snapshot) {
    return <><React.Suspense fallback={<main className="app-shell"><div className="section-empty"><strong>{t("loadingEngine")}</strong></div></main>}><Dashboard
      data={snapshot}
      locale={locale}
      setLocale={setLocale}
      t={t}
      busy={busy}
      progress={progress}
      error={error}
      onChooseAdditional={chooseAdditionalFiles}
      onChooseHistory={chooseHistory}
      onExport={exportHistory}
      onSaveCustomCharts={saveCustomCharts}
      onSaveJourneyGroups={saveJourneyGroups}
      onRequestRecordDetails={requestRecordDetails}
      onReset={reset}
      onCancel={cancelProcessing}
      canCancel={workerModeRef.current === "native"}
      history={history}
      persistence={persistence}
      onToggleRememberHistory={toggleRememberHistory}
      onToggleImportReminder={toggleImportReminder}
      onSetImportReminderDays={changeImportReminderDays}
      onForgetSavedHistory={forgetSavedHistory}
      drive={drive}
      onConnectDrive={connectGoogleDrive}
      onSaveDrive={saveGoogleDrive}
      onOpenDrive={openGoogleDrive}
      onDisconnectDrive={disconnectGoogleDrive}
      onToggleDriveAutoSync={toggleGoogleDriveAutoSync}
      onToggleDriveOriginalArchive={toggleGoogleDriveOriginalArchive}
      onToggleDriveGpsArchive={toggleGoogleDriveGpsArchive}
      onDownloadDriveOriginal={downloadGoogleDriveOriginal}
      onDeleteDriveOriginal={deleteGoogleDriveOriginal}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      onStartTutorial={startTutorial}
    /></React.Suspense>{tutorialMode ? <TutorialOverlay steps={tutorialSteps} onComplete={finishTutorial} onSkip={skipTutorial} t={t} /> : null}</>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="XPENG Analytics">
          <span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/xpeng-analytics-mark-minimal.png`} alt="" /></span>
          <span><strong>XPENG</strong><small>Analytics</small></span>
        </a>
        <div className="topbar-actions">
          <button className="tutorial-launch" type="button" onClick={startTutorial}>{t("tutorialOpen")}</button>
          <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? t("darkTheme") : t("lightTheme")}><span aria-hidden="true" />{theme === "light" ? t("dark") : t("light")}</button>
          <label className="language-picker">
            <span>{t("language")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="pt-PT">Português</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
        </div>
        <div className="hero-aside">
          <article className="data-source-card">
            <span>{t("getDataKicker")}</span>
            <strong>{t("getDataTitle")}</strong>
            <p>{t("getDataBody")}</p>
            <a href="https://www.xpeng.com/data-act/my-data" target="_blank" rel="noreferrer">{t("getDataCta")} <span aria-hidden="true">↗</span></a>
          </article>
          <div className="privacy-card">
            <div className="privacy-icon" aria-hidden="true">⌁</div>
            <div><strong>{t("privacyTitle")}</strong><p>{persistence.enabled && persistence.hasSavedHistory ? t("privacyBodyPersistent") : t("privacyBody")}</p></div>
          </div>
        </div>
      </section>

      <section className={`workspace workspace-start ${dragActive ? "is-dragging" : ""}`} aria-busy={busy}>
        <div className="upload-card">
          <div className="upload-heading">
            {busy ? <strong className="progress-percent">{Math.round(progress.percent ?? 0)}%</strong> : <><span className={`status-dot ${error ? "is-error" : engineReady ? "is-ready" : ""}`} /><strong>{statusText}</strong></>}
            <span className="local-badge">{t("localOnly")}</span>
          </div>
          {busy ? <><div className="progress"><span style={{ width: `${Math.max(3, progress.percent)}%` }} /></div><p className="progress-phase" aria-live="polite">{statusText}{progress.detail ? ` · ${progress.detail}` : ""}</p>{engineReady&&workerModeRef.current==="native"?<button className="cancel-processing" type="button" onClick={cancelProcessing}>{t("cancelProcessing")}</button>:null}</> : null}
          {error ? <div className="error-message" role="alert">{t(errorKeys[error] ?? "errorUnknown")}</div> : null}
          <input
            ref={inputRef}
            className="visually-hidden"
            id="xpeng-files"
            type="file"
            accept=".zip,.xpeng,.json.gz,.gz,application/zip,application/octet-stream,application/gzip"
            multiple
            disabled={!engineReady || busy}
            onChange={(event) => chooseLocalFiles(event.target.files)}
          />
          <label
            className={`landing-drop-zone ${dragActive ? "is-active" : ""} ${busy || !engineReady ? "is-disabled" : ""}`}
            htmlFor="xpeng-files"
            aria-disabled={busy || !engineReady}
            tabIndex={busy || !engineReady ? -1 : 0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="drop-upload-icon" aria-hidden="true">↥</span>
            <strong aria-live="polite">{dragActive ? t("dropActive") : t("dropTitle")}</strong>
            <small>{t("dropHint")}</small>
            <span className="drop-browse">{busy ? t("importing") : t("chooseFiles")}</span>
          </label>
        </div>

        <div className="start-options">
          <div className="start-options-heading">
            <span>{t("continueKicker")}</span>
            <strong>{t("continueTitle")}</strong>
            <p>{t("continueBody")}</p>
          </div>
          <div className="drive-landing-card">
            <div><strong>{t("driveOpenTitle")}</strong><p>{drive.configured ? t("driveOpenHelp") : t("driveNotConfigured")}</p></div>
            <button type="button" disabled={busy || drive.busy || !engineReady || !drive.configured} onClick={()=>openGoogleDrive()}>{drive.busy ? t("driveWorking") : t("driveOpen")}</button>
            {drive.error ? <span className="drive-error" role="alert">{t(drive.error)}</span> : null}
          </div>
          {persistence.enabled && persistence.hasSavedHistory ? <div className="saved-history-landing">
            <div><strong>{t("savedHistoryAvailable")}</strong><p>{t("savedHistoryAvailableHelp")}</p></div>
            <button type="button" disabled={busy || !engineReady} onClick={restoreSavedHistory}>{t("restoreSavedHistory")}</button>
            <button className="danger-link" type="button" disabled={busy} onClick={forgetSavedHistory}>{t("forgetSavedHistory")}</button>
          </div> : null}
          <div className="start-options-notes">
            <div className="processing-time-alert"><strong>{t("processingTimeTitle")}</strong><p>{t("processingTimeBody")}</p></div>
            <div className="gpx-next-step"><strong>{t("gpxAfterFirstImportTitle")}</strong><p>{t("gpxAfterFirstImportHelp")}</p></div>
          </div>
        </div>
      </section>

      <section className="support-card">
        <div><span>{t("supportKicker")}</span><h2>{t("supportTitle")}</h2><p>{t("supportBody")}</p></div>
        <a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">{t("supportCta")}</a>
      </section>

      {history.length ? <section className="history-card">
        <h2>{t("historyTitle")}</h2>
        <div className="history-table">
          <div className="history-row history-header"><span>{t("file")}</span><span>{t("rows")}</span><span>{t("result")}</span></div>
          {history.map((item, index) => <div className="history-row" key={`${item.name}-${index}`}>
            <span className="history-file"><strong>{item.name}</strong>{item.sourceStartUtc&&item.sourceEndUtc?<small>{formatDateRange(item.sourceStartUtc,item.sourceEndUtc,locale)}</small>:null}</span>
            <span>{formatNumber(item.rows, locale)}</span>
            <span className={`result-tag result-${item.status}`}>{t(item.status)}</span>
          </div>)}
        </div>
      </section> : null}

      <footer className="site-footer"><span>{t("unofficial")}</span><span>{t("ownerLabel")}: Miguel Pinto</span><span>v{APP_VERSION}</span><a href={`${import.meta.env.BASE_URL}about.html`} target="_blank" rel="noreferrer">{t("aboutProject")}</a><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{t("privacyPolicy")}</a><a href="https://github.com/josepinto1989/xpeng-analytics/issues" target="_blank" rel="noreferrer">{t("reportIssue")}</a><a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">Ko-fi</a></footer>
      {tutorialMode ? <TutorialOverlay steps={tutorialSteps} onComplete={finishTutorial} onSkip={skipTutorial} t={t} /> : null}
    </main>
  );
}
