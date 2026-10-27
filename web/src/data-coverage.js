const finiteTimestamp = (value) => {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
};

export function telemetryCoverage(data) {
  const coverage = Array.isArray(data?.quality?.coverage) ? data.quality.coverage : [];
  const starts = coverage.map((row) => finiteTimestamp(row?.firstUtc)).filter(Number.isFinite);
  const ends = coverage.map((row) => finiteTimestamp(row?.lastUtc)).filter(Number.isFinite);
  const fallbackStart = finiteTimestamp(data?.overview?.firstUtc);
  const fallbackEnd = finiteTimestamp(data?.overview?.lastUtc);
  if (!starts.length && Number.isFinite(fallbackStart)) starts.push(fallbackStart);
  if (!ends.length && Number.isFinite(fallbackEnd)) ends.push(fallbackEnd);
  if (!starts.length || !ends.length) return null;
  return { firstUtc: new Date(Math.min(...starts)).toISOString(), lastUtc: new Date(Math.max(...ends)).toISOString() };
}

export function formatCoverageDate(value, locale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const portuguese = locale === "pt-PT";
  const parts = new Intl.DateTimeFormat(portuguese ? "pt-PT" : "en-GB", {
    day: "2-digit",
    month: portuguese ? "2-digit" : "short",
    year: "2-digit",
  }).formatToParts(date);
  const valueFor = (type) => parts.find((part) => part.type === type)?.value || "";
  return portuguese
    ? `${valueFor("day")}/${valueFor("month")}/${valueFor("year")}`
    : `${valueFor("day")} ${valueFor("month")} ${valueFor("year")}`;
}

export function formatTelemetryCoverage(data, locale) {
  const coverage = telemetryCoverage(data);
  if (!coverage) return "";
  return `${formatCoverageDate(coverage.firstUtc, locale)} — ${formatCoverageDate(coverage.lastUtc, locale)}`;
}

const dateKey = (value) => {
  if (!value) return "";
  const direct = String(value).match(/^(\d{4}-\d{2}-\d{2})$/);
  if (direct) return direct[1];
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const rows = (value) => Array.isArray(value) ? value : [];

export function buildCoverageCalendar(data) {
  const days = new Map();
  const ensure = (date) => {
    const key = dateKey(date);
    if (!key) return null;
    if (!days.has(key)) days.set(key, { date: key, journeys: 0, charges: 0, parking: 0, tyres: 0, gps: 0 });
    return days.get(key);
  };

  rows(data?.journeys).forEach((journey) => {
    const day = ensure(journey?.date || journey?.startedAtUtc);
    if (!day) return;
    day.journeys += 1;
    if (rows(journey?.gps?.segments).length) day.gps += 1;
  });
  rows(data?.charges).forEach((charge) => {
    const day = ensure(charge?.date || charge?.startedAtUtc);
    if (day) day.charges += 1;
  });
  rows(data?.battery?.parking).forEach((interval) => {
    if (!(Number(interval?.observedSeconds) > 0 || Number(interval?.coveragePct) > 0)) return;
    const day = ensure(interval?.startedAtUtc);
    if (day) day.parking += 1;
  });
  rows(data?.battery?.tyres).forEach((observation) => {
    const day = ensure(observation?.date);
    if (day) day.tyres += 1;
  });

  const coverage = telemetryCoverage(data);
  return {
    firstDate: coverage ? dateKey(coverage.firstUtc) : [...days.keys()].sort().at(0) || "",
    lastDate: coverage ? dateKey(coverage.lastUtc) : [...days.keys()].sort().at(-1) || "",
    days,
  };
}

export function coverageCalendarSummary(calendar) {
  const values = [...(calendar?.days?.values?.() || [])];
  return {
    observedDays: values.length,
    journeyDays: values.filter((day) => day.journeys > 0).length,
    chargingDays: values.filter((day) => day.charges > 0).length,
    gpsDays: values.filter((day) => day.gps > 0).length,
  };
}
