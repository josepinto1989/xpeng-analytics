// Streaming, columnar browser architecture inspired by LogbooX.
// See THIRD_PARTY_NOTICES.md for attribution and the MIT licence notice.
import { GPX_LIMITS, gpsSnapshot, parseGpxText } from "./gpx.js";

const FAMILY_MARKERS = {
  operation: "driving_operation",
  energy: "driving_power_energy",
  status: "driving_status",
};

const SPECS = {
  operation: [
    ["esp_vehspd", "speed_kmh", ["esp_vehspd", "ipb_vehspd"], (x) => x < 0 || x > 220],
    ["esp_vehlongaccel", "longitudinal_accel", ["esp_vehlongaccel", "ipb_vehlongaccel_e2e"]],
    ["esp_vehlateralaccel", "lateral_accel", ["esp_vehlateralaccel", "ipb_vehlateralaccel_e2e"]],
    ["cdcu_totalodometer", "odometer_km", null, (x) => x < 0 || x > 2_000_000],
    ["eps_steeringangle", "steering_angle_deg", null, (x) => Math.abs(x) > 900],
    ["eps_steeringanglespd", "steering_speed_deg_s", null, (x) => Math.abs(x) > 2_000],
    ["ldcu_accpedalsig", "accelerator_pct", null, (x) => x < 0 || x > 100],
    ["ldcu_brkpedalst", "brake_status", ["ldcu_brkpedalst", "ipb_brkpedalst", "esp_brkpedalst"]],
    ["ldcu_currentgearlev", "gear_level"],
  ],
  energy: [
    ["ipuf_actrotspd", "front_motor_rpm"], ["ipur_actrotspd", "rear_motor_rpm"],
    ["ipuf_acttorq", "front_motor_torque_nm"], ["ipur_acttorq", "rear_motor_torque_nm"],
    ["ipuf_rotoracttemp", "front_rotor_temp_c"], ["ipur_rotoracttemp", "rear_rotor_temp_c"],
    ["bms_battvolt", "pack_voltage_v", null, (x) => x < 250 || x > 800],
    ["bms_battcurr", "pack_current_a", null, (x) => Math.abs(x) > 1_000],
    ["ldcu_chrgpwr", "charge_power_kw", null, (x) => x < 0 || x > 400],
    ["ldcu_bms_soc_disp", "soc_pct", null, (x) => x < 0 || x > 100],
    ["bms_batttempmax_gb", "battery_temp_max_c", null, (x) => x < -30 || x > 90],
    ["bms_batttempmin_gb", "battery_temp_min_c", null, (x) => x < -30 || x > 90],
    ["bms_celltempmaxnum_gb", "hottest_cell_index"], ["bms_celltempminnum_gb", "coldest_cell_index"],
    ["ldcu_dstbatdisp_dynamic", "displayed_range_km", null, (x) => x < 0 || x > 1_000],
  ],
  status: [
    ["ldcu_driverdoorajarst", "driver_door_ajar"], ["rdcu_psngrdoorajarst", "passenger_door_ajar"],
    ["ldcu_rldoorajarst", "rear_left_door_ajar"], ["rdcu_rrdoorajarst", "rear_right_door_ajar"],
    ["ldcu_flwinposstfb", "front_left_window_position"], ["ldcu_rlwinposstfb", "rear_left_window_position"],
    ["frwinposstfb", "front_right_window_position", ["frwinposstfb", "rdcu_frwinposstfb", "ldcu_frwinposstfb"]],
    ["rrwinposstfb", "rear_right_window_position", ["rrwinposstfb", "rdcu_rrwinposstfb", "ldcu_rrwinposstfb"]],
    ["rdm_tropenersts", "trunk_open_status"],
    ["ldcu_tpmsprfl", "tyre_pressure_fl_kpa", null, (x) => x < 100 || x > 400],
    ["ldcu_tpmsprfr", "tyre_pressure_fr_kpa", null, (x) => x < 100 || x > 400],
    ["ldcu_tpmsprrl", "tyre_pressure_rl_kpa", null, (x) => x < 100 || x > 400],
    ["ldcu_tpmsprrr", "tyre_pressure_rr_kpa", null, (x) => x < 100 || x > 400],
  ],
};

const CENTRAL = 0x02014b50, END = 0x06054b50, LOCAL = 0x04034b50;
const MOVING = 1, TRIP_BREAK = 300, JOURNEY_BREAK = 3600, CHARGE_POWER = 0.2, CHARGE_BREAK = 600, MAX_GAP = 10;
const HISTORY_MAGIC_PREFIX = new Uint8Array([88, 80, 69, 78, 71, 65, 0]);
const HISTORY_VERSION = 4;
const HISTORY_MAGIC = new Uint8Array([...HISTORY_MAGIC_PREFIX, HISTORY_VERSION]);
const HISTORY_FORMAT = "xpeng-analytics-columnar-history";

class ChunkedGrower {
  constructor(Type, chunkSize = 65_536) {
    this.Type = Type;
    this.chunkSize = Math.max(1_024, chunkSize);
    this.chunks = [];
    this.current = null;
    this.currentLength = 0;
    this.length = 0;
  }

  push(value) {
    if (!this.current || this.currentLength === this.current.length) {
      this.current = new this.Type(this.chunkSize);
      this.currentLength = 0;
      this.chunks.push(this.current);
    }
    this.current[this.currentLength++] = value;
    this.length++;
  }

  setLast(value) {
    if (!this.length || !this.current) return;
    this.current[this.currentLength - 1] = value;
  }

  finish() {
    const output = new this.Type(this.length);
    let offset = 0;
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const count = index === this.chunks.length - 1 ? this.currentLength : chunk.length;
      output.set(chunk.subarray(0, count), offset);
      offset += count;
    }
    this.chunks = [];
    this.current = null;
    this.currentLength = 0;
    this.length = 0;
    return output;
  }
}

const finite = Number.isFinite;
const rounded = (value, digits = 2) => finite(value) ? Number(value.toFixed(digits)) : null;
const sum = (items, key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
const average = (values) => { const valid = values.filter(finite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN; };
const median = (values) => { const valid = values.filter(finite).sort((a, b) => a - b); if (!valid.length) return NaN; const i = Math.floor(valid.length / 2); return valid.length % 2 ? valid[i] : (valid[i - 1] + valid[i]) / 2; };
const percentile = (values, p) => { const valid = values.filter(finite).sort((a, b) => a - b); if (!valid.length) return NaN; const at = (valid.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return valid[lo] + (valid[hi] - valid[lo]) * (at - lo); };
const iso = (seconds) => finite(seconds) ? new Date(seconds * 1000).toISOString() : null;
const id = (prefix, start, end) => `${prefix}_${start}_${end}`;

function findEnd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22, min = Math.max(0, bytes.length - 65_557); offset >= min; offset--) {
    if (view.getUint32(offset, true) === END) return offset;
  }
  throw new Error("invalid_archive");
}

function sourceLength(source) {
  if (typeof Blob !== "undefined" && source instanceof Blob) return source.size;
  if (source instanceof ArrayBuffer) return source.byteLength;
  if (ArrayBuffer.isView(source)) return source.byteLength;
  throw new Error("invalid_archive");
}

function sourceBytes(source) {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return null;
}

async function readSourceRange(source, start, end) {
  const length = sourceLength(source);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > length) throw new Error("invalid_archive");
  if (typeof Blob !== "undefined" && source instanceof Blob) return new Uint8Array(await source.slice(start, end).arrayBuffer());
  return sourceBytes(source).subarray(start, end);
}

async function sourceDigest(source) {
  const bytes = typeof Blob !== "undefined" && source instanceof Blob
    ? await source.arrayBuffer()
    : sourceBytes(source);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function listEntries(source) {
  const length = sourceLength(source), tailStart = Math.max(0, length - 65_557);
  const tail = await readSourceRange(source, tailStart, length), tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const end = findEnd(tail), count = tailView.getUint16(end + 10, true), directorySize = tailView.getUint32(end + 12, true), directoryOffset = tailView.getUint32(end + 16, true);
  if (directoryOffset + directorySize > length) throw new Error("invalid_archive");
  const bytes = await readSourceRange(source, directoryOffset, directoryOffset + directorySize);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder();
  const entries = []; let offset = 0;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL) throw new Error("invalid_archive");
    const method = view.getUint16(offset + 10, true), compressedSize = view.getUint32(offset + 20, true), uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true), localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function familyForName(name) {
  const lower = name.toLowerCase();
  return Object.entries(FAMILY_MARKERS).find(([, marker]) => lower.includes(marker) && lower.endsWith(".csv"))?.[0] ?? null;
}

function partOrder(name) {
  const match = name.toLowerCase().match(/_part(\d+)\.csv$/);
  return match ? Number(match[1]) + 1 : 0;
}

