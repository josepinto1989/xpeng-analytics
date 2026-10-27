import assert from "node:assert/strict";
import { chargeEstimatedCost, ownershipMaps, upsertChargeCategory, upsertJourneyLabel, validateOwnershipMetadata } from "../src/ownership-metadata.js";
import { buildOwnershipCsv } from "../src/ownership-export.js";

let ownership=validateOwnershipMetadata();
ownership=upsertJourneyLabel(ownership,"journey-1","business");
ownership=upsertChargeCategory(ownership,"charge-1","home");
ownership=validateOwnershipMetadata({...ownership,tariffs:[{id:"home",name:"Home night",pricePerKwh:.18,currency:"EUR"}],activeTariffId:"home"});
const maps=ownershipMaps(ownership);
assert.equal(maps.journeys.get("journey-1").kind,"business");
assert.equal(maps.charges.get("charge-1").category,"home");
assert.ok(Math.abs(chargeEstimatedCost({wallEnergyKwh:20},maps.activeTariff)-3.6)<1e-9);
const csv=buildOwnershipCsv({ownership,journeys:[{journeyId:"journey-1",date:"2026-10-01",distanceKm:42,durationMinutes:35}],charges:[{chargeId:"charge-1",date:"2026-10-02",chargeType:"AC",wallEnergyKwh:20,batteryEnergyKwh:18}]});
assert.match(csv,/business/);assert.match(csv,/home/);assert.match(csv,/3\.60/);
console.log("ownership metadata and CSV: ok");
