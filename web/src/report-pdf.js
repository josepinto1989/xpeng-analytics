import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { consumptionUnit, consumptionValue, distanceUnit, distanceValue } from "./units.js";

const PAGE = [595.28, 841.89];
const MARGIN = 42;
const CONTENT_WIDTH = PAGE[0] - MARGIN * 2;
const COLORS = {
  ink: rgb(0.055, 0.15, 0.15),
  muted: rgb(0.38, 0.48, 0.47),
  mint: rgb(0.08, 0.55, 0.42),
  mintSoft: rgb(0.91, 0.97, 0.95),
  line: rgb(0.82, 0.87, 0.86),
  panel: rgb(0.97, 0.98, 0.98),
  amberSoft: rgb(1, 0.96, 0.88),
};

const safe = (rows) => Array.isArray(rows) ? rows : [];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const total = (rows, field) => safe(rows).reduce((sum, row) => sum + number(row?.[field]), 0);
const clean = (value) => String(value ?? "")
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/\u2192/g, "to")
  .replace(/\u00b7/g, "-")
  .replace(/\u00a0/g, " ");

function formatNumber(value, locale, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Number(value));
}

function formatMoney(value, locale) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value));
}

function formatDate(value, locale) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

function formatDuration(minutes, t) {
  const value = number(minutes);
  if (value >= 60) return `${Math.floor(value / 60)} ${t("hourShort")} ${Math.round(value % 60)} ${t("minuteShort")}`;
  return `${Math.round(value)} ${t("minuteShort")}`;
}

