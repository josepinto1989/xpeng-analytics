const rows = (value) => Array.isArray(value) ? value : [];

const archiveKey = (archive) => {
  const digest = String(archive?.sha256 || "").trim().toLowerCase();
  return digest ? `${archive?.kind === "gps" ? "gps" : "xpeng"}:${digest}` : null;
};

export function rememberSessionArchive(cache, archive) {
  const key = archiveKey(archive);
  if (!key || !archive?.file) return rows(cache);
  const existing = rows(cache).find((candidate) => archiveKey(candidate) === key);
  if (!existing) return [...rows(cache), archive];
  return rows(cache).map((candidate) => archiveKey(candidate) === key ? { ...candidate, ...archive } : candidate);
}

export function sessionArchivesToUpload(cache, { archiveOriginals = false, archiveGps = false } = {}) {
  return rows(cache).filter((archive) => archive?.kind === "gps" ? archiveGps : archiveOriginals);
}

export function forgetUploadedSessionArchives(cache, uploaded) {
  const completed = new Set(rows(uploaded).map(archiveKey).filter(Boolean));
  return rows(cache).filter((archive) => !completed.has(archiveKey(archive)));
}
