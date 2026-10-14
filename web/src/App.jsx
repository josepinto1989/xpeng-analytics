import React, { useEffect, useMemo, useRef, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import { defaultLocale, translator } from "./i18n.js";
import { APP_VERSION } from "./version.js";
import { classifyLocalFiles, createImportPlan } from "./file-selection.js";


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
  complete: "phaseComplete",
  reset: "phaseReset",
  native_ready: "phaseNativeReady",
  native_scan: "phaseNativeScan",
  native_parse: "phaseNativeParse",
  native_merge: "phaseNativeMerge",
  native_analytics: "phaseNativeAnalytics",
  native_snapshot: "phaseNativeSnapshot",
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
};

function formatNumber(value, locale, options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value ?? 0));
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

function memoryBudgetBytes() {
  const gib = 1024 ** 3;
  const reported = Number(navigator.deviceMemory || 0);
  const heap = Number(globalThis.performance?.memory?.jsHeapSizeLimit || 0);
  const mobile = Boolean(navigator.userAgentData?.mobile) || window.matchMedia?.("(max-width: 760px)")?.matches;
  const inferred = heap ? heap * .42 : reported ? reported * gib * .12 : mobile ? 420 * 1024 ** 2 : 1.5 * gib;
  return Math.max(mobile ? 300 * 1024 ** 2 : 900 * 1024 ** 2, Math.min(mobile ? 640 * 1024 ** 2 : 2.5 * gib, inferred));
}

const nativeHistoryMagic = [88, 80, 69, 78, 71, 65, 0, 3];
const isNativeHistory = (buffer) => {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, nativeHistoryMagic.length));
  return bytes.length === nativeHistoryMagic.length && nativeHistoryMagic.every((value, index) => bytes[index] === value);
};