function fitText(text, font, size, maxWidth) {
  const value = clean(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return `${result.trim()}...`;
}

function wrapText(text, font, size, maxWidth) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function downloadReportPdf({ data, locale, t, startDate, endDate, energyPrice, reference, units = { system: "metric", pressure: "bar" } }) {
  const first = startDate && endDate && startDate > endDate ? endDate : startDate;
  const last = startDate && endDate && startDate > endDate ? startDate : endDate;
  const inside = (row) => {
    const date = String(row?.date || row?.startedAtUtc || "").slice(0, 10);
    return date && (!first || date >= first) && (!last || date <= last);
  };
  const daily = safe(data.daily).filter(inside).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const journeys = safe(data.journeys).filter(inside);
  const trips = safe(data.trips).filter(inside);
  const charges = safe(data.charges).filter(inside).slice().sort((a, b) => String(a.startedAtUtc).localeCompare(String(b.startedAtUtc)));
  const hasPrice = Number.isFinite(energyPrice) && energyPrice >= 0;
  const distance = total(daily, "distanceKm");
  const netEnergy = total(daily, "netEnergyKwh");
  const wallEnergy = total(charges, "wallEnergyKwh");
  const batteryEnergy = total(charges, "batteryEnergyKwh");
  const losses = total(charges, "lossKwh");
  const estimatedCost = hasPrice ? wallEnergy * energyPrice : null;
  const displayDistance = distanceValue(distance, units.system);
  const distanceLabel = distanceUnit(units.system);
  const consumptionLabel = consumptionUnit(units.system);
  const costPer100 = hasPrice && displayDistance ? estimatedCost / displayDistance * 100 : null;
  const consumption = distance ? netEnergy / distance * 100 : null;
  const efficiency = wallEnergy ? batteryEnergy / wallEnergy * 100 : null;
  const mostActiveDay = daily.reduce((best, row) => number(row.distanceKm) > number(best?.distanceKm) ? row : best, null);
  const averageJourney = journeys.length ? distance / journeys.length : null;
  const longestJourney = journeys.reduce((best, row) => number(row.distanceKm) > number(best?.distanceKm) ? row : best, null);
  const usedEnergy = total(trips, "energyUsedKwh"), regeneratedEnergy = total(trips, "regeneratedKwh");
  const regenerationShare = usedEnergy + regeneratedEnergy ? regeneratedEnergy / (usedEnergy + regeneratedEnergy) * 100 : null;
  const acEnergy = total(charges.filter((row) => row.chargeType === "AC"), "batteryEnergyKwh");
  const dcEnergy = total(charges.filter((row) => row.chargeType === "DC"), "batteryEnergyKwh");
  const peakChargingPower = charges.reduce((peak, row) => Math.max(peak, number(row.maxPowerKw)), 0) || null;

  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(t("reportPdfTitle")));
  pdf.setAuthor("Miguel Pinto");
  pdf.setSubject(clean(t("reportPdfSubject")));
  pdf.setCreator("XPENG Analytics");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page;
  let y;

  const addPage = () => {
    page = pdf.addPage(PAGE);
    y = PAGE[1] - MARGIN;
    page.drawText("XPENG", { x: MARGIN, y, size: 13, font: bold, color: COLORS.ink });
    page.drawText("ANALYTICS", { x: MARGIN + 47, y: y + 1, size: 8, font: regular, color: COLORS.mint });
    page.drawLine({ start: { x: MARGIN, y: y - 10 }, end: { x: PAGE[0] - MARGIN, y: y - 10 }, thickness: 0.8, color: COLORS.line });
    y -= 34;
  };
  const ensureSpace = (height) => { if (y - height < 64) addPage(); };
  const drawWrapped = (text, { x = MARGIN, size = 9, font = regular, color = COLORS.muted, width = CONTENT_WIDTH, lineHeight = 13 } = {}) => {
    const lines = wrapText(text, font, size, width);
    lines.forEach((line) => { page.drawText(line, { x, y, size, font, color }); y -= lineHeight; });
    return lines.length;
  };
  const sectionTitle = (title, subtitle) => {
    ensureSpace(subtitle ? 48 : 30);
    page.drawText(clean(title), { x: MARGIN, y, size: 13, font: bold, color: COLORS.ink });
    y -= 15;
    if (subtitle) drawWrapped(subtitle, { size: 8.5, lineHeight: 11 });
    y -= 8;
  };

  addPage();
  page.drawText(clean(t("reportPdfTitle")), { x: MARGIN, y, size: 25, font: bold, color: COLORS.ink });
  y -= 28;
  page.drawText(`${formatDate(first, locale)} - ${formatDate(last, locale)}`, { x: MARGIN, y, size: 11, font: bold, color: COLORS.mint });
  y -= 18;
  if (reference?.trim()) {
    page.drawText(`${clean(t("reportReference"))}: ${fitText(reference.trim(), regular, 9, CONTENT_WIDTH - 85)}`, { x: MARGIN, y, size: 9, font: regular, color: COLORS.muted });
    y -= 17;
  }
  drawWrapped(t("reportPdfIntro"), { size: 9.5, lineHeight: 14 });
  y -= 10;

  const metrics = [
    [t("distance"), `${formatNumber(displayDistance, locale)} ${distanceLabel}`],
    [t("journeys"), `${formatNumber(journeys.length, locale, 0)} (${formatNumber(trips.length, locale, 0)} ${t("tripsLower")})`],
    [t("drivingTime"), `${formatNumber(total(daily, "drivingHours"), locale)} ${t("hourShort")}`],
    [t("averageConsumption"), `${formatNumber(consumptionValue(consumption, units.system), locale)} ${consumptionLabel}`],
    [t("charges"), formatNumber(charges.length, locale, 0)],
    [t("gridEnergy"), `${formatNumber(wallEnergy, locale)} kWh`],
    [t("reportEstimatedCost"), hasPrice ? formatMoney(estimatedCost, locale) : t("reportNotProvided")],
    [`${t("reportCostPer100")} ${distanceLabel}`, hasPrice ? `${formatMoney(costPer100, locale)} / 100 ${distanceLabel}` : t("reportNotProvided")],
  ];
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const cardHeight = 54;
  metrics.forEach(([label, value], index) => {
    if (index && index % 2 === 0) y -= cardHeight + gap;
    const x = MARGIN + (index % 2) * (cardWidth + gap);
    page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, color: index < 2 ? COLORS.mintSoft : COLORS.panel, borderColor: COLORS.line, borderWidth: 0.6 });
    page.drawText(fitText(label, regular, 7.5, cardWidth - 22).toUpperCase(), { x: x + 11, y: y - 17, size: 7.5, font: regular, color: COLORS.muted });
    page.drawText(fitText(value, bold, 14, cardWidth - 22), { x: x + 11, y: y - 39, size: 14, font: bold, color: COLORS.ink });
  });
  y -= cardHeight + 24;

  sectionTitle(t("reportChargingSummary"));
  const chargingRows = [
    [t("batteryEnergy"), `${formatNumber(batteryEnergy, locale)} kWh`],
    [t("losses"), `${formatNumber(losses, locale)} kWh`],
    [t("chargeEfficiency"), `${formatNumber(efficiency, locale)}%`],
    [t("totalChargingTime"), formatDuration(total(charges, "durationMinutes"), t)],
  ];
  chargingRows.forEach(([label, value], index) => {
    const x = MARGIN + index * (CONTENT_WIDTH / 4);
    page.drawText(fitText(label, regular, 7.5, CONTENT_WIDTH / 4 - 10), { x, y, size: 7.5, font: regular, color: COLORS.muted });
    page.drawText(fitText(value, bold, 11, CONTENT_WIDTH / 4 - 10), { x, y: y - 17, size: 11, font: bold, color: COLORS.ink });
  });
  y -= 46;

  sectionTitle(t("reportInsights"), t("reportInsightsHelp"));
  const insightRows = [
    [t("reportMostActiveDay"), mostActiveDay ? `${formatDate(mostActiveDay.date, locale)} - ${formatNumber(distanceValue(mostActiveDay.distanceKm, units.system), locale)} ${distanceLabel}` : t("reportNotProvided")],
    [t("reportAverageJourney"), `${formatNumber(distanceValue(averageJourney, units.system), locale)} ${distanceLabel}`],
    [t("reportLongestJourney"), longestJourney ? `${formatNumber(distanceValue(longestJourney.distanceKm, units.system), locale)} ${distanceLabel}` : t("reportNotProvided")],
    [t("reportRegenerationShare"), `${formatNumber(regenerationShare, locale)}%`],
    [t("reportAcDcSplit"), `${formatNumber(acEnergy, locale)} / ${formatNumber(dcEnergy, locale)} kWh`],
    [t("reportPeakChargingPower"), `${formatNumber(peakChargingPower, locale)} kW`],
  ];
  insightRows.forEach(([label, value], index) => {
    if (index && index % 2 === 0) y -= 34;
    const x = MARGIN + (index % 2) * (cardWidth + gap);
    page.drawText(fitText(label, regular, 7.5, cardWidth - 10), { x, y, size: 7.5, font: regular, color: COLORS.muted });
    page.drawText(fitText(value, bold, 10.5, cardWidth - 10), { x, y: y - 16, size: 10.5, font: bold, color: COLORS.ink });
  });
  y -= 48;

  page.drawRectangle({ x: MARGIN, y: y - 42, width: CONTENT_WIDTH, height: 42, color: COLORS.amberSoft });
  y -= 13;
  drawWrapped(hasPrice
    ? `${t("reportCostBasis")}: ${formatMoney(energyPrice, locale)}/kWh. ${t("reportDisclaimer")}`
    : `${t("reportPriceMissing")} ${t("reportDisclaimer")}`,
  { x: MARGIN + 12, width: CONTENT_WIDTH - 24, size: 8, lineHeight: 11, color: COLORS.muted });
  y -= 22;

  const drawTable = (title, subtitle, headers, rows, widths) => {
    const rowHeight = 18;
    const headerHeight = 22;
    const estimatedHeight = (subtitle ? 48 : 30) + headerHeight + rows.length * rowHeight + 18;
    if (rows.length <= 20 && y - estimatedHeight < 64) addPage();
    sectionTitle(title, subtitle);
    const drawHeader = () => {
      page.drawRectangle({ x: MARGIN, y: y - headerHeight, width: CONTENT_WIDTH, height: headerHeight, color: COLORS.mintSoft });
      let x = MARGIN + 5;
      headers.forEach((header, index) => {
        page.drawText(fitText(header, bold, 7, widths[index] - 10), { x, y: y - 14, size: 7, font: bold, color: COLORS.ink });
        x += widths[index];
      });
      y -= headerHeight;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      if (y - rowHeight < 64) {
        addPage();
        page.drawText(clean(title), { x: MARGIN, y, size: 11, font: bold, color: COLORS.ink });
        y -= 18;
        drawHeader();
      }
      if (rowIndex % 2) page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: COLORS.panel });
      let x = MARGIN + 5;
      row.forEach((cell, index) => {
        page.drawText(fitText(cell, regular, 7.2, widths[index] - 10), { x, y: y - 12, size: 7.2, font: regular, color: COLORS.ink });
        x += widths[index];
      });
      page.drawLine({ start: { x: MARGIN, y: y - rowHeight }, end: { x: PAGE[0] - MARGIN, y: y - rowHeight }, thickness: 0.35, color: COLORS.line });
      y -= rowHeight;
    });
    if (!rows.length) {
      page.drawText(clean(t("reportNoRows")), { x: MARGIN + 5, y: y - 14, size: 8, font: regular, color: COLORS.muted });
      y -= rowHeight;
    }
    y -= 18;
  };

  drawTable(
    t("reportDailyBreakdown"),
    t("reportDailyBreakdownHelp"),
    [t("date"), t("distance"), t("used"), t("averageConsumption"), t("gridEnergy"), t("reportEstimatedCost")],
    daily.map((row) => [
      formatDate(row.date, locale),
      `${formatNumber(distanceValue(row.distanceKm, units.system), locale)} ${distanceLabel}`,
      `${formatNumber(row.energyUsedKwh, locale)} kWh`,
      `${formatNumber(consumptionValue(row.consumptionKwh100, units.system), locale)} ${consumptionLabel}`,
      `${formatNumber(row.wallEnergyKwh, locale)} kWh`,
      hasPrice ? formatMoney(number(row.wallEnergyKwh) * energyPrice, locale) : "-",
    ]),
    [73, 71, 74, 100, 88, 105],
  );

  drawTable(
    t("reportChargingDetails"),
    t("reportChargingDetailsHelp"),
    [t("date"), t("chargeType"), t("duration"), t("batteryEnergy"), t("gridEnergy"), t("reportEstimatedCost")],
    charges.map((row) => [
      formatDate(row.date || row.startedAtUtc, locale),
      clean(row.chargeType || "-"),
      formatDuration(row.durationMinutes, t),
      `${formatNumber(row.batteryEnergyKwh, locale)} kWh`,
      `${formatNumber(row.wallEnergyKwh, locale)} kWh`,
      hasPrice ? formatMoney(number(row.wallEnergyKwh) * energyPrice, locale) : "-",
    ]),
    [73, 55, 82, 94, 88, 119],
  );

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: 49 }, end: { x: PAGE[0] - MARGIN, y: 49 }, thickness: 0.5, color: COLORS.line });
    current.drawText(clean(t("unofficial")), { x: MARGIN, y: 34, size: 6.8, font: regular, color: COLORS.muted });
    const pageText = `${t("reportPage")} ${index + 1}/${pages.length}`;
    current.drawText(pageText, { x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(pageText, 6.8), y: 34, size: 6.8, font: regular, color: COLORS.muted });
    const creditText = `${t("reportCreatedBy")} Miguel Pinto - https://josepinto1989.github.io/xpeng-analytics/`;
    current.drawText(creditText, { x: (PAGE[0] - regular.widthOfTextAtSize(creditText, 6.8)) / 2, y: 22, size: 6.8, font: regular, color: COLORS.mint });
  });

  const bytes = await pdf.save();
  if (typeof document === "undefined") return bytes;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `xpeng-analytics-report-${first || "start"}_${last || "end"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bytes;
}
