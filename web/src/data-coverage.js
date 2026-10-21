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
