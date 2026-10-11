import React, { useEffect, useMemo, useRef, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import { defaultLocale, translator } from "./i18n.js";


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
};

function formatNumber(value, locale, options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value ?? 0));
}

function createWorker() {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  return new Worker(new URL("import-worker.js", base), {
    type: "module",
    name: "xpeng-analytics-processor",
  });
}

export default function App() {
  const [locale, setLocale] = useState(defaultLocale);
  const [theme, setTheme] = useState("light");
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState({ percent: 2, phase: "runtime_load" });
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const historyInputRef = useRef(null);
  const workerRef = useRef(null);
  const queueRef = useRef([]);
  const activeFileRef = useRef(null);
  const t = useMemo(() => translator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const worker = createWorker();
    workerRef.current = worker;
    worker.addEventListener("message", (event) => {
      const message = event.data ?? {};
      if (message.type === "progress") {
        setProgress({ percent: message.percent ?? 0, phase: message.phase });
      } else if (message.type === "ready") {
        setEngineReady(true);
        setBusy(false);
        setProgress({ percent: 0, phase: null });
      } else if (message.type === "imported") {
        setSnapshot(message.snapshot);
        setHistory((current) => [{
          name: activeFileRef.current?.name ?? "—",
          status: message.result.skipped ? "alreadyImported" : "added",
          rows: message.result.totalRows ?? 0,
        }, ...current]);
        processNext();
      } else if (message.type === "history_imported") {
        setSnapshot(message.snapshot);
        setHistory([{ name: activeFileRef.current?.name ?? "—", status: "historyLoaded", rows: message.snapshot?.overview?.tripCount ?? 0 }]);
        activeFileRef.current = null;
        setBusy(false);
        setProgress({ percent: 100, phase: "complete" });
      } else if (message.type === "history_exported") {
        const blob = new Blob([message.payload], { type: "application/gzip" });
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
        setError(message.code ?? "unknown_error");
        if (activeFileRef.current) {
          setHistory((current) => [{ name: activeFileRef.current.name, status: "failed", rows: 0 }, ...current]);
        }
        queueRef.current = [];
        activeFileRef.current = null;
        setBusy(false);
      }
    });
    worker.addEventListener("error", () => {
      setError("engine_error");
      setBusy(false);
    });
    worker.postMessage({ type: "initialise" });
    return () => worker.terminate();
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
    setBusy(true);
    setError(null);
    setProgress({ percent: 8, phase: "archive_write" });
    next.arrayBuffer().then((archive) => {
      workerRef.current.postMessage({ type: "import", filename: next.name, archive }, [archive]);
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

  const chooseHistory = (files) => {
    const selected = [...files].find((file) => file.name.toLowerCase().endsWith(".json.gz"));
    if (!selected || busy || !engineReady) return;
    if (snapshot && !window.confirm(t("replaceWithHistoryConfirm"))) return;
    activeFileRef.current = selected;
    setBusy(true);
    setError(null);
    setProgress({ percent: 5, phase: "history_read" });
    selected.arrayBuffer().then((archive) => {
      workerRef.current.postMessage({ type: "import_history", filename: selected.name, archive }, [archive]);
    }).catch(() => {
      setError("invalid_history");
      setBusy(false);
    });
    if (historyInputRef.current) historyInputRef.current.value = "";
  };

  const exportHistory = () => {
    if (!snapshot || busy || !engineReady) return;
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
        <div className="privacy-card">
          <div className="privacy-icon" aria-hidden="true">⌁</div>
          <div><strong>{t("privacyTitle")}</strong><p>{t("privacyBody")}</p></div>
        </div>
      </section>

      <section className="workspace" aria-busy={busy}>
        <div className="upload-card">
          <div className="upload-heading">
            {busy ? <strong className="progress-percent">{Math.round(progress.percent ?? 0)}%</strong> : <><span className={`status-dot ${error ? "is-error" : engineReady ? "is-ready" : ""}`} /><strong>{statusText}</strong></>}
            <span className="local-badge">{t("localOnly")}</span>
          </div>
          {busy ? <><div className="progress"><span style={{ width: `${Math.max(3, progress.percent)}%` }} /></div><p className="progress-phase" aria-live="polite">{statusText}</p></> : null}
          {error ? <div className="error-message" role="alert">{t(errorKeys[error] ?? "errorUnknown")}</div> : null}
          <input
            ref={inputRef}
            className="visually-hidden"
            id="xpeng-files"
            type="file"
            accept=".zip,application/zip"
            multiple
            disabled={!engineReady || busy}
            onChange={(event) => chooseFiles(event.target.files)}
          />
          <input ref={historyInputRef} className="visually-hidden" id="history-file" type="file" accept=".gz,application/gzip" disabled={!engineReady || busy} onChange={(event) => chooseHistory(event.target.files)} />
          <div className="landing-actions">
            <label className={`file-button ${busy || !engineReady ? "is-disabled" : ""}`} htmlFor="xpeng-files"><span aria-hidden="true">＋</span>{busy ? t("importing") : t("chooseFiles")}</label>
            <label className={`file-button file-button-secondary ${busy || !engineReady ? "is-disabled" : ""}`} htmlFor="history-file"><span aria-hidden="true">↥</span>{t("importHistoryFile")}</label>
          </div>
          <p className="drop-hint">{t("dropHint")}</p>
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

      <footer className="site-footer"><span>{t("unofficial")}</span><span>{t("ownerLabel")}: Miguel Pinto</span><a href="https://github.com/josepinto1989/xpeng-analytics/issues" target="_blank" rel="noreferrer">{t("reportIssue")}</a><a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">Ko-fi</a></footer>
    </main>
  );
}
