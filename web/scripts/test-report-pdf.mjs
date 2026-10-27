import assert from "node:assert/strict";
import { downloadReportPdf } from "../src/report-pdf.js";

const data={ownership:{journeyLabels:[{id:"j1",kind:"business",label:"Client"}],chargeCategories:[{id:"c1",category:"home",label:""}]},daily:[{date:"2026-10-01",distanceKm:50,netEnergyKwh:9,energyUsedKwh:10,wallEnergyKwh:12,drivingHours:1}],journeys:[{journeyId:"j1",date:"2026-10-01",distanceKm:50,durationMinutes:60}],trips:[{tripId:"t1",date:"2026-10-01",distanceKm:50,energyUsedKwh:10,regeneratedKwh:1,maxSpeedKmh:110}],charges:[{chargeId:"c1",date:"2026-10-01",startedAtUtc:"2026-10-01T20:00:00Z",chargeType:"AC",batteryEnergyKwh:10,wallEnergyKwh:12,durationMinutes:120,efficiencyPct:83}],customCharts:[{id:"distance",title:"Distance",description:"Daily distance",dataset:"daily",type:"bar",x:"date",y:["distanceKm"],period:"all",groupBy:"day"}]};
const bytes=await downloadReportPdf({data,locale:"en",t:(key)=>key,startDate:"2026-10-01",endDate:"2026-10-01",energyPrice:.2,currency:"EUR",includeMonthly:true,includeHighlights:true,selectedChartIds:["distance"],units:{system:"metric",pressure:"bar"}});
assert.ok(bytes.length>1000);assert.equal(String.fromCharCode(...bytes.slice(0,4)),"%PDF");
console.log("report PDF options: ok");
