import assert from "node:assert/strict";
import { buildJourneyGroupView, journeyGroupDefinition, validateJourneyGroups } from "../src/journey-groups.js";

const journeys = [
  { journeyId:"j1",date:"2026-10-20",startedAtUtc:"2026-10-20T10:00:00Z",endedAtUtc:"2026-10-20T10:30:00Z",durationMinutes:30,drivingMinutes:30,distanceKm:20,netEnergyKwh:3,energyUsedKwh:3.5,regeneratedKwh:.5,maxSpeedKmh:90,tripIds:["t1"],gps:{trackId:"g1",sourceName:"day.gpx",creator:"GPS",confidenceScore:80,distanceKm:20,points:100,segments:[[{lat:1,lon:1},{lat:2,lon:2}]]}},
  { journeyId:"j2",date:"2026-10-20",startedAtUtc:"2026-10-20T12:00:00Z",endedAtUtc:"2026-10-20T12:45:00Z",durationMinutes:45,drivingMinutes:45,distanceKm:30,netEnergyKwh:4,energyUsedKwh:5,regeneratedKwh:1,maxSpeedKmh:110,tripIds:["t2"]},
];
const definition = journeyGroupDefinition("group-1","Lunch journey",journeys);
assert.deepEqual(definition.journeyIds,["j1","j2"]);
const data={journeys,trips:[{tripId:"t1"},{tripId:"t2"}],charges:[{chargeId:"c1",startedAtUtc:"2026-10-20T10:45:00Z",endedAtUtc:"2026-10-20T11:30:00Z",batteryEnergyKwh:12}],journeyGroups:[definition]};
const view=buildJourneyGroupView(data),group=view.groups[0];
assert.equal(group.distanceKm,50);
assert.equal(group.consumptionKwh100,14);
assert.equal(group.durationMinutes,165);
assert.equal(group.stoppedMinutes,90);
assert.equal(group.sourceJourneys.length,2);
assert.equal(group.attachedCharges[0].chargeId,"c1");
assert.equal(group.gps.points,100);
assert.equal(view.membership.get("t2"),"group-1");
assert.equal(validateJourneyGroups([{...definition,name:"\u0000  My   day "}])[0].name,"My day");
console.log("Manual journey grouping passed.");
