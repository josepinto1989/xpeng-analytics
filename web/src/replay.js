const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const REPLAY_SPEEDS = Object.freeze([1, 2, 3, 5, 10]);
export const REPLAY_GAP_THRESHOLD_MS = 60_000;
export const REPLAY_COMPRESSED_GAP_MS = 10_000;

const interpolatedFields = [
  "speedKmh", "speedPeakKmh", "powerKw", "powerPeakKw", "socPct",
  "displayedRangeKm", "batteryTempC", "acceleratorPct", "acceleratorPeakPct",
  "longitudinalG", "lateralG", "steeringAngleDeg",
  "rearMotorRpm", "rearMotorTorqueNm", "rearRotorTempC",
  "tyreFrontLeftKpa", "tyreFrontRightKpa", "tyreRearLeftKpa", "tyreRearRightKpa",
];
const discreteFields = [
  "brakePct", "gearLevel", "driverDoorOpen", "passengerDoorOpen", "rearLeftDoorOpen", "rearRightDoorOpen",
  "trunkState", "frontLeftWindowPosition", "frontRightWindowPosition", "rearLeftWindowPosition", "rearRightWindowPosition",
];

export function gearLabel(value) {
  return ({ 1: "D", 2: "N", 3: "R", 4: "P" })[Number(value)] || null;
}

export function trunkProgress(value) {
  return ({ 0: 0, 1: 0, 2: .45, 3: .6, 4: .75, 5: 1, 6: .8, 7: .65, 8: .45, 9: .2, 10: .1 })[Number(value)] ?? null;
}

export function trunkPhase(value) {
  const state = Number(value);
  if (state === 1) return "closed";
  if ([2, 3].includes(state)) return "opening";
  if (state === 5) return "open";
  if ([6, 7].includes(state)) return "closing";
  if ([4, 8].includes(state)) return "paused";
  if ([9, 10].includes(state)) return "partial";
  return "unknown";
}

export function windowMotion(value) {
  return ({ 0: "off", 1: "stopped", 2: "manualUp", 3: "autoUp", 4: "manualDown", 5: "autoDown" })[Number(value)] || "unknown";
}

export function estimatedLowBeam(timestampUtc) {
  const date = new Date(timestampUtc);
  if (!Number.isFinite(date.getTime())) return false;
  const hour = date.getHours();
  return hour >= 20 || hour < 8;
}

export function visualFrontWheelAngle(steeringAngleDeg) {
  if (!finite(steeringAngleDeg)) return 0;
  return clamp(Number(steeringAngleDeg) / 16, -32, 32);
}

export function buildReplayTimeline(journey, trips = []) {
  if (!journey) return [];
  const tripById = new Map(trips.map((trip) => [trip.tripId, trip]));
  const rows = (journey.tripIds || []).flatMap((tripId) => {
    const trip = tripById.get(tripId);
    const series = Array.isArray(trip?.replaySeries) ? trip.replaySeries : Array.isArray(trip?.series) ? trip.series : [];
    const events = Array.isArray(trip?.replayEvents) ? trip.replayEvents : [];
    const continuousSeries = events.length ? series.map((point) => {
      const copy = { ...point };
      for (const field of discreteFields) delete copy[field];
      return copy;
    }) : series;
    return [...continuousSeries, ...events].map((point) => ({ ...point, tripId }));
  }).map((point) => ({ ...point, timestampMs: Date.parse(point.timestampUtc || "") }))
    .filter((point) => Number.isFinite(point.timestampMs))
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const unique = [];
  for (const point of rows) {
    const previous = unique.at(-1);
    if (previous?.timestampMs === point.timestampMs) Object.assign(previous, point);
    else unique.push({ ...point });
  }
  const carried = {};
  for (const point of unique) {
    for (const field of [...interpolatedFields, ...discreteFields]) {
      if (finite(point[field])) carried[field] = Number(point[field]);
      else if (finite(carried[field])) point[field] = carried[field];
    }
  }
  let playbackMs = 0;
  return unique.map((point, index) => {
    const sourceGapMs = index ? Math.max(0, point.timestampMs - unique[index - 1].timestampMs) : 0;
    const playbackGapMs = sourceGapMs > REPLAY_GAP_THRESHOLD_MS ? REPLAY_COMPRESSED_GAP_MS : sourceGapMs;
    playbackMs += playbackGapMs;
    return { ...point, sourceGapMs, playbackGapMs, playbackMs };
  });
}

export function replayFrame(timeline, requestedMs) {
  if (!Array.isArray(timeline) || !timeline.length) return null;
  const elapsedMs = clamp(Number(requestedMs) || 0, 0, timeline.at(-1).playbackMs);
  let low = 0, high = timeline.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (timeline[middle].playbackMs <= elapsedMs) low = middle + 1;
    else high = middle - 1;
  }
  const before = timeline[Math.max(0, high)], after = timeline[Math.min(timeline.length - 1, low)];
  const span = Math.max(1, after.playbackMs - before.playbackMs);
  const ratio = before === after ? 0 : clamp((elapsedMs - before.playbackMs) / span, 0, 1);
  const output = { ...before, playbackMs: elapsedMs, progress: timeline.at(-1).playbackMs ? elapsedMs / timeline.at(-1).playbackMs : 1 };
  for (const field of interpolatedFields) {
    const first = Number(before[field]), second = Number(after[field]);
    output[field] = Number.isFinite(first) && Number.isFinite(second) ? first + (second - first) * ratio : Number.isFinite(first) ? first : Number.isFinite(second) ? second : null;
  }
  output.timestampMs = before.timestampMs + (after.timestampMs - before.timestampMs) * ratio;
  output.timestampUtc = new Date(output.timestampMs).toISOString();
  output.skippedGap = after.sourceGapMs > REPLAY_GAP_THRESHOLD_MS && before !== after;
  return output;
}

export function replayDuration(timeline) {
  return Array.isArray(timeline) && timeline.length ? timeline.at(-1).playbackMs : 0;
}

export function instantaneousConsumption(point) {
  const speed = Number(point?.speedKmh), power = Number(point?.powerKw);
  if (!Number.isFinite(speed) || !Number.isFinite(power) || speed < 5 || power <= 0) return null;
  return power / speed * 100;
}

export function activeJourneyDates(journeys = []) {
  return journeys.reduce((map, journey) => {
    const date = String(journey?.date || journey?.startedAtUtc || "").slice(0, 10);
    if (date) map.set(date, (map.get(date) || 0) + 1);
    return map;
  }, new Map());
}
