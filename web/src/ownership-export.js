import { chargeEstimatedCost, ownershipMaps } from "./ownership-metadata.js";

const csv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const rows = (value) => Array.isArray(value) ? value : [];

export function buildOwnershipCsv(data, { startDate = "", endDate = "" } = {}) {
  const inside = (row) => { const date=String(row?.date||row?.startedAtUtc||"").slice(0,10); return date&&(!startDate||date>=startDate)&&(!endDate||date<=endDate); };
  const maps = ownershipMaps(data?.ownership);
  const header = ["record_type","id","date","start_time","end_time","classification","custom_label","charge_type","distance_km","duration_minutes","consumption_kwh_100","battery_energy_kwh","grid_energy_kwh","estimated_cost","currency"];
  const records = [header];
  rows(data?.journeys).filter(inside).forEach((row) => { const tag=maps.journeys.get(row.journeyId); records.push(["journey",row.journeyId,String(row.date||row.startedAtUtc).slice(0,10),row.startedAtUtc,row.endedAtUtc,tag?.kind||"unlabelled",tag?.label||"","",row.distanceKm,row.durationMinutes,row.consumptionKwh100,"","","",""]); });
  rows(data?.charges).filter(inside).forEach((row) => { const tag=maps.charges.get(row.chargeId),cost=chargeEstimatedCost(row,maps.activeTariff); records.push(["charge",row.chargeId,String(row.date||row.startedAtUtc).slice(0,10),row.startedAtUtc,row.endedAtUtc,tag?.category||"unlabelled",tag?.label||"",row.chargeType,"","","",row.batteryEnergyKwh,row.wallEnergyKwh,cost==null?"":cost.toFixed(2),maps.activeTariff?.currency||""]); });
  return records.map((record) => record.map(csv).join(",")).join("\r\n");
}

export function downloadOwnershipCsv(data, options = {}) {
  const blob = new Blob(["\ufeff", buildOwnershipCsv(data, options)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href=url; anchor.download=`xpeng-usage-${options.startDate||"all"}-${options.endDate||"all"}.csv`; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
