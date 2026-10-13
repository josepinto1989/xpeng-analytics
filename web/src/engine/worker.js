import { buildSnapshot, emptyState, exportHistory, importArchive, importHistory } from "./native-engine.js";

let state = emptyState();
let queue = Promise.resolve();
let cancelRequested = false;

const progress = (percent, phase, detail = "") => self.postMessage({ type: "progress", percent, phase, detail });
const guardedProgress = (percent, phase, detail = "") => {
  if (cancelRequested) throw new Error("cancelled");
  progress(percent, phase, detail);
};

function errorCode(error) {
  const message = String(error?.message ?? error);
  if (["invalid_archive", "missing_families", "invalid_data", "out_of_memory", "history_version", "history_integrity", "engine_error", "cancelled"].includes(message)) return message;
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
    progress(2, "native_scan", message.filename || "XPENG ZIP");
    const result = await importArchive(state, message.archive, message.filename, guardedProgress, message.memoryBudgetBytes);
    progress(72, "native_analytics", "Calculating locally");
    const snapshot = buildSnapshot(result.state, guardedProgress);
    state = result.state;
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
    self.postMessage({ type: "history_exported", filename: `xpeng-analytics-history-${date}.xpeng`, metadata: { format: state.format, version: 3 }, payload }, [payload]);
    return;
  }
  if (message?.type === "import_history") {
    cancelRequested = false;
    const restored = await importHistory(message.archive, guardedProgress);
    const snapshot = buildSnapshot(restored, guardedProgress);
    state = restored;
    progress(100, "complete", "Done");
    self.postMessage({ type: "history_imported", engine: "native", metadata: { format: state.format, version: 3 }, snapshot });
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
