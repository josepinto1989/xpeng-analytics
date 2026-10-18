const safe = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const total = (rows, field) => safe(rows).reduce((sum, row) => sum + (Number(row?.[field]) || 0), 0);

function shareByTrip(trips, predicate) {
  const rows = safe(trips).filter((trip) => trip?.startedAtUtc);
  const weight = (trip) => Math.max(0, Number(trip.distanceKm) || 0) || 1;
  const denominator = rows.reduce((sum, trip) => sum + weight(trip), 0);
  return denominator ? rows.filter(predicate).reduce((sum, trip) => sum + weight(trip), 0) / denominator : 0;
}

function hourOf(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.getHours() : null;
}

function dayOf(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.getDay() : null;
}

function minutesIn(speedRows, prefixes) {
  return safe(speedRows)
    .filter((row) => prefixes.some((prefix) => String(row.band || "").startsWith(prefix)))
    .reduce((sum, row) => sum + (Number(row.minutes) || 0), 0);
}

export const DRIVING_PERSONALITY_KEYS = [
  "smoothOperator", "efficiencyHunter", "regenerationMaster", "highwayCruiser",
  "urbanNavigator", "roadTripper", "dynamicDriver", "nightOwl", "earlyBird",
  "weekendExplorer", "onePedalArtist", "allRounder",
];

export function calculateDrivingPersonality({ trips = [], speedRows = [], pedalRows = [], events = [], profileScore = null } = {}) {
  const distanceKm = total(trips, "distanceKm");
  const energyUsedKwh = total(trips, "energyUsedKwh");
  const regeneratedKwh = total(trips, "regeneratedKwh");
  const grossEnergyKwh = energyUsedKwh + regeneratedKwh;
  const consumption = distanceKm > 0 ? energyUsedKwh / distanceKm * 100 : null;
  const regenerationShare = grossEnergyKwh > 0 ? regeneratedKwh / grossEnergyKwh : 0;
  const drivingMinutes = total(speedRows, "minutes");
  const urbanShare = drivingMinutes ? minutesIn(speedRows, ["0–", "30–"]) / drivingMinutes : 0;
  const highwayShare = drivingMinutes ? minutesIn(speedRows, ["90–", "120–", "150+"]) / drivingMinutes : 0;
  const pedalMinutes = total(pedalRows, "minutes");
  const highPedalShare = pedalMinutes ? minutesIn(pedalRows, ["50–", "75–"]) / pedalMinutes : 0;
  const drivingHours = drivingMinutes / 60;
  const brakingPerHour = drivingHours > 0 ? safe(events).filter((event) => event.kind === "braking").length / drivingHours : null;
  const averageTripKm = trips.length ? distanceKm / trips.length : 0;
  const nightShare = shareByTrip(trips, (trip) => { const hour = hourOf(trip.startedAtUtc); return hour !== null && (hour >= 20 || hour < 8); });
  const earlyShare = shareByTrip(trips, (trip) => { const hour = hourOf(trip.startedAtUtc); return hour !== null && hour >= 5 && hour < 9; });
  const weekendShare = shareByTrip(trips, (trip) => { const day = dayOf(trip.startedAtUtc); return day === 0 || day === 6; });
  const hasProfile = finite(profileScore);

  const candidates = [
    { key: "smoothOperator", score: hasProfile ? clamp(100 - Number(profileScore) * 1.25) : 0, eligible: hasProfile && drivingMinutes >= 20 },
    { key: "efficiencyHunter", score: finite(consumption) ? clamp((22 - consumption) / 8 * 100) : 0, eligible: distanceKm >= 20 },
    { key: "regenerationMaster", score: clamp((regenerationShare - .10) / .20 * 100), eligible: grossEnergyKwh >= 3 },
    { key: "highwayCruiser", score: clamp((highwayShare - .18) / .48 * 100), eligible: drivingMinutes >= 30 },
    { key: "urbanNavigator", score: clamp((urbanShare - .42) / .48 * 100), eligible: drivingMinutes >= 30 },
    { key: "roadTripper", score: clamp(Math.max(averageTripKm / 35, distanceKm / 350) * 100), eligible: trips.length >= 2 && distanceKm >= 50 },
    { key: "dynamicDriver", score: hasProfile ? clamp((Number(profileScore) - 35) / 50 * 100) : 0, eligible: hasProfile && drivingMinutes >= 20 },
    { key: "nightOwl", score: nightShare * 100, eligible: trips.length >= 3 },
    { key: "earlyBird", score: earlyShare * 100, eligible: trips.length >= 3 },
    { key: "weekendExplorer", score: weekendShare * 100, eligible: trips.length >= 3 },
    { key: "onePedalArtist", score: clamp(regenerationShare / .28 * 70 + (brakingPerHour == null ? 0 : (1 - clamp(brakingPerHour, 0, 5) / 5) * 30) - highPedalShare * 15), eligible: grossEnergyKwh >= 3 && drivingMinutes >= 30 },
  ].filter((candidate) => candidate.eligible).sort((a, b) => b.score - a.score);

  const primary = candidates[0]?.score >= 52 ? candidates[0] : { key: "allRounder", score: 50 };
  const excluded = new Set([primary.key]);
  if (primary.key === "smoothOperator") excluded.add("dynamicDriver");
  if (primary.key === "dynamicDriver") excluded.add("smoothOperator");
  if (primary.key === "nightOwl") excluded.add("earlyBird");
  if (primary.key === "earlyBird") excluded.add("nightOwl");
  const secondary = candidates.filter((candidate) => candidate.score >= 45 && !excluded.has(candidate.key)).slice(0, 2);

  return { primary, secondary };
}