async function entryStream(source, entry) {
  const header = await readSourceRange(source, entry.localOffset, entry.localOffset + 30);
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== LOCAL) throw new Error("invalid_archive");
  const nameLength = view.getUint16(26, true), extraLength = view.getUint16(28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const blob = typeof Blob !== "undefined" && source instanceof Blob
    ? source.slice(start, start + entry.compressedSize)
    : new Blob([await readSourceRange(source, start, start + entry.compressedSize)]);
  if (entry.method === 0) return blob.stream();
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("engine_error");
  return blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
}

function keepLast(time) {
  let sorted = true;
  for (let i = 1; i < time.length; i++) if (time[i] < time[i - 1]) { sorted = false; break; }
  const order = sorted ? null : new Uint32Array(time.length);
  if (order) {
    for (let index = 0; index < order.length; index++) order[index] = index;
    order.sort((a, b) => time[a] - time[b] || a - b);
  }
  const keep = new Uint32Array(time.length); let count = 0, duplicates = 0;
  for (let p = 0; p < time.length; p++) {
    const index = sorted ? p : order[p], value = time[index];
    if (count && time[keep[count - 1]] === value) { keep[count - 1] = index; duplicates++; }
    else keep[count++] = index;
  }
  return { keep: keep.slice(0, count), duplicates, wasUnsorted: !sorted };
}

function selectedFieldReader(header, indexes) {
  const selected = [...new Set(indexes.filter((index) => index >= 0))].sort((a, b) => a - b);
  const slotByColumn = new Int16Array(header.length); slotByColumn.fill(-1);
  selected.forEach((column, slot) => { slotByColumn[column] = slot; });
  const values = new Array(selected.length).fill("");
  const read = (line) => {
    values.fill("");
    let column = 0, start = 0;
    for (let index = 0; index <= line.length; index++) {
      if (index !== line.length && line.charCodeAt(index) !== 44) continue;
      if (column < slotByColumn.length) {
        const slot = slotByColumn[column];
        if (slot >= 0) values[slot] = line.slice(start, index);
      }
      column++;
      start = index + 1;
    }
    return values;
  };
  const slot = (column) => column >= 0 && column < slotByColumn.length ? slotByColumn[column] : -1;
  return { read, slot };
}

async function parseFamily(source, entries, family, report, totals, profile) {
  const specs = SPECS[family], chunkRows = profile?.mode === "mobile" ? 32_768 : 131_072;
  const times = new ChunkedGrower(Uint32Array, chunkRows), builders = Object.fromEntries(specs.map(([, target]) => [target, new ChunkedGrower(Float32Array, chunkRows)]));
  const invalidFields = {}, unknownColumns = new Set(); let inputRows = 0, invalidTimers = 0, model = "", parsedBytes = 0, duplicates = 0, wasUnsorted = false, lastTimer = -1;
  for (const entry of entries.sort((a, b) => partOrder(a.name) - partOrder(b.name) || a.name.localeCompare(b.name))) {
    const reader = (await entryStream(source, entry)).getReader(), decoder = new TextDecoder("utf-8");
    let carry = "", header = null, timerIndex = -1, modelIndex = -1, plan = [], fieldReader = null;
    const append = (line) => {
      const fields = fieldReader.read(line); inputRows++;
      const timer = Number(fields[fieldReader.slot(timerIndex)]);
      if (!Number.isSafeInteger(timer) || timer < 0 || timer > 0xffffffff) { invalidTimers++; return; }
      if (!model && modelIndex >= 0) model = fields[fieldReader.slot(modelIndex)] || "";
      const replaceLast = timer === lastTimer;
      if (timer < lastTimer) wasUnsorted = true;
      if (replaceLast) { times.setLast(timer); duplicates++; }
      else times.push(timer);
      for (const field of plan) {
        const raw = field.slot >= 0 ? fields[field.slot] : ""; let value = raw ? Number.parseFloat(raw) : NaN;
        if (!finite(value) || field.invalid?.(value)) { if (raw && finite(Number.parseFloat(raw))) invalidFields[field.source] = (invalidFields[field.source] || 0) + 1; value = NaN; }
        if (replaceLast) builders[field.target].setLast(value);
        else builders[field.target].push(value);
      }
      lastTimer = timer;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parsedBytes += value.byteLength; totals.parsed += value.byteLength;
      if (totals.parsed > totals.uncompressed + 1024 * 1024) throw new Error("invalid_archive");
      carry += decoder.decode(value, { stream: true });
      let start = 0;
      for (;;) {
        const newline = carry.indexOf("\n", start); if (newline < 0) break;
        let line = carry.slice(start, newline); if (line.endsWith("\r")) line = line.slice(0, -1); start = newline + 1;
        if (!line) continue;
        if (!header) {
          if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
          header = line.split(",").map((v) => v.trim().toLowerCase()); timerIndex = header.indexOf("timer"); modelIndex = header.indexOf("vmodel");
          if (timerIndex < 0) throw new Error("invalid_data");
          const known = new Set(["vin", "vmodel", "timer", "ds", ...specs.flatMap(([source, , aliases]) => aliases ?? [source]).map((v) => v.toLowerCase())]);
          header.filter((name) => !known.has(name)).forEach((name) => unknownColumns.add(name));
          plan = specs.map(([source, target, aliases, invalid]) => ({ source, target, invalid, index: (aliases ?? [source]).map((name) => header.indexOf(name.toLowerCase())).find((candidate) => candidate >= 0) ?? -1 }));
          fieldReader = selectedFieldReader(header, [timerIndex, modelIndex, ...plan.map((field) => field.index)]);
          plan.forEach((field) => { field.slot = fieldReader.slot(field.index); });
          continue;
        }
        append(line);
      }
      carry = start ? carry.slice(start) : carry;
      report(10 + totals.parsed / totals.uncompressed * 58, "native_parse", `${family} · ${inputRows.toLocaleString("en")} rows`);
    }
    carry += decoder.decode();
    if (carry.trim()) {
      const line = carry.endsWith("\r") ? carry.slice(0, -1) : carry;
      if (header) append(line);
    }
  }
  const rawTime = times.finish(), rawColumns = Object.fromEntries(specs.map(([, target]) => [target, builders[target].finish()]));
  let time = rawTime, columns = rawColumns, ordered = null;
  if (wasUnsorted) {
    ordered = keepLast(rawTime);
    duplicates += ordered.duplicates;
    time = new Uint32Array(ordered.keep.length);
    columns = {};
    for (let i = 0; i < ordered.keep.length; i++) time[i] = rawTime[ordered.keep[i]];
    for (const [, target] of specs) {
      const raw = rawColumns[target], output = new Float32Array(ordered.keep.length);
      for (let i = 0; i < ordered.keep.length; i++) output[i] = raw[ordered.keep[i]];
      columns[target] = output;
    }
  }
  const emptyColumns = [];
  for (const [, target] of specs) {
    let nonNull = 0;
    for (let i = 0; i < columns[target].length; i++) if (finite(columns[target][i])) nonNull++;
    if (!nonNull) emptyColumns.push(target);
  }
  return { family, time, columns, model, stats: { inputRows, uniqueRows: time.length, duplicates, invalidTimers, invalidFields, unknownColumns: [...unknownColumns], emptyColumns, wasUnsorted, uncompressedBytes: parsedBytes } };
}

function mergeStream(oldStream, fresh) {
  if (!oldStream) return fresh;
  const a = oldStream.time, b = fresh.time, select = new Int32Array(a.length + b.length); let i = 0, j = 0, n = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] < b[j])) select[n++] = -(++i);
    else if (i >= a.length || b[j] < a[i]) select[n++] = ++j;
    else { i++; select[n++] = ++j; }
  }
  const time = new Uint32Array(n), columns = {}, emptyColumns = [];
  for (let k = 0; k < n; k++) time[k] = select[k] > 0 ? b[select[k] - 1] : a[-select[k] - 1];
  for (const [, target] of SPECS[fresh.family]) {
    const output = new Float32Array(n), ac = oldStream.columns[target], bc = fresh.columns[target]; let nonNull = 0;
    for (let k = 0; k < n; k++) { output[k] = select[k] > 0 ? bc[select[k] - 1] : ac[-select[k] - 1]; if (finite(output[k])) nonNull++; }
    if (!nonNull) emptyColumns.push(target);
    columns[target] = output;
  }
  const unknownColumns = [...new Set([...(oldStream.stats?.unknownColumns || []), ...(fresh.stats?.unknownColumns || [])])];
  return { family: fresh.family, time, columns, model: fresh.model || oldStream.model, stats: { ...fresh.stats, uniqueRows: n, mergedRows: n, emptyColumns, unknownColumns } };
}

export function emptyState() { return { format: HISTORY_FORMAT, version: HISTORY_VERSION, streams: {}, imports: [], model: "", gpsTracks: [], gpsSelectedTracks: [], gpsImports: [] }; }

