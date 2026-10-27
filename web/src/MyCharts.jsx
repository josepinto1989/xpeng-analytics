import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { buildCustomChart, chartUnit, CHART_DATASETS, CHART_TYPES, CUSTOM_CHART_LIMITS, datasetRows, defaultCustomChart, validateCustomCharts } from "./custom-charts.js";

const COLORS = ["#20a983", "#63b7d4", "#e3a62f"];
const safe = (value) => Array.isArray(value) ? value : [];
const chartId = () => globalThis.crypto?.randomUUID?.() || `chart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const digits = (value, locale) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value)) : "—";
const displayValue = (value, locale) => Number.isFinite(Number(value)) ? digits(value, locale) : String(value ?? "—");

function ChartTooltip({ active, label, payload, locale, xName, xUnit }) {
  if (!active || !payload?.length) return null;
  const xValue = label ?? payload[0]?.payload?.__x;
  return <div className="my-chart-tooltip"><strong>{xName ? `${xName}: ` : ""}{displayValue(xValue, locale)}{xUnit ? ` ${xUnit}` : ""}</strong>{payload.map((item, index) => <span key={`${item.dataKey || item.name || "series"}-${index}`} style={{ "--series-colour": item.color || item.fill }}><i />{item.name}<b>{digits(item.value, locale)}</b></span>)}</div>;
}

function SavedChart({ definition, data, units, locale, t, actions, focused = false }) {
  const built = useMemo(() => buildCustomChart(data, definition, units, locale), [data, definition, units, locale]);
  const source = CHART_DATASETS[definition.dataset];
  const seriesTitle = built.series.map((field) => t(field.label)).join(", ");
  const title = definition.title || `${t(source.label)}${seriesTitle ? ` · ${seriesTitle}` : ""}`;
  const tooltip = <ChartTooltip locale={locale} xName={t(built.xField.label)} xUnit={chartUnit(built.xField, units)} />;
  const common = <><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey={built.xKey} type={definition.type === "scatter" ? "number" : "category"} tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={22} /><YAxis tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} width={48} /><Tooltip content={tooltip} /><Legend wrapperStyle={{ fontSize: 10 }} /></>;
  let chart = null;
  if (!built.missing) {
    if (definition.type === "bar" || definition.type === "histogram") chart = <BarChart data={built.rows} margin={{ top: 18, right: 18, left: 0, bottom: 5 }}>{common}{built.series.map((field, index) => <Bar key={field.key} dataKey={field.key} name={`${t(field.label)}${chartUnit(field, units) ? ` (${chartUnit(field, units)})` : ""}`} fill={COLORS[index]} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}</BarChart>;
    else if (definition.type === "scatter") chart = <ScatterChart margin={{ top: 18, right: 18, left: 0, bottom: 5 }}><CartesianGrid stroke="var(--grid)" /><XAxis dataKey={built.xKey} type="number" name={t(built.xField.label)} unit={chartUnit(built.xField, units)} tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis dataKey={built.series[0]?.key} type="number" name={t(built.series[0]?.label)} unit={chartUnit(built.series[0], units)} tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false} width={48} /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={tooltip} /><Scatter data={built.rows} name={`${t(built.series[0]?.label)}${chartUnit(built.series[0], units) ? ` (${chartUnit(built.series[0], units)})` : ""}`} fill={COLORS[0]} isAnimationActive={false} /></ScatterChart>;
    else if (definition.type === "area") chart = <AreaChart data={built.rows} margin={{ top: 18, right: 18, left: 0, bottom: 5 }}>{common}{built.series.map((field, index) => <Area key={field.key} type="monotone" dataKey={field.key} name={`${t(field.label)}${chartUnit(field, units) ? ` (${chartUnit(field, units)})` : ""}`} stroke={COLORS[index]} fill={COLORS[index]} fillOpacity={0.12} strokeWidth={2} connectNulls isAnimationActive={false} />)}</AreaChart>;
    else chart = <LineChart data={built.rows} margin={{ top: 18, right: 18, left: 0, bottom: 5 }}>{common}{built.series.map((field, index) => <Line key={field.key} type="monotone" dataKey={field.key} name={`${t(field.label)}${chartUnit(field, units) ? ` (${chartUnit(field, units)})` : ""}`} stroke={COLORS[index]} strokeWidth={2} dot={built.rows.length < 45} connectNulls isAnimationActive={false} />)}</LineChart>;
  }
  return <section id={`saved-chart-${definition.id}`} className={`dash-panel my-chart-card ${focused?"is-search-focus":""}`}><header><div><span className="my-chart-dataset">{t(source.label)}</span><h3>{title}</h3>{definition.description ? <p>{definition.description}</p> : null}</div>{actions ? <div className="my-chart-actions"><button type="button" onClick={actions.up} disabled={actions.first} aria-label={t("chartMoveUp")}>↑</button><button type="button" onClick={actions.down} disabled={actions.last} aria-label={t("chartMoveDown")}>↓</button><button type="button" onClick={actions.edit}>{t("chartEdit")}</button><button type="button" onClick={actions.duplicate} disabled={actions.duplicateDisabled}>{t("chartDuplicate")}</button><button className="is-danger" type="button" onClick={actions.remove}>{t("chartDelete")}</button></div> : null}</header>{built.missing ? <div className="chart-empty-state"><strong>{t("chartUnavailable")}</strong><p>{t("chartUnavailableHelp")}</p></div> : <div className="my-chart-canvas"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 900, height: 330 }}>{chart}</ResponsiveContainer></div>}</section>;
}

function ChartEditor({ initial, data, units, locale, t, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const source = CHART_DATASETS[draft.dataset];
  const rows = safe(datasetRows(data, draft.dataset));
  const hasField = (field) => rows.some((row) => row?.[field.key] != null && row[field.key] !== "" && (field.temporal || Number.isFinite(Number(row[field.key]))));
  const allFields = [...source.x, ...source.y.filter((field) => !source.x.some((candidate) => candidate.key === field.key))];
  const xFields = allFields.filter(hasField).filter((field) => draft.type !== "scatter" && draft.type !== "histogram" || !field.temporal);
  const yFields = source.y.filter(hasField);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const changeDataset = (dataset) => setDraft((current) => ({ ...defaultCustomChart(dataset), id: current.id, title: current.title, description: current.description }));
  const changeType = (type) => setDraft((current) => {
    const selectedSource = CHART_DATASETS[current.dataset], availableX = [...selectedSource.x, ...selectedSource.y.filter((field) => !selectedSource.x.some((candidate) => candidate.key === field.key))].filter((field) => type !== "scatter" && type !== "histogram" || !field.temporal);
    return { ...current, type, x: availableX.some((field) => field.key === current.x) ? current.x : availableX[0]?.key || current.x, y: type === "histogram" ? [] : current.y.slice(0, type === "scatter" ? 1 : CUSTOM_CHART_LIMITS.series) };
  });
  const toggleY = (key) => setDraft((current) => {
    const active = current.y.includes(key);
    if (active) return { ...current, y: current.y.filter((item) => item !== key) };
    const limit = current.type === "scatter" ? 1 : CUSTOM_CHART_LIMITS.series;
    const retained = limit > 1 ? current.y.slice(-(limit - 1)) : [];
    return { ...current, y: [...retained, key] };
  });
  const preview = useMemo(() => buildCustomChart(data, draft, units, locale), [data, draft, units, locale]);
  const valid = draft.x && (draft.type === "histogram" || draft.y.length) && !preview.missing;
  return <section className="my-chart-builder">
    <div className="my-chart-form">
      <div className="my-chart-form-heading"><div><span>{draft.id ? t("chartEditKicker") : t("chartCreateKicker")}</span><h2>{draft.id ? t("chartEditTitle") : t("chartCreateTitle")}</h2></div><button type="button" onClick={onCancel} aria-label={t("chartCancel")}>×</button></div>
      <div className="my-chart-fields">
        <label><span>{t("chartDataGroup")}</span><select value={draft.dataset} onChange={(event) => changeDataset(event.currentTarget.value)}>{Object.entries(CHART_DATASETS).filter(([key]) => safe(datasetRows(data, key)).length).map(([key, dataset]) => <option key={key} value={key}>{t(dataset.label)}</option>)}</select></label>
        <label><span>{t("chartType")}</span><select value={draft.type} onChange={(event) => changeType(event.currentTarget.value)}>{CHART_TYPES.map((type) => <option key={type} value={type}>{t(`chartType_${type}`)}</option>)}</select></label>
        <label><span>{draft.type === "histogram" ? t("chartMeasuredField") : t("chartXAxis")}</span><select value={draft.x} onChange={(event) => update("x", event.currentTarget.value)}>{xFields.map((field) => <option key={field.key} value={field.key}>{t(field.label)}{chartUnit(field, units) ? ` (${chartUnit(field, units)})` : ""}</option>)}</select></label>
        {draft.type !== "scatter" && draft.type !== "histogram" && source.x.some((field) => field.key === draft.x && field.temporal) ? <label><span>{t("chartGrouping")}</span><select value={draft.groupBy} onChange={(event) => update("groupBy", event.currentTarget.value)}><option value="none">{t("chartNoGrouping")}</option><option value="day">{t("chartGroupDay")}</option><option value="month">{t("chartGroupMonth")}</option></select></label> : null}
        <label><span>{t("period")}</span><select value={draft.period} onChange={(event) => update("period", event.currentTarget.value)}><option value="7">{t("sevenDays")}</option><option value="15">{t("fifteenDays")}</option><option value="30">{t("thirtyDays")}</option><option value="all">{t("allData")}</option><option value="custom">{t("customPeriod")}</option></select></label>
        {draft.period === "custom" ? <><label><span>{t("startDate")}</span><input type="date" value={draft.start} onChange={(event) => update("start", event.currentTarget.value)} /></label><label><span>{t("endDate")}</span><input type="date" value={draft.end} onChange={(event) => update("end", event.currentTarget.value)} /></label></> : null}
      </div>
      {draft.type !== "histogram" ? <fieldset className="my-chart-series"><legend>{t("chartYSeries")}</legend><p>{draft.type === "scatter" ? t("chartChooseOneMetric") : t("chartChooseMetrics")}</p><div>{yFields.map((field) => <label key={field.key} className={draft.y.includes(field.key) ? "is-selected" : ""}><input type="checkbox" checked={draft.y.includes(field.key)} onChange={() => toggleY(field.key)} /><span>{t(field.label)}{chartUnit(field, units) ? <small>{chartUnit(field, units)}</small> : null}</span></label>)}</div></fieldset> : null}
      <div className="my-chart-text"><label><span>{t("chartCustomTitle")}</span><input value={draft.title} maxLength={CUSTOM_CHART_LIMITS.title} placeholder={t("chartAutomaticTitle")} onChange={(event) => update("title", event.currentTarget.value)} /></label><label><span>{t("chartDescription")}</span><textarea value={draft.description} maxLength={CUSTOM_CHART_LIMITS.description} rows="3" placeholder={t("chartDescriptionPlaceholder")} onChange={(event) => update("description", event.currentTarget.value)} /></label></div>
      <div className="my-chart-editor-actions"><button type="button" onClick={onCancel}>{t("chartCancel")}</button><button className="primary" type="button" disabled={!valid} onClick={() => onSave({ ...draft, id: draft.id || chartId() })}>{draft.id ? t("chartSaveChanges") : t("chartSave")}</button></div>
    </div>
    <div className="my-chart-preview"><span>{t("chartLivePreview")}</span><SavedChart definition={{ ...draft, id: draft.id || "preview" }} data={data} units={units} locale={locale} t={t} actions={null} /></div>
  </section>;
}

export default function MyCharts({ data, units, locale, t, onSave, focusId = null }) {
  const charts = validateCustomCharts(data.customCharts);
  const [editing, setEditing] = useState(null);
  useEffect(()=>{if(!focusId)return;const timer=requestAnimationFrame(()=>document.getElementById(`saved-chart-${focusId}`)?.scrollIntoView({block:"center",behavior:"smooth"}));return()=>cancelAnimationFrame(timer);},[focusId]);
  const saveAll = (next) => onSave(validateCustomCharts(next));
  const saveChart = (definition) => { const index = charts.findIndex((chart) => chart.id === definition.id); saveAll(index >= 0 ? charts.map((chart, at) => at === index ? definition : chart) : [...charts, definition]); setEditing(null); };
  const move = (index, amount) => { const target = index + amount; if (target < 0 || target >= charts.length) return; const next = charts.slice(); [next[index], next[target]] = [next[target], next[index]]; saveAll(next); };
  const duplicate = (chart) => { if (charts.length < CUSTOM_CHART_LIMITS.charts) saveAll([...charts, { ...chart, id: chartId(), title: chart.title ? `${chart.title} · ${t("chartCopy")}` : "" }]); };
  const remove = (chart) => { if (window.confirm(t("chartDeleteConfirm"))) saveAll(charts.filter((item) => item.id !== chart.id)); };
  if (editing) return <ChartEditor initial={editing} data={data} units={units} locale={locale} t={t} onSave={saveChart} onCancel={() => setEditing(null)} />;
  const firstDataset = Object.keys(CHART_DATASETS).find((key) => safe(datasetRows(data, key)).length) || "daily";
  return <div className="my-charts-page"><div className="my-charts-intro"><div><span>{t("chartStudioKicker")}</span><h2>{t("chartStudioTitle")}</h2><p>{t("chartStudioBody")}</p></div><button type="button" disabled={charts.length >= CUSTOM_CHART_LIMITS.charts} onClick={() => setEditing(defaultCustomChart(firstDataset))}>＋ {t("chartCreate")}</button></div>{charts.length ? <div className="my-charts-list">{charts.map((chart, index) => <SavedChart key={chart.id} definition={chart} data={data} units={units} locale={locale} t={t} focused={chart.id===focusId} actions={{ first: index === 0, last: index === charts.length - 1, up: () => move(index, -1), down: () => move(index, 1), edit: () => setEditing(chart), duplicate: () => duplicate(chart), remove: () => remove(chart), duplicateDisabled: charts.length >= CUSTOM_CHART_LIMITS.charts }} />)}</div> : <div className="my-charts-empty"><div>⌁</div><strong>{t("chartEmptyTitle")}</strong><p>{t("chartEmptyBody")}</p><button type="button" onClick={() => setEditing(defaultCustomChart(firstDataset))}>{t("chartCreateFirst")}</button></div>}</div>;
}
