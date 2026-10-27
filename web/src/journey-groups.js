export const JOURNEY_GROUPS_VERSION = 1;
export const JOURNEY_GROUP_LIMITS = Object.freeze({ groups: 100, journeys: 30, name: 80 });

const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => Number.isFinite(Number(value));
const cleanText = (value, limit) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const time = (value) => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : NaN; };
const rounded = (value, digits = 2) => finite(value) ? Number(Number(value).toFixed(digits)) : null;
const total = (items, field) => rows(items).reduce((sum, item) => sum + (Number(item?.[field]) || 0), 0);

export function validateJourneyGroups(input) {
  if (!Array.isArray(input)) return [];
  const output = [], seenGroups = new Set(), assignedTrips = new Set();
  for (const raw of input.slice(0, JOURNEY_GROUP_LIMITS.groups * 2)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const groupId = cleanText(raw.groupId, 120);
    if (!groupId || seenGroups.has(groupId)) continue;
    const tripIds = [...new Set(rows(raw.tripIds).map((value) => cleanText(value, 160)).filter(Boolean))].filter((id) => !assignedTrips.has(id)).slice(0, JOURNEY_GROUP_LIMITS.journeys * 12);
    const journeyIds = [...new Set(rows(raw.journeyIds).map((value) => cleanText(value, 160)).filter(Boolean))].slice(0, JOURNEY_GROUP_LIMITS.journeys);
    if (tripIds.length < 2 && journeyIds.length < 2) continue;
    const name = cleanText(raw.name, JOURNEY_GROUP_LIMITS.name);
    output.push({ groupId, name, journeyIds, tripIds, createdAtUtc: Number.isFinite(time(raw.createdAtUtc)) ? new Date(raw.createdAtUtc).toISOString() : null });
    tripIds.forEach((id) => assignedTrips.add(id));
    seenGroups.add(groupId);
    if (output.length >= JOURNEY_GROUP_LIMITS.groups) break;
  }
  return output;
}

function combinedGps(journeys) {
  const gpsRows = journeys.map((journey) => journey.gps).filter(Boolean);
  if (!gpsRows.length) return null;
  const sources = [...new Set(gpsRows.map((gps) => gps.sourceName).filter(Boolean))];
  const creators = [...new Set(gpsRows.map((gps) => gps.creator).filter(Boolean))];
  const pointCount = total(gpsRows, "points");
  const confidence = pointCount ? gpsRows.reduce((sum, gps) => sum + (Number(gps.confidenceScore) || 0) * (Number(gps.points) || 0), 0) / pointCount : null;
  return {
    trackId: gpsRows.map((gps) => gps.trackId).filter(Boolean).join("+"),
    sourceName: sources.length > 1 ? `${sources[0]} +${sources.length - 1}` : sources[0] || "GPX",
    creator: creators.join(", "),
    confidence: confidence >= 75 ? "high" : confidence >= 50 ? "medium" : "low",
    confidenceScore: rounded(confidence, 0), distanceKm: rounded(total(gpsRows, "distanceKm"), 3), points: pointCount,
    trimMeters: Math.max(0, ...gpsRows.map((gps) => Number(gps.trimMeters) || 0)),
    segments: gpsRows.flatMap((gps) => rows(gps.segments)),
  };
}

function stopEvents(journeys, charges) {
  const events = [];
  for (let index = 1; index < journeys.length; index++) {
    const previous = journeys[index - 1], next = journeys[index];
    const start = time(previous.endedAtUtc), end = time(next.startedAtUtc);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const between = rows(charges).filter((charge) => {
      const chargeStart = time(charge.startedAtUtc), chargeEnd = time(charge.endedAtUtc);
      return Number.isFinite(chargeStart) && Number.isFinite(chargeEnd) && chargeStart < end && chargeEnd > start;
    }).sort((left, right) => time(left.startedAtUtc) - time(right.startedAtUtc));
    events.push({ stopId: `${previous.journeyId}:${next.journeyId}`, startedAtUtc: previous.endedAtUtc, endedAtUtc: next.startedAtUtc, durationMinutes: rounded((end - start) / 60000, 1), charges: between });
  }
  return events;
}

export function buildJourneyGroupView(data) {
  const journeys = rows(data?.journeys), trips = rows(data?.trips), charges = rows(data?.charges);
  const tripById = new Map(trips.map((trip) => [trip.tripId, trip]));
  const journeyById = new Map(journeys.map((journey) => [journey.journeyId, journey]));
  const definitions = validateJourneyGroups(data?.journeyGroups), groups = [], membership = new Map();
  for (const definition of definitions) {
    const selected = new Map();
    definition.journeyIds.forEach((id) => { const journey = journeyById.get(id); if (journey) selected.set(journey.journeyId, journey); });
    const requestedTrips = new Set(definition.tripIds);
    journeys.forEach((journey) => { if (rows(journey.tripIds).some((id) => requestedTrips.has(id))) selected.set(journey.journeyId, journey); });
    const members = [...selected.values()].sort((left, right) => time(left.startedAtUtc) - time(right.startedAtUtc));
    if (members.length < 2) continue;
    const memberTrips = [...new Set(members.flatMap((journey) => rows(journey.tripIds)))].filter((id) => tripById.has(id));
    if (memberTrips.length < 2 || memberTrips.some((id) => membership.has(id))) continue;
    const first = members[0], last = members.at(-1), distance = total(members, "distanceKm"), net = total(members, "netEnergyKwh"), used = total(members, "energyUsedKwh"), regenerated = total(members, "regeneratedKwh");
    const elapsed = (time(last.endedAtUtc) - time(first.startedAtUtc)) / 60000, driving = total(members, "drivingMinutes");
    const stops = stopEvents(members, charges), attachedCharges = stops.flatMap((stop) => stop.charges);
    const group = {
      ...definition, journeyId: definition.groupId, isManualGroup: true, date: first.date, startedAtUtc: first.startedAtUtc, endedAtUtc: last.endedAtUtc,
      durationMinutes: rounded(elapsed, 1), drivingMinutes: rounded(driving, 1), stoppedMinutes: rounded(Math.max(0, elapsed - driving), 1),
      distanceKm: rounded(distance), netEnergyKwh: rounded(net, 3), energyUsedKwh: rounded(used, 3), regeneratedKwh: rounded(regenerated, 3),
      regenerationSharePct: rounded(used + regenerated ? regenerated / (used + regenerated) * 100 : null, 1), consumptionKwh100: rounded(distance ? net / distance * 100 : null),
      maxSpeedKmh: rounded(Math.max(...members.map((journey) => Number(journey.maxSpeedKmh) || 0)), 1), tripIds: memberTrips,
      sourceJourneys: members, stopEvents: stops, attachedCharges, gps: combinedGps(members),
    };
    memberTrips.forEach((id) => membership.set(id, definition.groupId));
    groups.push(group);
  }
  return { groups, definitions, membership };
}

export function journeyGroupDefinition(groupId, name, journeys) {
  const members = rows(journeys).slice().sort((left, right) => time(left.startedAtUtc) - time(right.startedAtUtc));
  return validateJourneyGroups([{ groupId, name, createdAtUtc: new Date().toISOString(), journeyIds: members.map((journey) => journey.journeyId), tripIds: members.flatMap((journey) => rows(journey.tripIds)) }])[0] || null;
}