export async function importArchive(state, source, filename, report, processingProfile = {}) {
  const profile = typeof processingProfile === "number" ? { memoryBudgetBytes: processingProfile, mode: "desktop" } : processingProfile;
  const digest = await sourceDigest(source);
  if (state.imports.some((item) => item.sha256 === digest)) return { state, skipped: true, archiveSha256: digest, totalRows: 0 };
  const all = await listEntries(source), entries = all.filter((entry) => familyForName(entry.name));
  const families = new Set(entries.map((entry) => familyForName(entry.name)));
  if (!["operation", "energy", "status"].every((name) => families.has(name))) throw new Error("missing_families");
  const uncompressed = entries.reduce((n, entry) => n + entry.uncompressedSize, 0);
  report(6, "native_scan", `${(uncompressed / 1024 / 1024).toFixed(0)} MB`);
  const totals = { parsed: 0, uncompressed }, fresh = {};
  for (const family of ["operation", "energy", "status"]) fresh[family] = await parseFamily(source, entries.filter((entry) => familyForName(entry.name) === family), family, report, totals, profile);
  report(70, "native_merge", "Merging overlapping exports");
  const streams = {};
  for (const family of ["operation", "energy", "status"]) streams[family] = mergeStream(state.streams[family], fresh[family]);
  const sourceStartUtc = Math.min(...Object.values(fresh).map((stream) => stream.time[0])), sourceEndUtc = Math.max(...Object.values(fresh).map((stream) => stream.time.at(-1)));
  const imported = { name: filename, sha256: digest, rows: Object.values(fresh).reduce((n, stream) => n + stream.stats.inputRows, 0), completedAtUtc: new Date().toISOString(), sourceStartUtc: iso(sourceStartUtc), sourceEndUtc: iso(sourceEndUtc) };
  return { state: { ...state, streams, model: Object.values(fresh).find((stream) => stream.model)?.model || state.model, imports: [imported, ...state.imports] }, skipped: false, archiveSha256: digest, totalRows: imported.rows, sourceStartUtc, sourceEndUtc };
}

async function streamText(stream) {
  return new Response(stream).text();
}

export async function importGps(state, source, filename, options = {}, report = () => {}) {
  const digest = await sourceDigest(source);
  const lower = String(filename || "").toLowerCase();
  const tracks = [];
  const parse = (name, text) => {
    const parsed = parseGpxText(text, { sourceName: name, sourceSha256: digest, startIndex: tracks.length, trimMeters: options.trimMeters || 0 });
    const pointCount = tracks.reduce((total, track) => total + track.time.length, 0) + parsed.reduce((total, track) => total + track.time.length, 0);
    if (pointCount > GPX_LIMITS.maxPoints) throw new Error("invalid_gpx");
    tracks.push(...parsed);
  };
  if (lower.endsWith(".gpx")) {
    if (sourceLength(source) > GPX_LIMITS.maxBytes) throw new Error("invalid_gpx");
    const text = typeof Blob !== "undefined" && source instanceof Blob
      ? await source.text()
      : new TextDecoder().decode(sourceBytes(source));
    parse(filename || "track.gpx", text);
  } else if (lower.endsWith(".zip")) {
    const entries = (await listEntries(source)).filter((entry) => entry.name.toLowerCase().endsWith(".gpx"));
    const totalBytes = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
    if (!entries.length || entries.length > 500 || totalBytes > GPX_LIMITS.maxBytes * 2 || entries.some((entry) => entry.uncompressedSize > GPX_LIMITS.maxBytes)) throw new Error("invalid_gpx");
    for (let index = 0; index < entries.length; index++) {
      report(8 + index / entries.length * 52, "gps_parse", entries[index].name);
      parse(entries[index].name, await streamText(await entryStream(source, entries[index])));
    }
  } else throw new Error("invalid_gpx");
  const imported = { name: filename, sha256: digest, trackCount: tracks.length, pointCount: tracks.reduce((total, track) => total + track.time.length, 0), trimMeters: Number(options.trimMeters || 0), completedAtUtc: new Date().toISOString() };
  const existingTrackIds = new Set(tracks.map((track) => track.trackId));
  return {
    state: { ...state, version: HISTORY_VERSION, gpsTracks: [...(state.gpsTracks || []).filter((track) => !existingTrackIds.has(track.sourceTrackId || track.trackId)), ...tracks], gpsSelectedTracks: [], gpsImports: [imported, ...(state.gpsImports || []).filter((item) => item.sha256 !== digest)] },
    skipped: false,
    trackCount: tracks.length,
    pointCount: imported.pointCount,
  };
}

export async function detectAdditionalFileKind(source, filename) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".gpx")) return "gps";
  if (!lower.endsWith(".zip")) throw new Error("invalid_archive");
  const entries = await listEntries(source);
  if (entries.some((entry) => entry.name.toLowerCase().endsWith(".gpx"))) return "gps";
  const families = new Set(entries.map((entry) => familyForName(entry.name)).filter(Boolean));
  if (["operation", "energy", "status"].every((family) => families.has(family))) return "xpeng";
  throw new Error("invalid_archive");
}

function lowerBound(time, target) { let lo = 0, hi = time.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (time[mid] < target) lo = mid + 1; else hi = mid; } return lo; }
function upperBound(time, target) { let lo = 0, hi = time.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (time[mid] <= target) lo = mid + 1; else hi = mid; } return lo; }
function indexAt(time, target) { const i = lowerBound(time, target); return i < time.length && time[i] === target ? i : -1; }
function monotonicIndex(time, firstTarget) { let cursor = lowerBound(time, firstTarget); return (target) => { while (cursor < time.length && time[cursor] < target) cursor++; return cursor < time.length && time[cursor] === target ? cursor : -1; }; }
function val(stream, key, index) { return index >= 0 ? stream.columns[key]?.[index] ?? NaN : NaN; }
function powerAt(stream, index) { const v = val(stream, "pack_voltage_v", index), a = val(stream, "pack_current_a", index); return finite(v) && finite(a) ? v * a / 1000 : NaN; }
function firstFinite(array, start, end) { for (let i = start; i < end; i++) if (finite(array[i])) return array[i]; return NaN; }
function lastFinite(array, start, end) { for (let i = end - 1; i >= start; i--) if (finite(array[i])) return array[i]; return NaN; }
function maxFinite(array, start = 0, end = array.length) { let out = NaN; for (let i = start; i < end; i++) if (finite(array[i]) && (!finite(out) || array[i] > out)) out = array[i]; return out; }
function minFinite(array, start = 0, end = array.length) { let out = NaN; for (let i = start; i < end; i++) if (finite(array[i]) && (!finite(out) || array[i] < out)) out = array[i]; return out; }
function maxAbsFinite(array, start = 0, end = array.length) { let out = NaN; for (let i = start; i < end; i++) if (finite(array[i])) { const value = Math.abs(array[i]); if (!finite(out) || value > out) out = value; } return out; }
function maxPositiveFinite(array, start = 0, end = array.length) { let out = NaN; for (let i = start; i < end; i++) if (finite(array[i]) && array[i] > 0 && (!finite(out) || array[i] > out)) out = array[i]; return out; }

function timeContext() {
  const cache = new Map(), formatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
  return (timestamp) => {
    const key = Math.floor(timestamp / 3600); if (cache.has(key)) return cache.get(key);
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp * 1000)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const weekdays = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const value = { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: weekdays[parts.weekday] ?? 0 }; cache.set(key, value); return value;
  };
}

function boundaries(time, values, threshold, gap) {
  const out = []; let start = null, previous = null;
  for (let i = 0; i < time.length; i++) {
    if (!finite(values[i]) || values[i] <= threshold) continue;
    if (previous == null || time[i] - previous > gap) { if (start != null) out.push([start, previous]); start = time[i]; }
    previous = time[i];
  }
  if (start != null) out.push([start, previous]); return out;
}

function sampleStats() { return { sum: 0, count: 0, max: NaN, last: NaN }; }
function observe(stats, value) { if (!finite(value)) return; stats.sum += value; stats.count++; stats.last = value; if (!finite(stats.max) || value > stats.max) stats.max = value; }
function sampleAverage(stats) { return stats.count ? stats.sum / stats.count : NaN; }

