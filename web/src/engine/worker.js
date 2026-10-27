import { addHistoryRebuildSource, beginHistoryRebuild, buildSnapshot, clearDetailCache, detectAdditionalFileKind, emptyState, exportHistory, finishHistoryRebuild, importArchive, importGps, importHistory, loadRecordDetails, setCustomCharts, setJourneyGroups, setOwnershipMetadata, setRawArchives } from "./native-engine.js";

let state = emptyState();
let queue = Promise.resolve();
let cancelRequested = false;
let lastProgressAt = 0;
let lastProgressPercent = -1;
let lastProgressPhase = "";
let historyRefreshContext = null;

const progress = (percent, phase, detail = "") => self.postMessage({ type: "progress", percent, phase, detail });
const snapshotWithMetadata = (snapshot) => ({ ...snapshot, ownership: state.ownership });
const guardedProgress = (percent, phase, detail = "") => {
  if (cancelRequested) throw new Error("cancelled");
  const now = performance.now();
  if (phase !== lastProgressPhase || percent >= 96 || percent - lastProgressPercent >= 1 || now - lastProgressAt >= 200) {
    lastProgressAt = now;
    lastProgressPercent = percent;
    lastProgressPhase = phase;
    progress(percent, phase, detail);
  }
};

function errorCode(error) {
  const message = String(error?.message ?? error);
  if (["invalid_archive", "missing_families", "invalid_data", "invalid_gpx", "gps_trim_too_large", "out_of_memory", "history_version", "history_integrity", "engine_error", "cancelled"].includes(message)) return message;
  if (message.includes("memory") || message.includes("allocation")) return "out_of_memory";
  return "unknown_error";
}