export default function App() {
  const [locale, setLocale] = useState(defaultLocale);
  const [theme, setTheme] = useState("light");
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState({ percent: 2, phase: "runtime_load" });
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const workerRef = useRef(null);
  const workerModeRef = useRef("native");
  const replaceWorkerRef = useRef(null);
  const pendingMessageRef = useRef(null);
  const queueRef = useRef([]);
  const historyFollowupQueueRef = useRef([]);
  const activeFileRef = useRef(null);
  const cancelRequestedRef = useRef(false);
  const dragDepthRef = useRef(0);
  const t = useMemo(() => translator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
        setSnapshot(message.snapshot);
        setHistory((current) => [{
          name: activeFileRef.current?.name ?? "—",
          status: message.result.skipped ? "alreadyImported" : "added",
          rows: message.result.totalRows ?? 0,
        }, ...current]);
        requestAnimationFrame(() => setTimeout(processNext, 0));
      } else if (message.type === "history_imported") {
        setSnapshot(message.snapshot);
        setHistory([{ name: activeFileRef.current?.name ?? "—", status: "historyLoaded", rows: message.snapshot?.overview?.tripCount ?? 0 }]);
        activeFileRef.current = null;
        const followupArchives = historyFollowupQueueRef.current;
        historyFollowupQueueRef.current = [];
        if (followupArchives.length) {
          queueRef.current = followupArchives;
          processNext();
        } else {
          setBusy(false);
          setProgress({ percent: 100, phase: "complete" });
        }
      } else if (message.type === "history_exported") {
        const blob = new Blob([message.payload], { type: "application/octet-stream" });
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
        setSnapshot(null);
        setHistory([]);
        setBusy(false);
        setProgress({ percent: 100, phase: "reset" });
      } else if (message.type === "error") {
        if (message.code === "cancelled") {
          queueRef.current = [];
          historyFollowupQueueRef.current = [];
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

  const processNext = () => {
    const next = queueRef.current.shift();
    if (!next) {
      activeFileRef.current = null;
      setBusy(false);
      setProgress({ percent: 100, phase: "complete" });
      return;
    }
    activeFileRef.current = next;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 8, phase: "archive_write" });
    next.arrayBuffer().then((archive) => {
      if (cancelRequestedRef.current) {
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 0, phase: null });
        return;
      }
      workerRef.current.postMessage({ type: "import", filename: next.name, archive, memoryBudgetBytes: memoryBudgetBytes() }, [archive]);
    }).catch(() => {
      setError("invalid_archive");
      setBusy(false);
    });
  };

  const chooseFiles = (files) => {
    const selected = [...files].filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (!selected.length || busy || !engineReady) return;
    queueRef.current = selected;
    processNext();
    if (inputRef.current) inputRef.current.value = "";
  };

  const importHistoryFile = (selected, followupArchives = []) => {
    if (!selected || busy || !engineReady) return;
    if (snapshot && !window.confirm(t("replaceWithHistoryConfirm"))) return;
    historyFollowupQueueRef.current = followupArchives;
    activeFileRef.current = selected;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 5, phase: "history_read" });
    selected.arrayBuffer().then((archive) => {
      if (cancelRequestedRef.current) {
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 0, phase: null });
        return;
      }
      const mode = isNativeHistory(archive) ? "native" : "legacy";
      const message = { type: "import_history", filename: selected.name, archive };
      if (workerModeRef.current !== mode) replaceWorkerRef.current?.(mode, message);
      else workerRef.current.postMessage(message, [archive]);
    }).catch(() => {
      setError("invalid_history");
      historyFollowupQueueRef.current = [];
      setBusy(false);
    });
  };

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

  const exportHistory = () => {
    if (!snapshot || busy || !engineReady) return;
    cancelRequestedRef.current = false;
    setBusy(true);
    setError(null);
    setProgress({ percent: 5, phase: "history_export" });
    workerRef.current.postMessage({ type: "export_history" });
  };

  const reset = () => {
    if (!window.confirm(t("resetConfirm"))) return;
    setBusy(true);
    setError(null);
    workerRef.current.postMessage({ type: "reset" });
  };

  const cancelProcessing = () => {
    if (!busy || workerModeRef.current !== "native") return;
    cancelRequestedRef.current = true;
    queueRef.current = [];
    historyFollowupQueueRef.current = [];
    workerRef.current.postMessage({ type: "cancel" });
  };

  const source = snapshot?.summary?.source ?? {};
  const trips = snapshot?.summary?.trips ?? {};
  const charges = snapshot?.summary?.charges ?? {};
  const statusText = busy
    ? t(phaseKeys[progress.phase] ?? "loadingEngine")
    : error
      ? t(errorKeys[error] ?? "errorUnknown")
      : t(phaseKeys[progress.phase] ?? "ready");

  if (snapshot) {
    return <Dashboard
      data={snapshot}
      locale={locale}
      setLocale={setLocale}
      t={t}
      busy={busy}
      progress={progress}
      error={error}
      onChoose={chooseFiles}
      onChooseHistory={chooseHistory}
      onExport={exportHistory}
      onReset={reset}
      onCancel={cancelProcessing}
      canCancel={workerModeRef.current === "native"}
      history={history}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
    />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="XPENG Analytics">
          <span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/xpeng-analytics-mark-minimal.png`} alt="" /></span>
          <span><strong>XPENG</strong><small>Analytics</small></span>
        </a>
        <div className="topbar-actions">
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
            <div><strong>{t("privacyTitle")}</strong><p>{t("privacyBody")}</p></div>
          </div>
        </div>
      </section>

      <section className={`workspace ${dragActive ? "is-dragging" : ""}`} aria-busy={busy}>
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
          <div className="processing-time-alert"><strong>{t("processingTimeTitle")}</strong><p>{t("processingTimeBody")}</p></div>
          {snapshot ? <button className="reset-button" type="button" disabled={busy} onClick={reset}>{t("reset")}</button> : null}
        </div>

        {snapshot ? (
          <div className="results">
            <div className="section-label">{t("currentSession")}</div>
            <div className="metrics">
              <article><span>{t("imports")}</span><strong>{formatNumber(source.imports, locale)}</strong></article>
              <article><span>{t("trips")}</span><strong>{formatNumber(trips.trips, locale)}</strong></article>
              <article><span>{t("distance")}</span><strong>{formatNumber(trips.distance_km, locale, { maximumFractionDigits: 1 })}<small> km</small></strong></article>
              <article><span>{t("charges")}</span><strong>{formatNumber(charges.sessions, locale)}</strong></article>
            </div>
          </div>
        ) : (
          <div className="empty-state"><span>01</span><strong>{t("noDataTitle")}</strong><p>{t("noDataBody")}</p></div>
        )}
      </section>

      <section className="support-card">
        <div><span>{t("supportKicker")}</span><h2>{t("supportTitle")}</h2><p>{t("supportBody")}</p></div>
        <a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">{t("supportCta")}</a>
      </section>

      <section className="project-credit">
        <span>{t("creditKicker")}</span>
        <p>{t("creditBody")} <a href="https://logboox.app" target="_blank" rel="noreferrer">LogbooX</a>, {t("creditAuthor")} <a href="https://github.com/schliflo/logboox" target="_blank" rel="noreferrer">{t("creditSource")}</a>.</p>
      </section>

      {history.length ? <section className="history-card">
        <h2>{t("historyTitle")}</h2>
        <div className="history-table">
          <div className="history-row history-header"><span>{t("file")}</span><span>{t("rows")}</span><span>{t("result")}</span></div>
          {history.map((item, index) => <div className="history-row" key={`${item.name}-${index}`}>
            <strong>{item.name}</strong>
            <span>{formatNumber(item.rows, locale)}</span>
            <span className={`result-tag result-${item.status}`}>{t(item.status)}</span>
          </div>)}
        </div>
      </section> : null}

      <footer className="site-footer"><span>{t("unofficial")}</span><span>{t("ownerLabel")}: Miguel Pinto</span><span>v{APP_VERSION}</span><a href="https://logboox.app" target="_blank" rel="noreferrer">LogbooX</a><a href="https://github.com/josepinto1989/xpeng-analytics/issues" target="_blank" rel="noreferrer">{t("reportIssue")}</a><a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">Ko-fi</a></footer>
    </main>
  );
}