function binnedSeries(operation, energy, status, startTime, endTime, limit = 180) {
  const start = lowerBound(operation.time, startTime), end = upperBound(operation.time, endTime), width = Math.max(1, Math.ceil((end - start) / limit)), rows = [];
  const energyAt = monotonicIndex(energy.time, operation.time[start]), statusAt = monotonicIndex(status.time, operation.time[start]);
  for (let base = start; base < end; base += width) {
    const stop = Math.min(end, base + width), samples = { speed: sampleStats(), power: sampleStats(), soc: sampleStats(), range: sampleStats(), temp: sampleStats(), accelerator: sampleStats(), brake: sampleStats(), longitudinal: sampleStats(), lateral: sampleStats(), steering: sampleStats(), rearRpm: sampleStats(), rearTorque: sampleStats(), rearRotorTemp: sampleStats(), tyreFl: sampleStats(), tyreFr: sampleStats(), tyreRl: sampleStats(), tyreRr: sampleStats() };
    for (let i = base; i < stop; i++) {
      const timestamp = operation.time[i], ei = energyAt(timestamp), si = statusAt(timestamp), brake = val(operation, "brake_status", i), rearRotorTemp = val(energy, "rear_rotor_temp_c", ei);
      observe(samples.speed, val(operation, "speed_kmh", i)); observe(samples.accelerator, val(operation, "accelerator_pct", i)); observe(samples.brake, finite(brake) && brake ? 100 : 0);
      observe(samples.longitudinal, val(operation, "longitudinal_accel", i)); observe(samples.lateral, val(operation, "lateral_accel", i)); observe(samples.steering, val(operation, "steering_angle_deg", i));
      observe(samples.power, powerAt(energy, ei)); observe(samples.soc, val(energy, "soc_pct", ei)); observe(samples.range, val(energy, "displayed_range_km", ei)); observe(samples.temp, val(energy, "battery_temp_max_c", ei));
      observe(samples.rearRpm, val(energy, "rear_motor_rpm", ei)); observe(samples.rearTorque, val(energy, "rear_motor_torque_nm", ei)); observe(samples.rearRotorTemp, finite(rearRotorTemp) && rearRotorTemp > 0 ? rearRotorTemp : NaN);
      observe(samples.tyreFl, val(status, "tyre_pressure_fl_kpa", si)); observe(samples.tyreFr, val(status, "tyre_pressure_fr_kpa", si)); observe(samples.tyreRl, val(status, "tyre_pressure_rl_kpa", si)); observe(samples.tyreRr, val(status, "tyre_pressure_rr_kpa", si));
    }
    rows.push({ timestampUtc: iso(operation.time[base]), elapsedMinutes: rounded((operation.time[base] - startTime) / 60, 2), speedKmh: rounded(sampleAverage(samples.speed), 1), speedPeakKmh: rounded(samples.speed.max, 1), powerKw: rounded(sampleAverage(samples.power), 2), powerPeakKw: rounded(samples.power.max, 2), socPct: rounded(samples.soc.last, 1), displayedRangeKm: rounded(samples.range.last, 1), batteryTempC: rounded(samples.temp.max, 1), acceleratorPct: rounded(sampleAverage(samples.accelerator), 1), acceleratorPeakPct: rounded(samples.accelerator.max, 1), brakePct: rounded(sampleAverage(samples.brake), 1), longitudinalG: rounded(sampleAverage(samples.longitudinal), 3), lateralG: rounded(sampleAverage(samples.lateral), 3), steeringAngleDeg: rounded(sampleAverage(samples.steering), 1), rearMotorRpm: rounded(sampleAverage(samples.rearRpm), 0), rearMotorTorqueNm: rounded(sampleAverage(samples.rearTorque), 1), rearRotorTempC: rounded(samples.rearRotorTemp.max, 1), tyreFrontLeftKpa: rounded(sampleAverage(samples.tyreFl), 1), tyreFrontRightKpa: rounded(sampleAverage(samples.tyreFr), 1), tyreRearLeftKpa: rounded(sampleAverage(samples.tyreRl), 1), tyreRearRightKpa: rounded(sampleAverage(samples.tyreRr), 1) });
  }
  return rows;
}

function newContextBlock() {
  return { seconds: 0, distanceKm: 0, energyUsedKwh: 0, regeneratedKwh: 0, lowSeconds: 0, middleSeconds: 0, highSeconds: 0, stoppedSeconds: 0, dynamicSeconds: 0, stops: 0 };
}

function observeContextBlock(block, speedKmh, previousSpeedKmh, seconds, energyKwh, longitudinalG, braking) {
  block.seconds += seconds;
  block.distanceKm += speedKmh * seconds / 3600;
  if (finite(energyKwh)) {
    if (energyKwh >= 0) block.energyUsedKwh += energyKwh;
    else block.regeneratedKwh -= energyKwh;
  }
  if (speedKmh < 50) block.lowSeconds += seconds;
  if (speedKmh >= 35 && speedKmh < 95) block.middleSeconds += seconds;
  if (speedKmh >= 85) block.highSeconds += seconds;
  if (speedKmh < 3) block.stoppedSeconds += seconds;
  if (previousSpeedKmh >= 3 && speedKmh < 3) block.stops += 1;
  if ((finite(longitudinalG) && Math.abs(longitudinalG) >= .12) || braking) block.dynamicSeconds += seconds;
}

