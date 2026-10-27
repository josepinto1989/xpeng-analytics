import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { importArchive, importHistory, emptyState } from "../src/engine/native-engine.js";

const paths = process.argv.slice(2);
if (!paths.length) throw new Error("Pass one or more .xpeng or XPENG ZIP paths.");

const aggregateEvents = (events = []) => [...events.reduce((groups, event) => {
  const key = `${event.rule}|${event.family}|${event.field || ""}|${event.severity}`;
  const current = groups.get(key) || { rule: event.rule, family: event.family, field: event.field || null, severity: event.severity, events: 0, affectedRows: 0, totalRows: 0 };
  current.events += 1;
  current.affectedRows += Number(event.affectedRows || 0);
  current.totalRows += Number(event.totalRows || 0);
  groups.set(key, current);
  return groups;
}, new Map()).values()].sort((left, right) => right.affectedRows - left.affectedRows);

for (const path of paths) {
  const bytes = await readFile(path), blob = new Blob([bytes]);
  const state = path.toLowerCase().endsWith(".xpeng")
    ? await importHistory(blob)
    : (await importArchive(emptyState(), blob, basename(path))).state;
  const snapshot = state.snapshot;
  const tripsWithGaps = (snapshot.trips || []).filter((trip) => Number(trip.gapCount || 0) > 0);
  const coverage = (snapshot.quality?.coverage || []).map((row) => ({
    family: row.family,
    rows: row.rows,
    firstUtc: row.firstUtc,
    lastUtc: row.lastUtc,
    totalColumns: row.totalColumns,
    availableColumns: row.availableColumns?.length || 0,
    emptyColumns: row.emptyColumns?.length || 0,
    unknownColumns: row.unknownColumns?.length || 0,
  }));
  const imports = snapshot.imports || [];
  console.log(JSON.stringify({
    file: basename(path), bytes: bytes.length, storageMonths: snapshot.storage?.months || 0,
    coverage,
    imports: { count: imports.length, latest: imports.slice(-12).map(({ name, sourceStartUtc, sourceEndUtc, importedAtUtc, rows }) => ({ name, sourceStartUtc, sourceEndUtc, importedAtUtc, rows })) },
    overview: snapshot.overview,
    qualityEvents: aggregateEvents(snapshot.quality?.events),
    odometerCoverageGaps: (snapshot.quality?.events || []).filter((event) => event.rule === "odometer_coverage_gap").map(({ startedAtUtc, endedAtUtc, durationMinutes, missingDistanceKm, severity }) => ({ startedAtUtc, endedAtUtc, durationMinutes, missingDistanceKm, severity })),
    tripsWithTelemetryGaps: tripsWithGaps.length,
    telemetryGapCount: tripsWithGaps.reduce((total, trip) => total + Number(trip.gapCount || 0), 0),
    largestTripGapCounts: tripsWithGaps.slice().sort((left, right) => Number(right.gapCount || 0) - Number(left.gapCount || 0)).slice(0, 20).map((trip) => ({ tripId: trip.tripId, startedAtUtc: trip.startedAtUtc, endedAtUtc: trip.endedAtUtc, distanceKm: trip.distanceKm, gapCount: trip.gapCount })),
  }, null, 2));
}
