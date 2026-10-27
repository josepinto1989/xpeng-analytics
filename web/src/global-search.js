import { distanceUnit, distanceValue } from "./units.js";
import { buildJourneyGroupView } from "./journey-groups.js";

const rows = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();
export const normaliseSearchText = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function dateLabel(value, locale) {
  const date = new Date(String(value || "").length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) : text(value);
}

export function buildGlobalSearchIndex(data, { locale = "en", t = (key) => key, units = { system: "metric" } } = {}) {
  const results = [];
  buildJourneyGroupView(data || {}).groups.forEach((row) => results.push({ id: `journey-group-${row.groupId}`, type: "journey", section: "journeys", sourceId: row.groupId, date: text(row.date || row.startedAtUtc).slice(0, 10), title: row.name || t("unnamedJourneyGroup"), detail: `${Number(distanceValue(row.distanceKm || 0,units.system)).toLocaleString(locale, { maximumFractionDigits: 1 })} ${distanceUnit(units.system)} · ${Number(row.durationMinutes || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} min`, keywords: `${row.name || ""} ${row.date || ""} ${row.sourceJourneyIds?.join(" ") || ""} ${t("manualJourneyGroup")}` }));
  rows(data?.journeys).forEach((row) => results.push({ id: `journey-${row.journeyId}`, type: "journey", section: "journeys", sourceId: row.journeyId, date: text(row.date || row.startedAtUtc).slice(0, 10), title: `${t("journey")} · ${dateLabel(row.date || row.startedAtUtc, locale)}`, detail: `${Number(distanceValue(row.distanceKm || 0,units.system)).toLocaleString(locale, { maximumFractionDigits: 1 })} ${distanceUnit(units.system)} · ${Number(row.durationMinutes || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} min`, keywords: `${row.date || ""} ${row.distanceKm || ""} ${row.durationMinutes || ""} ${row.gps?.segments?.length ? "GPS" : ""}` }));
  rows(data?.charges).forEach((row) => results.push({ id: `charge-${row.chargeId}`, type: "charge", section: "charging", sourceId: row.chargeId, date: text(row.date || row.startedAtUtc).slice(0, 10), title: `${t("chargingSession")} · ${dateLabel(row.date || row.startedAtUtc, locale)}`, detail: `${row.chargeType || "—"} · ${Number(row.batteryEnergyKwh || 0).toLocaleString(locale, { maximumFractionDigits: 1 })} kWh`, keywords: `${row.date || ""} ${row.chargeType || ""} ${row.socStartPct || ""} ${row.socEndPct || ""}` }));
  rows(data?.daily).forEach((row) => results.push({ id: `date-${row.date}`, type: "date", section: "overview", date: text(row.date).slice(0, 10), title: `${t("date")} · ${dateLabel(row.date, locale)}`, detail: `${Number(distanceValue(row.distanceKm || 0,units.system)).toLocaleString(locale, { maximumFractionDigits: 1 })} ${distanceUnit(units.system)} · ${Number(row.journeys || 0)} ${t("journeysLower")}`, keywords: `${row.date || ""} ${row.distanceKm || ""} ${row.consumptionKwh100 || ""}` }));
  rows(data?.customCharts).forEach((row, index) => results.push({ id: `chart-${row.id || index}`, type: "chart", section: "mycharts", sourceId: row.id || null, title: row.title || `${t("nav_mycharts")} ${index + 1}`, detail: row.description || t(`chartDataset${String(row.dataset || "daily").replace(/^./, (letter) => letter.toUpperCase())}`), keywords: `${row.title || ""} ${row.description || ""} ${row.dataset || ""} ${row.type || ""}` }));
  ["overview","journeys","driving","activity","trends","charging","battery","tyres","insights","replay","mycharts","report","quality","data"].forEach((section) => results.push({ id: `section-${section}`, type: "section", section, title: t(`nav_${section}`), detail: t(`section_${section}_help`), keywords: `${t(`nav_${section}`)} ${t(`section_${section}_help`)}` }));
  [
    ["settings","settings",t("settings"),t("settingsHelp")],
    ["units","settings",t("measurementUnits"),`${t("metricUnits")} ${t("imperialUnits")}`],
    ["pressure","settings",t("tyrePressureUnit"),"bar psi"],
    ["language","settings",t("language"),"English Português"],
  ].forEach(([id,type,title,detail]) => results.push({ id:`tool-${id}`,type,section:null,title,detail,keywords:`${title} ${detail}` }));
  return results.map((row) => ({ ...row, searchText: normaliseSearchText(`${row.title} ${row.detail} ${row.keywords}`) }));
}

export function searchGlobalIndex(index, query, limit = 30) {
  const terms = normaliseSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return rows(index).filter((row) => terms.every((term) => row.searchText.includes(term))).sort((a, b) => {
    const aTitle = normaliseSearchText(a.title), bTitle = normaliseSearchText(b.title);
    const exact = Number(bTitle.startsWith(terms[0])) - Number(aTitle.startsWith(terms[0]));
    return exact || String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title);
  }).slice(0, limit);
}