function finishContextBlock(block, trip, position) {
  if (!block.seconds || block.distanceKm < .005) return null;
  const share = (value) => value / block.seconds;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const averageSpeedKmh = block.distanceKm / (block.seconds / 3600);
  const stoppedShare = share(block.stoppedSeconds), dynamicShare = share(block.dynamicSeconds), stableShare = 1 - dynamicShare;
  const scores = {
    urban: .55 * share(block.lowSeconds) + .2 * clamp(stoppedShare * 4) + .15 * clamp(dynamicShare * 3) + .1 * clamp((55 - averageSpeedKmh) / 30),
    road: .55 * share(block.middleSeconds) + .2 * clamp(1 - Math.abs(averageSpeedKmh - 65) / 35) + .15 * stableShare + .1 * (1 - stoppedShare),
    motorway: .65 * share(block.highSeconds) + .2 * clamp((averageSpeedKmh - 75) / 35) + .1 * stableShare + .05 * (1 - stoppedShare),
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const margin = ranked[0][1] - ranked[1][1];
  let confidence = ranked[0][1] >= .65 && margin >= .25 ? "high" : ranked[0][1] >= .5 && margin >= .12 ? "medium" : "low";
  if (block.seconds < 45 && confidence === "high") confidence = "medium";
  if (block.seconds < 20) confidence = "low";
  const netEnergyKwh = block.energyUsedKwh - block.regeneratedKwh;
  return {
    segmentId: `${trip.tripId}-${position}`,
    tripId: trip.tripId,
    date: trip.date,
    startedAtUtc: new Date(Date.parse(trip.startedAtUtc) + position * 60_000).toISOString(),
    context: ranked[0][0],
    confidence,
    confidenceScore: rounded(ranked[0][1] * 100, 0),
    durationMinutes: rounded(block.seconds / 60, 2),
    distanceKm: rounded(block.distanceKm, 3),
    averageSpeedKmh: rounded(averageSpeedKmh, 1),
    energyUsedKwh: rounded(block.energyUsedKwh, 4),
    regeneratedKwh: rounded(block.regeneratedKwh, 4),
    netEnergyKwh: rounded(netEnergyKwh, 4),
    consumptionKwh100: rounded(block.distanceKm ? netEnergyKwh / block.distanceKm * 100 : NaN, 1),
    stopCount: block.stops,
  };
}

function buildTrips(operation, energy, status, local) {
  const trips = [], contexts = [], speed = operation.columns.speed_kmh;
  for (const [startTime, endTime] of boundaries(operation.time, speed, 0.999, TRIP_BREAK)) {
    const start = lowerBound(operation.time, startTime), end = upperBound(operation.time, endTime), energyAt = monotonicIndex(energy.time, operation.time[start]), contextBlocks = new Map(); let distance = 0, used = 0, regenerated = 0, moving = 0, gaps = 0, peakDrive = NaN, peakRegen = NaN, e1 = energyAt(operation.time[start]);
    for (let i = start + 1; i < end; i++) {
      const e2 = energyAt(operation.time[i]), dt = operation.time[i] - operation.time[i - 1]; if (dt <= 0 || dt > MAX_GAP) { if (dt > MAX_GAP) gaps++; e1 = e2; continue; }
      const s1 = finite(speed[i - 1]) ? speed[i - 1] : 0, s2 = finite(speed[i]) ? speed[i] : 0, avgSpeed = (s1 + s2) / 2; distance += avgSpeed * dt / 3600; if (avgSpeed >= MOVING) moving += dt;
      const p1 = powerAt(energy, e1), p2 = powerAt(energy, e2);
      let amount = NaN;
      if (finite(p1) && finite(p2)) { const p = (p1 + p2) / 2; amount = p * dt / 3600; if (amount >= 0) used += amount; else regenerated -= amount; peakDrive = !finite(peakDrive) ? Math.max(p1, p2) : Math.max(peakDrive, p1, p2); peakRegen = !finite(peakRegen) ? Math.min(p1, p2) : Math.min(peakRegen, p1, p2); }
      const contextPosition = Math.floor((operation.time[i] - startTime) / 60), block = contextBlocks.get(contextPosition) || newContextBlock();
      observeContextBlock(block, avgSpeed, s1, dt, amount, val(operation, "longitudinal_accel", i), Boolean(val(operation, "brake_status", i)));
      contextBlocks.set(contextPosition, block);
      e1 = e2;
    }
    if (distance < .05) continue;
    const eStart = lowerBound(energy.time, startTime), eEnd = upperBound(energy.time, endTime), sStart = lowerBound(status.time, startTime), sEnd = upperBound(status.time, endTime), gross = used + regenerated;
    const trip = { tripId: id("trip", startTime, endTime), date: local(startTime).date, startedAtUtc: iso(startTime), endedAtUtc: iso(endTime), durationMinutes: rounded((endTime - startTime) / 60, 1), movingMinutes: rounded(moving / 60, 1), distanceKm: rounded(distance), maxSpeedKmh: rounded(maxFinite(speed, start, end), 1), avgSpeedKmh: rounded(distance / ((endTime - startTime) / 3600), 1), energyUsedKwh: rounded(used, 3), netEnergyKwh: rounded(used - regenerated, 3), regeneratedKwh: rounded(regenerated, 3), regenerationSharePct: rounded(gross ? regenerated / gross * 100 : NaN, 1), consumptionKwh100: rounded((used - regenerated) / distance * 100), socStartPct: rounded(firstFinite(energy.columns.soc_pct, eStart, eEnd), 1), socEndPct: rounded(lastFinite(energy.columns.soc_pct, eStart, eEnd), 1), batteryTempMinC: rounded(minFinite(energy.columns.battery_temp_min_c, eStart, eEnd), 1), batteryTempMaxC: rounded(maxFinite(energy.columns.battery_temp_max_c, eStart, eEnd), 1), maxAccelerationG: rounded(maxFinite(operation.columns.longitudinal_accel, start, end), 3), maxBrakingG: rounded(Math.abs(Math.min(0, minFinite(operation.columns.longitudinal_accel, start, end))), 3), maxLateralG: rounded(maxAbsFinite(operation.columns.lateral_accel, start, end), 3), maxSteeringAngleDeg: rounded(maxAbsFinite(operation.columns.steering_angle_deg, start, end), 1), peakDrivePowerKw: rounded(peakDrive, 1), peakRegenPowerKw: rounded(finite(peakRegen) ? Math.abs(Math.min(0, peakRegen)) : NaN, 1), maxRearMotorRpm: rounded(maxFinite(energy.columns.rear_motor_rpm, eStart, eEnd), 0), maxRearTorqueNm: rounded(maxFinite(energy.columns.rear_motor_torque_nm, eStart, eEnd), 1), maxRearRotorTempC: rounded(maxPositiveFinite(energy.columns.rear_rotor_temp_c, eStart, eEnd), 1), tyrePressureMinKpa: rounded(Math.min(...["tyre_pressure_fl_kpa", "tyre_pressure_fr_kpa", "tyre_pressure_rl_kpa", "tyre_pressure_rr_kpa"].map((key) => minFinite(status.columns[key], sStart, sEnd)).filter(finite)), 1), tyrePressureMaxKpa: rounded(Math.max(...["tyre_pressure_fl_kpa", "tyre_pressure_fr_kpa", "tyre_pressure_rl_kpa", "tyre_pressure_rr_kpa"].map((key) => maxFinite(status.columns[key], sStart, sEnd)).filter(finite)), 1), gapCount: gaps, series: binnedSeries(operation, energy, status, startTime, endTime) };
    trips.push(trip);
    for (const [position, block] of contextBlocks) { const context = finishContextBlock(block, trip, position); if (context) contexts.push(context); }
  }
  return { trips, contexts };
}

function buildCharges(operation, energy, local) {
  const charges = [], chargePower = energy.columns.charge_power_kw;
  for (const [startTime, endTime] of boundaries(energy.time, chargePower, CHARGE_POWER, CHARGE_BREAK)) {
    const start = lowerBound(energy.time, startTime), end = upperBound(energy.time, endTime); let wall = 0, battery = 0, weighted = 0, integrated = 0;
    for (let i = start + 1; i < end; i++) { const dt = energy.time[i] - energy.time[i - 1]; if (dt <= 0 || dt > MAX_GAP) continue; const p = Math.max(0, ((finite(chargePower[i - 1]) ? chargePower[i - 1] : 0) + (finite(chargePower[i]) ? chargePower[i] : 0)) / 2); wall += p * dt / 3600; weighted += p * dt; integrated += dt; const b1 = powerAt(energy, i - 1), b2 = powerAt(energy, i); if (finite(b1) && finite(b2) && (b1 + b2) / 2 < 0) battery -= (b1 + b2) / 2 * dt / 3600; }
    if (endTime - startTime < 30 && wall < .02) continue;
    const op = indexAt(operation.time, startTime), series = [], width = Math.max(1, Math.ceil((end - start) / 180));
    for (let base = start; base < end; base += width) { const stop = Math.min(end, base + width), powers = [], volts = [], currents = [], socs = [], temps = []; for (let i = base; i < stop; i++) { powers.push(chargePower[i]); volts.push(val(energy, "pack_voltage_v", i)); const current = val(energy, "pack_current_a", i); currents.push(finite(current) ? -current : NaN); socs.push(val(energy, "soc_pct", i)); temps.push(val(energy, "battery_temp_max_c", i)); } series.push({ elapsedMinutes: rounded((energy.time[base] - startTime) / 60, 1), powerKw: rounded(average(powers), 2), powerPeakKw: rounded(maxFinite(powers), 2), socPct: rounded(lastFinite(socs, 0, socs.length), 1), voltageV: rounded(average(volts), 1), currentA: rounded(average(currents), 1), batteryTempC: rounded(maxFinite(temps), 1) }); }
    const socStart = firstFinite(energy.columns.soc_pct, start, end), socEnd = lastFinite(energy.columns.soc_pct, start, end), maxPower = maxFinite(chargePower, start, end);
    charges.push({ chargeId: id("charge", startTime, endTime), date: local(startTime).date, startedAtUtc: iso(startTime), endedAtUtc: iso(endTime), durationMinutes: rounded((endTime - startTime) / 60, 1), wallEnergyKwh: rounded(wall), batteryEnergyKwh: rounded(battery), lossKwh: rounded(wall - battery), efficiencyPct: rounded(wall ? battery / wall * 100 : NaN, 1), maxPowerKw: rounded(maxPower, 1), avgPowerKw: rounded(integrated ? weighted / integrated : NaN, 1), socStartPct: rounded(socStart, 1), socEndPct: rounded(socEnd, 1), batteryTempStartC: rounded(firstFinite(energy.columns.battery_temp_max_c, start, end), 1), batteryTempEndC: rounded(lastFinite(energy.columns.battery_temp_max_c, start, end), 1), batteryTempMaxC: rounded(maxFinite(energy.columns.battery_temp_max_c, start, end), 1), odometerKm: rounded(op >= 0 ? val(operation, "odometer_km", op) : NaN, 0), chargeType: maxPower >= 20 ? "DC" : "AC", voltageMinV: rounded(minFinite(energy.columns.pack_voltage_v, start, end), 1), voltageMaxV: rounded(maxFinite(energy.columns.pack_voltage_v, start, end), 1), peakCurrentA: rounded(Math.abs(minFinite(energy.columns.pack_current_a, start, end)), 1), rangeStartKm: rounded(firstFinite(energy.columns.displayed_range_km, start, end), 1), rangeEndKm: rounded(lastFinite(energy.columns.displayed_range_km, start, end), 1), coldestCellIndex: rounded(lastFinite(energy.columns.coldest_cell_index, start, end), 0), hottestCellIndex: rounded(lastFinite(energy.columns.hottest_cell_index, start, end), 0), series });
  }
  return charges;
}

function advanced(operation, energy, status, local) {
  const speedBands = ["0–30", "30–50", "50–90", "90–120", "120–150", "150+"], pedalBands = ["0–10", "10–25", "25–50", "50–75", "75–100"];
  const band = (v, limits, labels) => labels[limits.findIndex((x) => v < x)] ?? labels.at(-1), speed = new Map(), pedal = new Map(), heat = new Map(), gg = new Map(), events = new Map();
  const accelWindow = [], lateralWindow = []; let previous = null;
  const keepEvent = (date, kind, timestamp, value, speedKmh) => { if (value < .12) return; const key = `${date}|${kind}`, rows = events.get(key) || [], near = rows.findIndex((row) => Math.abs(row.timestamp - timestamp) < 60), candidate = { timestamp, value, speedKmh }; if (near >= 0) { if (value > rows[near].value) rows[near] = candidate; } else rows.push(candidate); rows.sort((a, b) => b.value - a.value); events.set(key, rows.slice(0, 8)); };
  for (let i = 0; i < operation.time.length; i++) {
    const timestamp = operation.time[i], elapsed = previous == null ? 1 : timestamp - previous, seconds = elapsed > 0 && elapsed <= 10 ? elapsed : 1, context = local(timestamp), speedKmh = val(operation, "speed_kmh", i), pedalPct = val(operation, "accelerator_pct", i), longitudinal = val(operation, "longitudinal_accel", i), lateral = val(operation, "lateral_accel", i);
    if (previous != null && (elapsed <= 0 || elapsed > 10)) { accelWindow.length = 0; lateralWindow.length = 0; } previous = timestamp;
    if (finite(speedKmh) && speedKmh >= 1) { const sb = band(speedKmh, [30, 50, 90, 120, 150], speedBands), sk = `${context.date}|${sb}`; speed.set(sk, (speed.get(sk) || 0) + seconds); const hk = `${context.date}|${context.weekday}|${context.hour}`; heat.set(hk, (heat.get(hk) || 0) + seconds); if (finite(pedalPct) && pedalPct > 0) { const pb = band(pedalPct, [10, 25, 50, 75], pedalBands), pk = `${context.date}|${pb}`; pedal.set(pk, (pedal.get(pk) || 0) + seconds); } }
    if (finite(longitudinal)) { accelWindow.push(longitudinal); if (accelWindow.length > 3) accelWindow.shift(); }
    if (finite(lateral)) { lateralWindow.push(lateral); if (lateralWindow.length > 3) lateralWindow.shift(); }
    if (finite(longitudinal) && finite(lateral) && Math.abs(longitudinal) <= 1.5 && Math.abs(lateral) <= 1.5) { const lg = Math.round(lateral / .05) * .05, ag = Math.round(longitudinal / .05) * .05, key = `${context.date}|${lg.toFixed(2)}|${ag.toFixed(2)}`; gg.set(key, (gg.get(key) || 0) + seconds); }
    if (accelWindow.length === 3) { const smoothed = median(accelWindow); keepEvent(context.date, "acceleration", timestamp, Math.max(0, smoothed), speedKmh); keepEvent(context.date, "braking", timestamp, Math.abs(Math.min(0, smoothed)), speedKmh); }
    if (lateralWindow.length === 3) keepEvent(context.date, "cornering", timestamp, Math.abs(median(lateralWindow)), speedKmh);
  }
  const tyres = new Map(); let lastTyre = 0;
  for (let i = 0; i < status.time.length; i++) { if (status.time[i] - lastTyre < 300) continue; lastTyre = status.time[i]; const date = local(status.time[i]).date, row = tyres.get(date) || { fl: [], fr: [], rl: [], rr: [], temp: [] }, ei = indexAt(energy.time, status.time[i]); [["fl", "tyre_pressure_fl_kpa"], ["fr", "tyre_pressure_fr_kpa"], ["rl", "tyre_pressure_rl_kpa"], ["rr", "tyre_pressure_rr_kpa"]].forEach(([target, key]) => { const value = val(status, key, i); if (finite(value)) row[target].push(value); }); const temp = val(energy, "battery_temp_min_c", ei); if (finite(temp)) row.temp.push(temp); tyres.set(date, row); }
  const battery = new Map(), rangeSamples = []; let lastRange = 0;
  for (let i = 0; i < energy.time.length; i++) { const timestamp = energy.time[i], date = local(timestamp).date, row = battery.get(date) || { soc: [], min: [], max: [], spread: [], range: [] }, soc = val(energy, "soc_pct", i), tempMin = val(energy, "battery_temp_min_c", i), tempMax = val(energy, "battery_temp_max_c", i), displayed = val(energy, "displayed_range_km", i); if (finite(soc)) row.soc.push(soc); if (finite(tempMin)) row.min.push(tempMin); if (finite(tempMax)) row.max.push(tempMax); if (finite(tempMin) && finite(tempMax)) row.spread.push(tempMax - tempMin); if (finite(soc) && finite(displayed) && soc >= 30 && soc <= 95 && timestamp - lastRange >= 600) { lastRange = timestamp; const implied = displayed / soc * 100; if (implied >= 200 && implied <= 800) { row.range.push(implied); rangeSamples.push({ date, timestampUtc: iso(timestamp), socPct: rounded(soc, 1), displayedRangeKm: rounded(displayed, 1), impliedFullRangeKm: rounded(implied, 1) }); } } battery.set(date, row); }
  return {
    speed: [...speed].map(([key, seconds]) => { const [date, bandName] = key.split("|"); return { date, band: bandName, seconds: Math.round(seconds) }; }),
    pedal: [...pedal].map(([key, seconds]) => { const [date, bandName] = key.split("|"); return { date, band: bandName, seconds: Math.round(seconds) }; }),
    gg: [...gg].map(([key, seconds]) => { const [date, lateralG, longitudinalG] = key.split("|"); return { date, lateralG: Number(lateralG), longitudinalG: Number(longitudinalG), seconds: Math.round(seconds) }; }),
    events: [...events].flatMap(([key, rows]) => { const [date, kind] = key.split("|"); return rows.slice(0, 5).map((row) => ({ date, kind, timestampUtc: iso(row.timestamp), valueG: rounded(row.value, 3), speedKmh: rounded(row.speedKmh, 1) })); }),
    heatmap: [...heat].map(([key, seconds]) => { const [date, weekdayIndex, hourIndex] = key.split("|"); return { date, weekdayIndex: Number(weekdayIndex), hourIndex: Number(hourIndex), drivingMinutes: rounded(seconds / 60, 1) }; }),
    tyres: [...tyres].sort().map(([date, row]) => { const fl = median(row.fl), fr = median(row.fr), rl = median(row.rl), rr = median(row.rr), values = [fl, fr, rl, rr].filter(finite); return { date, frontLeftKpa: rounded(fl, 1), frontRightKpa: rounded(fr, 1), rearLeftKpa: rounded(rl, 1), rearRightKpa: rounded(rr, 1), averageKpa: rounded(average(values), 1), frontImbalanceKpa: rounded(finite(fl) && finite(fr) ? Math.abs(fl - fr) : NaN, 1), rearImbalanceKpa: rounded(finite(rl) && finite(rr) ? Math.abs(rl - rr) : NaN, 1), batteryTempMinC: rounded(median(row.temp), 1), samples: Math.max(row.fl.length, row.fr.length, row.rl.length, row.rr.length) }; }),
    batteryDaily: [...battery].sort().map(([date, row]) => ({ date, socMinPct: rounded(minFinite(row.soc), 1), socMaxPct: rounded(maxFinite(row.soc), 1), batteryTempMinC: rounded(minFinite(row.min), 1), batteryTempMaxC: rounded(maxFinite(row.max), 1), temperatureSpreadMaxC: rounded(maxFinite(row.spread), 1), impliedRangeMedianKm: rounded(median(row.range), 1), impliedRangeP10Km: rounded(percentile(row.range, .1), 1), impliedRangeP90Km: rounded(percentile(row.range, .9), 1), impliedRangeSamples: row.range.length })),
    rangeSamples,
  };
}

export function buildSnapshot(state, report = () => {}) {
  const { operation, energy, status } = state.streams; if (!operation || !energy || !status) throw new Error("missing_families");
  const local = timeContext(); report(74, "native_analytics", "Trips and charging sessions");
  const tripBuild = buildTrips(operation, energy, status, local), trips = tripBuild.trips, contexts = tripBuild.contexts, charges = buildCharges(operation, energy, local);
  const journeys = []; let current = [];
  for (const trip of trips) { const previous = current.at(-1); if (!previous || new Date(trip.startedAtUtc) / 1000 - new Date(previous.endedAtUtc) / 1000 <= JOURNEY_BREAK) current.push(trip); else { journeys.push(current); current = [trip]; } } if (current.length) journeys.push(current);
  const journeyRows = journeys.map((group) => { const first = group[0], last = group.at(-1), distance = sum(group, "distanceKm"), net = sum(group, "netEnergyKwh"), regenerated = sum(group, "regeneratedKwh"), used = sum(group, "energyUsedKwh"), duration = (new Date(last.endedAtUtc) - new Date(first.startedAtUtc)) / 60000; return { journeyId: id("journey", new Date(first.startedAtUtc) / 1000, new Date(last.endedAtUtc) / 1000), date: first.date, startedAtUtc: first.startedAtUtc, endedAtUtc: last.endedAtUtc, durationMinutes: rounded(duration, 1), drivingMinutes: rounded(sum(group, "durationMinutes"), 1), stoppedMinutes: rounded(duration - sum(group, "durationMinutes"), 1), distanceKm: rounded(distance), netEnergyKwh: rounded(net, 3), regeneratedKwh: rounded(regenerated, 3), energyUsedKwh: rounded(used, 3), regenerationSharePct: rounded(used + regenerated ? regenerated / (used + regenerated) * 100 : NaN, 1), consumptionKwh100: rounded(distance ? net / distance * 100 : NaN), maxSpeedKmh: rounded(Math.max(...group.map((row) => row.maxSpeedKmh || 0)), 1), tripIds: group.map((row) => row.tripId) }; });
  const gpsData = gpsSnapshot(state.gpsTracks || [], journeyRows, trips), enrichedJourneyRows = gpsData.journeys;
  state.gpsSelectedTracks = gpsData.selectedTracks;
  report(82, "native_analytics", "Daily, battery and driving metrics");
  const advancedData = advanced(operation, energy, status, local), dailyMap = new Map();
  const day = (date) => { if (!dailyMap.has(date)) dailyMap.set(date, { date, trips: 0, journeys: 0, distanceKm: 0, drivingHours: 0, energyUsedKwh: 0, netEnergyKwh: 0, regeneratedKwh: 0, charges: 0, wallEnergyKwh: 0, batteryEnergyKwh: 0 }); return dailyMap.get(date); };
  trips.forEach((row) => { const target = day(row.date); target.trips++; target.distanceKm += row.distanceKm || 0; target.drivingHours += (row.durationMinutes || 0) / 60; target.energyUsedKwh += row.energyUsedKwh || 0; target.netEnergyKwh += row.netEnergyKwh || 0; target.regeneratedKwh += row.regeneratedKwh || 0; });
  journeyRows.forEach((row) => day(row.date).journeys++); charges.forEach((row) => { const target = day(row.date); target.charges++; target.wallEnergyKwh += row.wallEnergyKwh || 0; target.batteryEnergyKwh += row.batteryEnergyKwh || 0; });
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ ...row, distanceKm: rounded(row.distanceKm), drivingHours: rounded(row.drivingHours, 1), energyUsedKwh: rounded(row.energyUsedKwh), netEnergyKwh: rounded(row.netEnergyKwh), regeneratedKwh: rounded(row.regeneratedKwh), consumptionKwh100: rounded(row.distanceKm ? row.netEnergyKwh / row.distanceKm * 100 : NaN), wallEnergyKwh: rounded(row.wallEnergyKwh), batteryEnergyKwh: rounded(row.batteryEnergyKwh) }));
  const health = charges.map((row) => ({ row, gain: (row.socEndPct || 0) - (row.socStartPct || 0) })).filter(({ row, gain }) => gain >= 20 && row.batteryEnergyKwh).map(({ row, gain }) => ({ date: row.date, capacityKwh: row.batteryEnergyKwh / gain * 100, socGainPct: gain })).filter((row) => row.capacityKwh >= 45 && row.capacityKwh <= 100).sort((a, b) => a.date.localeCompare(b.date));
  const baseline = median(health.slice(0, 3).map((row) => row.capacityKwh)); health.forEach((row, i) => { row.capacityKwh = rounded(row.capacityKwh); row.rollingCapacityKwh = rounded(median(health.slice(Math.max(0, i - 2), i + 1).map((item) => item.capacityKwh))); row.relativeSohPct = rounded(finite(baseline) ? row.rollingCapacityKwh / baseline * 100 : NaN, 1); });
  const parking = [];
  for (let i = 1; i < trips.length; i++) { const before = trips[i - 1], after = trips[i], startTime = new Date(before.endedAtUtc) / 1000, endTime = new Date(after.startedAtUtc) / 1000, hours = (endTime - startTime) / 3600; if (hours < .25 || charges.some((row) => new Date(row.startedAtUtc) / 1000 < endTime && new Date(row.endedAtUtc) / 1000 > startTime)) continue; const start = upperBound(energy.time, startTime), end = lowerBound(energy.time, endTime); let amount = 0, observed = 0; for (let j = start + 1; j < end; j++) { const dt = energy.time[j] - energy.time[j - 1]; if (dt <= 0 || dt > MAX_GAP) continue; const p1 = powerAt(energy, j - 1), p2 = powerAt(energy, j); if (finite(p1) && finite(p2)) { amount += Math.max(0, (p1 + p2) / 2) * dt / 3600; observed += dt; } } const loss = finite(before.socEndPct) && finite(after.socStartPct) ? Math.max(0, before.socEndPct - after.socStartPct) : NaN; parking.push({ stopId: id("stop", startTime, endTime), startedAtUtc: before.endedAtUtc, endedAtUtc: after.startedAtUtc, durationHours: rounded(hours, 1), socStartPct: before.socEndPct, socEndPct: after.socStartPct, socLossPct: rounded(loss, 1), socLossPerHour: rounded(finite(loss) ? loss / hours : NaN, 3), socLossPerDay: rounded(finite(loss) && hours >= 6 ? loss / hours * 24 : NaN, 2), energyKwh: rounded(amount, 3), averageWatts: rounded(observed ? amount / (observed / 3600) * 1000 : NaN, 0), observedSeconds: observed, coveragePct: rounded((endTime - startTime) ? observed / (endTime - startTime) * 100 : 0, 1), confidence: observed >= (endTime - startTime) * .8 ? "high" : observed >= (endTime - startTime) * .4 ? "medium" : "low" }); }
  const monthly = new Map(), weekday = Array.from({ length: 7 }, (_, index) => ({ weekday: index, trips: 0, distanceKm: 0 })), hours = Array.from({ length: 24 }, (_, hour) => ({ hour, trips: 0 }));
  daily.forEach((row) => { const key = row.date.slice(0, 7), target = monthly.get(key) || { month: key, distanceKm: 0, netEnergyKwh: 0, trips: 0, journeys: 0, charges: 0 }; target.distanceKm += row.distanceKm || 0; target.netEnergyKwh += row.netEnergyKwh || 0; target.trips += row.trips; target.journeys += row.journeys; target.charges += row.charges; monthly.set(key, target); });
  trips.forEach((row) => { const context = local(new Date(row.startedAtUtc) / 1000); weekday[context.weekday].trips++; weekday[context.weekday].distanceKm += row.distanceKm || 0; hours[context.hour].trips++; });
  const qualityEvents = [];
  for (const [family, stream] of Object.entries(state.streams)) { if (stream.stats.duplicates) qualityEvents.push({ family, field: null, rule: "duplicate_timestamp", severity: "low", affectedRows: stream.stats.duplicates, totalRows: stream.stats.inputRows }); if (stream.stats.invalidTimers) qualityEvents.push({ family, field: "timer", rule: "invalid_timer", severity: "high", affectedRows: stream.stats.invalidTimers, totalRows: stream.stats.inputRows }); if (stream.stats.wasUnsorted) qualityEvents.push({ family, field: "timer", rule: "unsorted_rows", severity: "medium", affectedRows: 1, totalRows: stream.stats.inputRows }); for (const [field, count] of Object.entries(stream.stats.invalidFields || {})) qualityEvents.push({ family, field, rule: "invalid_values", severity: "medium", affectedRows: count, totalRows: stream.stats.inputRows }); }
  const distance = sum(trips, "distanceKm"), net = sum(trips, "netEnergyKwh"), wall = sum(charges, "wallEnergyKwh"), batteryEnergy = sum(charges, "batteryEnergyKwh");
  report(96, "native_snapshot", "Preparing dashboard");
  return { format: "xpeng-analytics-dashboard/v2", generatedAtUtc: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local", overview: { activeDays: daily.filter((row) => row.trips || row.charges).length, tripCount: trips.length, journeyCount: journeyRows.length, chargeCount: charges.length, distanceKm: rounded(distance), drivingHours: rounded(sum(trips, "durationMinutes") / 60, 1), netEnergyKwh: rounded(net), regeneratedKwh: rounded(sum(trips, "regeneratedKwh")), consumptionKwh100: rounded(distance ? net / distance * 100 : NaN), maxSpeedKmh: rounded(Math.max(...trips.map((row) => row.maxSpeedKmh || 0)), 1), wallEnergyKwh: rounded(wall), batteryEnergyKwh: rounded(batteryEnergy), chargeEfficiencyPct: rounded(wall ? batteryEnergy / wall * 100 : NaN, 1), maxChargePowerKw: rounded(Math.max(...charges.map((row) => row.maxPowerKw || 0)), 1), firstUtc: trips.at(0)?.startedAtUtc || null, lastUtc: trips.at(-1)?.endedAtUtc || null }, daily, trips: trips.slice().reverse(), journeys: enrichedJourneyRows.slice().reverse(), charges: charges.slice().reverse(), driving: { speed: advancedData.speed, pedal: advancedData.pedal, gg: advancedData.gg, events: advancedData.events, contexts }, battery: { capacityKwh: rounded(median(health.map((row) => row.capacityKwh))), latestRelativeSohPct: health.at(-1)?.relativeSohPct ?? null, qualifiedCharges: health.length, history: health, parking: parking.reverse(), daily: advancedData.batteryDaily, rangeSamples: advancedData.rangeSamples, tyres: advancedData.tyres }, activity: { monthly: [...monthly.values()].map((row) => ({ ...row, distanceKm: rounded(row.distanceKm), netEnergyKwh: rounded(row.netEnergyKwh) })), weekday: weekday.map((row) => ({ ...row, distanceKm: rounded(row.distanceKm) })), hours, heatmap: advancedData.heatmap }, gps: gpsData.gps, quality: { coverage: Object.entries(state.streams).map(([family, stream]) => { const emptyColumns = stream.stats?.emptyColumns || [], availableColumns = Object.keys(stream.columns).filter((column) => !emptyColumns.includes(column)); return { family, rows: stream.time.length, firstUtc: iso(stream.time[0]), lastUtc: iso(stream.time.at(-1)), totalColumns: Object.keys(stream.columns).length, availableColumns, emptyColumns, unknownColumns: stream.stats?.unknownColumns || [] }; }), events: qualityEvents }, imports: state.imports, gpsImports: state.gpsImports || [] };
}

