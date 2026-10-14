import { classifyLocalFiles, createImportPlan } from "../src/file-selection.js";

const zipA = { name: "XPENG-September.ZIP" };
const zipB = { name: "xpeng-october.zip" };
const history = { name: "my-history.xpeng" };
const legacy = { name: "old-history.json.gz" };
const unsupported = { name: "notes.txt" };

const mixed = classifyLocalFiles([zipA, history, zipB, unsupported]);
if (mixed.archives.length !== 2 || mixed.histories.length !== 1 || mixed.unsupported.length !== 1) {
  throw new Error("Mixed XPENG file selection was not classified correctly");
}

const legacyResult = classifyLocalFiles([legacy]);
if (legacyResult.histories[0] !== legacy) throw new Error("Legacy history was not recognised");

const empty = classifyLocalFiles(null);
if (empty.archives.length || empty.histories.length || empty.unsupported.length) {
  throw new Error("Empty selection must produce empty groups");
}

const mixedPlan = createImportPlan([zipA, history, zipB]);
if (mixedPlan.kind !== "history" || mixedPlan.history !== history || mixedPlan.archives.length !== 2) {
  throw new Error("A mixed selection must restore its history before importing all ZIPs");
}

if (createImportPlan([zipA, zipB]).kind !== "archives") throw new Error("Multiple ZIPs must produce an archive import plan");
if (createImportPlan([history, legacy]).kind !== "multiple_histories") throw new Error("Multiple histories must be rejected");
if (createImportPlan([unsupported]).kind !== "invalid_selection") throw new Error("Unsupported-only selections must be rejected");

console.log("Local file selection passed.");
