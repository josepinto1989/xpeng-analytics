import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(webRoot, "..");
const outputRoot = join(webRoot, "public", "processor");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "pyodide"), { recursive: true });
await mkdir(join(outputRoot, "python"), { recursive: true });

const pyodideRoot = join(webRoot, "node_modules", "pyodide");
for (const name of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  await copyFile(join(pyodideRoot, name), join(outputRoot, "pyodide", name));
}

const pythonSources = [];
const packageRoot = join(projectRoot, "src", "xpeng_data");
for (const entry of await readdir(packageRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".py")) pythonSources.push(`src/xpeng_data/${entry.name}`);
}

for (const name of pythonSources) {
  const destination = join(outputRoot, "python", name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(projectRoot, name), destination);
}

await writeFile(
  join(outputRoot, "python-files.json"),
  JSON.stringify({
    format: "xpeng-analytics-browser-processor/v1",
    files: pythonSources.map((name) => name.replaceAll("\\", "/")),
  }),
  "utf8",
);

console.log(`Browser processor prepared in ${relative(projectRoot, outputRoot)}`);