async function gzip(buffer) { const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("gzip")); return new Uint8Array(await new Response(stream).arrayBuffer()); }
async function gunzip(buffer) { const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip")); return new Uint8Array(await new Response(stream).arrayBuffer()); }
async function hash(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((v) => v.toString(16).padStart(2, "0")).join(""); }

export async function exportHistory(state, report = () => {}) {
  const chunks = [], streams = {}, gpsTracks = [], selectedGpsTracks = state.gpsSelectedTracks || state.gpsTracks || []; let offset = 0, completed = 0;
  const total = Object.values(state.streams).reduce((n, stream) => n + 1 + Object.keys(stream.columns).length, 0) + selectedGpsTracks.length * 6;
  const add = async (name, array) => { const raw = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), compressed = await gzip(raw); const record = { name, offset, bytes: compressed.byteLength, rawBytes: raw.byteLength, sha256: await hash(compressed) }; chunks.push(compressed); offset += compressed.byteLength; report(10 + (++completed / total) * 82, "history_export", name); return record; };
  for (const [family, stream] of Object.entries(state.streams)) { const record = { stats: stream.stats, model: stream.model, time: await add(`${family}/time`, stream.time), columns: {} }; for (const [name, column] of Object.entries(stream.columns)) record.columns[name] = await add(`${family}/${name}`, column); streams[family] = record; }
  for (const track of selectedGpsTracks) {
    const base = `gps/${track.trackId}`;
    gpsTracks.push({
      trackId: track.trackId,
      sourceName: track.sourceName,
      creator: track.creator,
      importedAtUtc: track.importedAtUtc,
      originalStartUtc: track.originalStartUtc,
      originalEndUtc: track.originalEndUtc,
      requestedTrimMeters: track.requestedTrimMeters,
      trimMeters: track.trimMeters,
      sourceTrackId: track.sourceTrackId,
      matchedTripId: track.matchedTripId,
      ignoredDuplicates: track.ignoredDuplicates,
      ignoredSourceIds: track.ignoredSourceIds,
      stats: track.stats,
      time: await add(`${base}/time`, track.time),
      lat: await add(`${base}/lat`, track.lat),
      lon: await add(`${base}/lon`, track.lon),
      elevation: await add(`${base}/elevation`, track.elevation),
      speedMps: await add(`${base}/speed`, track.speedMps),
      segment: await add(`${base}/segment`, track.segment),
    });
  }
  const manifest = new TextEncoder().encode(JSON.stringify({ format: HISTORY_FORMAT, version: HISTORY_VERSION, exportedAtUtc: new Date().toISOString(), model: state.model, imports: state.imports, streams, gps: { imports: state.gpsImports || [], tracks: gpsTracks } }));
  const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, manifest.byteLength, false);
  return new Blob([HISTORY_MAGIC, length, manifest, ...chunks]).arrayBuffer();
}