async function handle(message) {
  if (message?.type === "initialise") {
    progress(80, "native_ready", "JavaScript worker");
    self.postMessage({ type: "ready", engine: "native" });
    return;
  }
  if (message?.type === "reset") {
    clearDetailCache();
    state = emptyState();
    self.postMessage({ type: "reset_complete" });
    return;
  }
  if (message?.type === "set_custom_charts") {
    state = setCustomCharts(state, message.charts);
    self.postMessage({ type: "custom_charts_updated", charts: state.customCharts });
    return;
  }
  if (message?.type === "set_journey_groups") {
    state = setJourneyGroups(state, message.groups);
    const snapshot = snapshotWithMetadata(buildSnapshot(state, guardedProgress));
    self.postMessage({ type: "journey_groups_updated", groups: state.journeyGroups, snapshot });
    return;
  }
  if (message?.type === "set_ownership") {
    state = setOwnershipMetadata(state, message.ownership);
    self.postMessage({ type: "ownership_updated", ownership: state.ownership });
    return;
  }
  if (message?.type === "set_raw_archives") {
    state = setRawArchives(state, message.updates);
    self.postMessage({ type: "raw_archives_updated", rawArchives: state.rawArchives });
    return;
  }
  if (message?.type === "load_details") {
    const details = await loadRecordDetails(state, message.request || {}, guardedProgress);
    self.postMessage({ type: "details_loaded", requestId: message.requestId, details });
    return;
  }
  if (message?.type === "import") {
    cancelRequested = false;
    lastProgressAt = 0;
    lastProgressPercent = -1;
    lastProgressPhase = "";
    progress(2, "native_scan", message.filename || "XPENG ZIP");
    const source = message.file ?? message.archive;
    const result = await importArchive(state, source, message.filename, guardedProgress, message.processingProfile ?? message.memoryBudgetBytes);
    progress(72, "native_analytics", "Calculating locally");
    state = result.state;
    const snapshot = snapshotWithMetadata(buildSnapshot(state, guardedProgress));
    progress(100, "complete", "Done");
    self.postMessage({
      type: "imported",
      engine: "native",
      result: {
        skipped: result.skipped,
        archiveSha256: result.archiveSha256,
        totalRows: result.totalRows,
        sourceStartUtc: result.sourceStartUtc,
        sourceEndUtc: result.sourceEndUtc,
      },
      snapshot,
    });
    return;
  }
  if (message?.type === "export_history") {
    cancelRequested = false;
    const payload = await exportHistory(state, guardedProgress);
    const date = new Date().toISOString().slice(0, 10);
    progress(100, "history_export_complete", "Done");
    self.postMessage({ type: "history_exported", purpose: message.purpose || "download", filename: `xpeng-analytics-history-${date}.xpeng`, metadata: { format: state.format, version: state.version }, payload });
    return;
  }
  if (message?.type === "import_history") {
    cancelRequested = false;
    clearDetailCache();
    const restored = await importHistory(message.file ?? message.archive, guardedProgress);
    state = restored;
    const snapshot = snapshotWithMetadata(buildSnapshot(restored, guardedProgress));
    progress(100, "complete", "Done");
    self.postMessage({ type: "history_imported", engine: "native", metadata: { format: state.format, version: state.version, sourceVersion: restored.sourceHistoryVersion }, snapshot });
    return;
  }
  if (message?.type === "refresh_history_begin") {
    cancelRequested = false;
    clearDetailCache();
    progress(2, "drive_history_refresh", "Reading the existing history");
    historyRefreshContext = await beginHistoryRebuild(message.history, (percent, _phase, detail) => guardedProgress(2 + percent * .06, "drive_history_refresh", detail));
    self.postMessage({ type: "history_refresh_ready" });
    return;
  }
  if (message?.type === "refresh_history_source") {
    if (!historyRefreshContext) throw new Error("history_integrity");
    const index = Number(message.index || 0), total = Math.max(1, Number(message.total || 1));
    historyRefreshContext = await addHistoryRebuildSource(historyRefreshContext, { file: message.file, name: message.filename }, message.kind, (percent, _phase, detail) => guardedProgress(8 + ((index + percent / 100) / total) * 82, "drive_history_refresh", `${index + 1}/${total} · ${detail || message.filename || "Source"}`), message.processingProfile || {});
    self.postMessage({ type: "history_refresh_source_imported", index });
    return;
  }
  if (message?.type === "refresh_history_finish") {
    if (!historyRefreshContext) throw new Error("history_integrity");
    state = await finishHistoryRebuild(historyRefreshContext, (percent, _phase, detail) => guardedProgress(90 + percent * .09, "drive_history_refresh", detail));
    historyRefreshContext = null;
    const snapshot = snapshotWithMetadata(state.snapshot || buildSnapshot(state, guardedProgress));
    progress(100, "complete", "Done");
    self.postMessage({ type: "history_refreshed", engine: "native", metadata: { format: state.format, version: state.version, sourceVersion: state.sourceHistoryVersion }, snapshot });
    return;
  }
  if (message?.type === "import_gps") {
    cancelRequested = false;
    progress(4, "gps_parse", message.filename || "GPX");
    const result = await importGps(state, message.file ?? message.archive, message.filename, message.options || {}, guardedProgress);
    state = result.state;
    progress(72, "gps_match", "Matching journeys");
    const snapshot = snapshotWithMetadata(buildSnapshot(state, guardedProgress));
    progress(100, "complete", "Done");
    self.postMessage({ type: "gps_imported", result: { skipped: result.skipped, trackCount: result.trackCount, pointCount: result.pointCount }, snapshot });
    return;
  }
  if (message?.type === "import_additional") {
    cancelRequested = false;
    lastProgressAt = 0;
    lastProgressPercent = -1;
    lastProgressPhase = "";
    const source = message.file ?? message.archive, kind = await detectAdditionalFileKind(source, message.filename);
    let result;
    if (kind === "gps") {
      progress(4, "gps_parse", message.filename || "GPX");
      result = await importGps(state, source, message.filename, message.options || {}, guardedProgress);
      state = result.state;
      progress(72, "gps_match", "Matching journeys");
    } else {
      progress(2, "native_scan", message.filename || "XPENG ZIP");
      result = await importArchive(state, source, message.filename, guardedProgress, message.processingProfile || {});
      state = result.state;
      progress(72, "native_analytics", "Calculating locally");
    }
    const snapshot = snapshotWithMetadata(buildSnapshot(state, guardedProgress));
    progress(100, "complete", "Done");
    self.postMessage({ type: "additional_imported", kind, result: kind === "gps" ? { skipped: result.skipped, sourceSha256: result.sourceSha256, trackCount: result.trackCount, pointCount: result.pointCount } : { skipped: result.skipped, archiveSha256: result.archiveSha256, totalRows: result.totalRows, sourceStartUtc: result.sourceStartUtc, sourceEndUtc: result.sourceEndUtc }, snapshot });
    return;
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "cancel") {
    cancelRequested = true;
    return;
  }
  queue = queue.then(() => handle(event.data)).catch((error) => {
    if (String(event.data?.type || "").startsWith("refresh_history_")) historyRefreshContext = null;
    console.error(error);
    self.postMessage({ type: "error", code: errorCode(error), detail: String(error?.stack ?? error) });
  });
});
