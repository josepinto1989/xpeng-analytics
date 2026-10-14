const lowerName = (file) => String(file?.name || "").toLowerCase();

export function classifyLocalFiles(fileList) {
  const result = { archives: [], histories: [], unsupported: [] };

  for (const file of Array.from(fileList || [])) {
    const name = lowerName(file);
    if (name.endsWith(".zip")) result.archives.push(file);
    else if (name.endsWith(".xpeng") || name.endsWith(".json.gz") || name.endsWith(".gz")) result.histories.push(file);
    else result.unsupported.push(file);
  }

  return result;
}

export function createImportPlan(fileList) {
  const { archives, histories } = classifyLocalFiles(fileList);
  if (histories.length > 1) return { kind: "multiple_histories" };
  if (histories.length === 1) return { kind: "history", history: histories[0], archives };
  if (archives.length) return { kind: "archives", archives };
  return { kind: "invalid_selection" };
}