export async function importHistory(source, report = () => {}) {
  const sourceSize = sourceLength(source), header = await readSourceRange(source, 0, Math.min(12, sourceSize));
  const magicVersion = header[7];
  if (header.length < 12 || !HISTORY_MAGIC_PREFIX.every((value, i) => header[i] === value) || ![3, 4].includes(magicVersion)) throw new Error("history_version");
  const manifestLength = new DataView(header.buffer, header.byteOffset + 8, 4).getUint32(0, false);
  if (manifestLength > 2_000_000 || 12 + manifestLength > sourceSize) throw new Error("history_integrity");
  const manifestBytes = await readSourceRange(source, 12, 12 + manifestLength);
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (manifest.format !== HISTORY_FORMAT || manifest.version !== magicVersion || ![3, 4].includes(manifest.version)) throw new Error("history_version");
  if (!manifest.streams || !["operation", "energy", "status"].every((family) => manifest.streams[family])) throw new Error("history_integrity");
  const gpsRecords = manifest.version >= 4 ? manifest.gps?.tracks || [] : [];
  const payloadStart = 12 + manifestLength, streams = {}; let completed = 0;
  const total = Object.values(manifest.streams).reduce((n, stream) => n + 1 + Object.keys(stream.columns).length, 0) + gpsRecords.length * 6;
  const read = async (record, Type) => {
    if (!Number.isSafeInteger(record.offset) || !Number.isSafeInteger(record.bytes) || !Number.isSafeInteger(record.rawBytes) || record.offset < 0 || record.bytes < 0 || record.rawBytes < 0 || payloadStart + record.offset + record.bytes > sourceSize || record.rawBytes % Type.BYTES_PER_ELEMENT) throw new Error("history_integrity");
    const compressed = await readSourceRange(source, payloadStart + record.offset, payloadStart + record.offset + record.bytes);
    if (await hash(compressed) !== record.sha256) throw new Error("history_integrity");
    const raw = await gunzip(compressed);
    if (raw.byteLength !== record.rawBytes || raw.byteOffset % Type.BYTES_PER_ELEMENT) throw new Error("history_integrity");
    report(8 + (++completed / total) * 84, "history_read", record.name);
    return new Type(raw.buffer, raw.byteOffset, raw.byteLength / Type.BYTES_PER_ELEMENT);
  };
  for (const [family, record] of Object.entries(manifest.streams)) { const stream = { family, model: record.model || manifest.model, stats: record.stats, time: await read(record.time, Uint32Array), columns: {} }; for (const [name, column] of Object.entries(record.columns)) stream.columns[name] = await read(column, Float32Array); streams[family] = stream; }
  const gpsTracks = [];
  for (const record of gpsRecords) {
    const track = {
      trackId: String(record.trackId || ""), sourceName: String(record.sourceName || "GPX"), creator: String(record.creator || "GPX"), importedAtUtc: record.importedAtUtc || null,
      originalStartUtc: record.originalStartUtc || null, originalEndUtc: record.originalEndUtc || null, requestedTrimMeters: Number(record.requestedTrimMeters ?? record.trimMeters ?? 0), trimMeters: Number(record.trimMeters || 0), sourceTrackId: record.sourceTrackId || null, matchedTripId: record.matchedTripId || null, ignoredDuplicates: Number(record.ignoredDuplicates || 0), ignoredSourceIds: Array.isArray(record.ignoredSourceIds) ? record.ignoredSourceIds.map(String) : [], stats: record.stats || {},
      time: await read(record.time, Uint32Array), lat: await read(record.lat, Float64Array), lon: await read(record.lon, Float64Array), elevation: await read(record.elevation, Float32Array), speedMps: await read(record.speedMps, Float32Array), segment: await read(record.segment, Uint16Array),
    };
    const length = track.time.length;
    if (!track.trackId || length < 2 || ![track.lat, track.lon, track.elevation, track.speedMps, track.segment].every((array) => array.length === length)) throw new Error("history_integrity");
    for (let index = 0; index < length; index++) {
      if ((index && track.time[index] <= track.time[index - 1]) || !finite(track.lat[index]) || !finite(track.lon[index]) || Math.abs(track.lat[index]) > 90 || Math.abs(track.lon[index]) > 180) throw new Error("history_integrity");
    }
    gpsTracks.push(track);
  }
  return { format: HISTORY_FORMAT, version: HISTORY_VERSION, model: manifest.model || "", imports: manifest.imports || [], streams, gpsTracks, gpsSelectedTracks: [], gpsImports: manifest.gps?.imports || [] };
}

export function isNativeHistory(bytes) { return bytes.length >= HISTORY_MAGIC.length && HISTORY_MAGIC_PREFIX.every((value, index) => bytes[index] === value) && [3, 4].includes(bytes[7]); }
