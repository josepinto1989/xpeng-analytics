import assert from "node:assert/strict";
import { bestZeroToHundredSeconds, buildLifetimeHighlights } from "../src/lifetime-highlights.js";

assert.equal(bestZeroToHundredSeconds([0,1,2,3,4,5],[0,22,48,73,96,104]),4.5);
assert.equal(bestZeroToHundredSeconds([0,10],[0,110]),null,"large telemetry gaps must not create a sprint");
const result=buildLifetimeHighlights({trips:[{tripId:"a",maxSpeedKmh:90,peakDrivePowerKw:120,maxAccelerationG:.4,maxBrakingG:.5,maxLateralG:.3,zeroToHundredSeconds:8.2,distanceKm:20,regeneratedKwh:2},{tripId:"b",maxSpeedKmh:130,peakDrivePowerKw:180,maxAccelerationG:.5,maxBrakingG:.7,maxLateralG:.6,zeroToHundredSeconds:7.8,distanceKm:30,regeneratedKwh:3}],journeys:[{journeyId:"j1",distanceKm:50,durationMinutes:90}],charges:[{chargeId:"c1",maxPowerKw:190}]});
assert.equal(result.fastest.tripId,"b");assert.equal(result.sprint.zeroToHundredSeconds,7.8);assert.equal(result.distance.journeyId,"j1");assert.equal(result.totalDistanceKm,50);assert.equal(result.charge.maxPowerKw,190);
console.log("Lifetime highlights passed.");
