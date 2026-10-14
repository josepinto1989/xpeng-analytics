import { readFile, writeFile } from "node:fs/promises";
import { buildSnapshot, emptyState, importArchive } from "../src/engine/native-engine.js";
import { translator } from "../src/i18n.js";
import { downloadReportPdf } from "../src/report-pdf.js";

const [sourcePath, outputPath = "report-verification.pdf", system = "metric"] = process.argv.slice(2);
if (!sourcePath) throw new Error("Usage: node scripts/verify-report-pdf.mjs <xpeng.zip> [output.pdf] [metric|imperial]");

const source = await readFile(sourcePath);
const imported = await importArchive(emptyState(), source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), sourcePath, () => {});
const data = buildSnapshot(imported.state);
const dates = [...data.daily.map((row) => row.date), ...data.charges.map((row) => row.date)].filter(Boolean).sort();
const bytes = await downloadReportPdf({
  data,
  locale: "en",
  t: translator("en"),
  startDate: dates.at(0),
  endDate: dates.at(-1),
  energyPrice: 0.22,
  reference: "Visual verification",
  units: { system, pressure: "bar" },
});
await writeFile(outputPath, bytes);
console.log(JSON.stringify({ outputPath, pagesSourceDays: data.daily.length, bytes: bytes.byteLength }));
