import { buildSnapshot, emptyState, exportHistory, importArchive, importGps, importHistory, setGpsAssignment } from "./native-engine.js";

let state = emptyState();
let queue = Promise.resolve();
let cancelRequested = false;
let lastProgressAt = 0;
let lastProgressPercent = -1;
let lastProgressPhase = "";

const progress = (percent, phase, detail = "") => self.postMessage({ type: "progress", percent, phase, detail });
const guardedProgress = (percent, phase, detail = "") => {
  if (cancelRequested) throw new Error("cancelled");
  const now = performance.now();
  if (phase !== lastProgressPhase || percent >= 96 || percent - lastProgressPercent >= .5 || now - lastProgressAt >= 120) {
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
    state = emptyState();
    self.postMessage({ type: "reset_complete" });
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
    const snapshot = buildSnapshot(state, guardedProgress);
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
    self.postMessage({ type: "history_exported", purpose: message.purpose || "download", filename: `xpeng-analytics-history-${date}.xpeng`, metadata: { format: state.format, version: state.version }, payload }, [payload]);
    return;
  }
  if (message?.type === "import_history") {
    cancelRequested = false;
    const restored = await importHistory(message.file ?? message.archive, guardedProgress);
    const snapshot = buildSnapshot(restored, guardedProgress);
    state = restored;
    progress(100, "complete", "Done");
    self.postMessage({ type: "history_imported", engine: "native", metadata: { format: state.format, version: state.version }, snapshot });
    return;
  }
  if (message?.type === "import_gps") {
    cancelRequested = false;
    progress(4, "gps_parse", message.filename || "GPX");
    const result = await importGps(state, message.file ?? message.archive, message.filename, message.options || {}, guardedProgress);
    state = result.state;
    progress(72, "gps_match", "Matching journeys");
    const snapshot = buildSnapshot(state, guardedProgress);
    progress(100, "complete", "Done");
    self.postMessage({ type: "gps_imported", result: { skipped: result.skipped, trackCount: result.trackCount, pointCount: result.pointCount }, snapshot });
    return;
  }
  if (message?.type === "set_gps_assignment") {
    cancelRequested = false;
    lastProgressAt = 0;
    lastProgressPercent = -1;
    lastProgressPhase = "";
    state = setGpsAssignment(state, message.trackId, message.journeyId || null);
    const snapshot = buildSnapshot(state, guardedProgress);
    self.postMessage({ type: "gps_assignment_updated", snapshot });
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "cancel") {
    cancelRequested = true;
    return;
  }
  queue = queue.then(() => handle(event.data)).catch((error) => {
    console.error(error);
    self.postMessage({ type: "error", code: errorCode(error), detail: String(error?.stack ?? error) });
  });
});
