import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { consumptionUnit, consumptionValue, distanceUnit, distanceValue } from "./units.js";
import { buildCustomChart } from "./custom-charts.js";
import { buildLifetimeHighlights } from "./lifetime-highlights.js";
import { ownershipMaps } from "./ownership-metadata.js";

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

function formatMoney(value, locale, currency = "EUR") {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
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

export async function downloadReportPdf({ data, locale, t, startDate, endDate, energyPrice, currency = "EUR", reference, includeMaps = false, includeMonthly = true, includeHighlights = true, selectedChartIds = [], units = { system: "metric", pressure: "bar" } }) {
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
  const ownership = ownershipMaps(data.ownership);

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
    [t("reportEstimatedCost"), hasPrice ? formatMoney(estimatedCost, locale, currency) : t("reportNotProvided")],
    [`${t("reportCostPer100")} ${distanceLabel}`, hasPrice ? `${formatMoney(costPer100, locale, currency)} / 100 ${distanceLabel}` : t("reportNotProvided")],
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
    ? `${t("reportCostBasis")}: ${formatMoney(energyPrice, locale, currency)}/kWh. ${t("reportDisclaimer")}`
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
      hasPrice ? formatMoney(number(row.wallEnergyKwh) * energyPrice, locale, currency) : "-",
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
      hasPrice ? formatMoney(number(row.wallEnergyKwh) * energyPrice, locale, currency) : "-",
    ]),
    [73, 55, 82, 94, 88, 119],
  );

  drawTable(
    t("classifiedJourneys"),
    t("classifiedJourneysHelp"),
    [t("date"), t("classification"), t("customLabel"), t("distance"), t("duration")],
    journeys.map((row) => { const tag=ownership.journeys.get(row.journeyId); return [formatDate(row.date||row.startedAtUtc,locale),clean(tag?.kind? t(`journeyKind_${tag.kind}`):t("unlabelled")),clean(tag?.label||"-"),`${formatNumber(distanceValue(row.distanceKm,units.system),locale)} ${distanceLabel}`,formatDuration(row.durationMinutes,t)]; }),
    [76, 92, 135, 96, 112],
  );

  const categoryTotals=["home","work","public","custom"].map((category)=>{const categoryRows=charges.filter((row)=>ownership.charges.get(row.chargeId)?.category===category);return [t(`chargeCategory_${category}`),`${categoryRows.length}`,`${formatNumber(total(categoryRows,"wallEnergyKwh"),locale)} kWh`,hasPrice?formatMoney(total(categoryRows,"wallEnergyKwh")*energyPrice,locale,currency):"-"];}).filter((row)=>row[1]!=="0");
  drawTable(t("chargingByLocation"),t("chargingByLocationHelp"),[t("classification"),t("sessions"),t("gridEnergy"),t("reportEstimatedCost")],categoryTotals,[130,90,135,156]);

  if(includeMonthly&&daily.length){
    addPage(); sectionTitle(t("automaticMonthlySummary"),t("includeMonthlySummaryHelp"));
    const shown=daily.slice(-31),maxDistance=Math.max(1,...shown.map((row)=>number(row.distanceKm))),barWidth=CONTENT_WIDTH/Math.max(1,shown.length);
    page.drawLine({start:{x:MARGIN,y:y-170},end:{x:PAGE[0]-MARGIN,y:y-170},thickness:.6,color:COLORS.line});
    shown.forEach((row,index)=>{const height=number(row.distanceKm)/maxDistance*145;page.drawRectangle({x:MARGIN+index*barWidth+1,y:y-170,width:Math.max(1,barWidth-2),height,color:COLORS.mint});});
    y-=196;
    drawWrapped(`${t("distance")}: ${formatNumber(displayDistance,locale)} ${distanceLabel} · ${t("averageConsumption")}: ${formatNumber(consumptionValue(consumption,units.system),locale)} ${consumptionLabel} · ${t("reportEstimatedCost")}: ${hasPrice?formatMoney(estimatedCost,locale,currency):t("reportNotProvided")}`,{size:9,font:bold,color:COLORS.ink});
  }

  if(includeHighlights){
    const highlights=buildLifetimeHighlights(data); addPage(); sectionTitle(t("nav_highlights"),t("section_highlights_help"));
    const highlightRows=[[t("highlightTopSpeed"),`${formatNumber(highlights.fastest?.maxSpeedKmh,locale)} km/h`],[t("highlightPeakPower"),`${formatNumber(highlights.power?.peakDrivePowerKw,locale)} kW`],[t("highlightLongestDistance"),`${formatNumber(distanceValue(highlights.distance?.distanceKm,units.system),locale)} ${distanceLabel}`],[t("highlightLongestTime"),formatDuration(highlights.duration?.durationMinutes,t)],[t("highlightZeroToHundred"),highlights.sprint?`${formatNumber(highlights.sprint.zeroToHundredSeconds,locale,2)} s`:t("notObserved")],[t("highlightRegenerated"),`${formatNumber(highlights.totalRegeneratedKwh,locale)} kWh`]];
    highlightRows.forEach(([label,value],index)=>{const column=index%2,row=Math.floor(index/2),x=MARGIN+column*(cardWidth+gap),top=y-row*74;page.drawRectangle({x,y:top-58,width:cardWidth,height:58,color:COLORS.panel,borderColor:COLORS.line,borderWidth:.5});page.drawText(fitText(label,regular,8,cardWidth-20),{x:x+10,y:top-19,size:8,font:regular,color:COLORS.muted});page.drawText(fitText(value,bold,14,cardWidth-20),{x:x+10,y:top-42,size:14,font:bold,color:COLORS.ink});});
    y-=238;
  }

  const selectedCharts=safe(data.customCharts).filter((chart)=>selectedChartIds.includes(chart.id));
  for(const config of selectedCharts){
    const model=buildCustomChart(data,config,units,locale);if(model.missing)continue;addPage();sectionTitle(config.title||t("nav_mycharts"),config.description||"");
    const chartRows=model.rows.slice(-100),series=model.series.slice(0,3),values=chartRows.flatMap((row)=>series.map((item)=>number(row[item.key]))),min=Math.min(0,...values),max=Math.max(1,...values),height=270,width=CONTENT_WIDTH,palette=[COLORS.mint,rgb(.39,.72,.83),rgb(.89,.65,.18)];
    page.drawRectangle({x:MARGIN,y:y-height,width,height,color:COLORS.panel,borderColor:COLORS.line,borderWidth:.6});
    series.forEach((item,seriesIndex)=>{let previous=null;chartRows.forEach((row,index)=>{const point={x:MARGIN+(chartRows.length===1?.5:index/(chartRows.length-1))*width,y:y-12-(number(row[item.key])-min)/(max-min)*(height-30)};if(config.type==="bar"||config.type==="histogram")page.drawRectangle({x:point.x,y:y-height,width:Math.max(1,width/chartRows.length/series.length-1),height:Math.max(0,point.y-(y-height)),color:palette[seriesIndex]});else if(previous)page.drawLine({start:previous,end:point,thickness:1.3,color:palette[seriesIndex]});previous=point;});page.drawText(fitText(t(item.label),regular,8,150),{x:MARGIN+seriesIndex*165,y:y-height-16,size:8,font:regular,color:palette[seriesIndex]});});
    y-=height+34;
  }

  if (includeMaps) {
    const mappedJourneys = journeys.filter((journey) => safe(journey.gps?.segments).some((segment) => safe(segment).length > 1));
    for (let journeyIndex = 0; journeyIndex < mappedJourneys.length; journeyIndex++) {
      const journey = mappedJourneys[journeyIndex];
      if (journeyIndex % 2 === 0) {
        addPage();
        page.drawText(clean(t("reportRouteMaps")), { x: MARGIN, y, size: 16, font: bold, color: COLORS.ink });
        y -= 18;
        drawWrapped(t("reportRouteMapsDisclaimer"), { size: 8, lineHeight: 11 });
        y -= 10;
      }
      ensureSpace(300);
      const box = { x: MARGIN, y: y - 226, width: CONTENT_WIDTH, height: 226 };
      page.drawRectangle({ ...box, color: COLORS.panel, borderColor: COLORS.line, borderWidth: .7 });
      const heading = `${formatDate(journey.startedAtUtc, locale)} - ${formatNumber(distanceValue(journey.distanceKm, units.system), locale)} ${distanceLabel}`;
      page.drawText(fitText(heading, bold, 10.5, CONTENT_WIDTH - 24), { x: box.x + 12, y: box.y + box.height - 20, size: 10.5, font: bold, color: COLORS.ink });
      page.drawText(fitText(`${t("gpsSource")}: ${journey.gps.sourceName}`, regular, 7.5, CONTENT_WIDTH - 24), { x: box.x + 12, y: box.y + box.height - 34, size: 7.5, font: regular, color: COLORS.muted });
      const sourceSegments = safe(journey.gps.segments).map((segment) => safe(segment).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))).filter((segment) => segment.length > 1);
      const allPoints = sourceSegments.flat();
      const minLat = Math.min(...allPoints.map((point) => point.lat)), maxLat = Math.max(...allPoints.map((point) => point.lat));
      const minLon = Math.min(...allPoints.map((point) => point.lon)), maxLon = Math.max(...allPoints.map((point) => point.lon));
      const drawBox = { x: box.x + 14, y: box.y + 16, width: box.width - 28, height: box.height - 62 };
      const lonSpan = Math.max(1e-7, maxLon - minLon), latSpan = Math.max(1e-7, maxLat - minLat);
      const scale = Math.min(drawBox.width / lonSpan, drawBox.height / latSpan);
      const routeWidth = lonSpan * scale, routeHeight = latSpan * scale;
      const originX = drawBox.x + (drawBox.width - routeWidth) / 2, originY = drawBox.y + (drawBox.height - routeHeight) / 2;
      const project = (point) => ({ x: originX + (point.lon - minLon) * scale, y: originY + (point.lat - minLat) * scale });
      for (const segment of sourceSegments) {
        const step = Math.max(1, Math.ceil(segment.length / 500));
        const sampled = segment.filter((_, index) => index % step === 0);
        if (sampled.at(-1) !== segment.at(-1)) sampled.push(segment.at(-1));
        for (let index = 1; index < sampled.length; index++) page.drawLine({ start: project(sampled[index - 1]), end: project(sampled[index]), thickness: 1.5, color: COLORS.mint });
      }
      const firstPoint = project(allPoints[0]), lastPoint = project(allPoints.at(-1));
      page.drawCircle({ ...firstPoint, size: 3.2, color: COLORS.mint });
      page.drawCircle({ ...lastPoint, size: 3.2, color: rgb(.89,.48,.40) });
      y = box.y - 18;
    }
  }

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
