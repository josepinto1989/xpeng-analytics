import assert from "node:assert/strict";
import { buildInsightCardModel } from "../src/insight-card.js";
const card=buildInsightCardModel({title:"October insight",subtitle:"Recorded 2026-10-12T21:34:00Z",metrics:[{label:"Distance",value:"320 km",note:"route.gpx"}],note:"backup.xpeng"});
assert.equal(card.title,"October insight");
assert.equal(card.metrics.length,1);
assert.ok(!JSON.stringify(card).includes("21:34"));
assert.ok(!JSON.stringify(card).includes(".gpx"));
assert.ok(!JSON.stringify(card).includes(".xpeng"));
console.log("Privacy-safe insight cards passed.");
