const MAX_GPX_BYTES = 50 * 1024 * 1024;
const MAX_TRACK_POINTS = 1_000_000;
const ROUTE_PREVIEW_POINTS = 2_000;
const MAP_GAP_SECONDS = 30;

const finite = Number.isFinite;
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const rounded = (value, digits = 2) => finite(value) ? Number(value.toFixed(digits)) : null;
const iso = (seconds) => finite(seconds) ? new Date(seconds * 1000).toISOString() : null;

function attr(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function childText(body, name) {
  const match = body.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([^<]+)<\\/(?:[\\w.-]+:)?${name}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function optionalNumber(value) {
  if (value == null || value === "") return NaN;
  const parsed = Number(value);
  return finite(parsed) ? parsed : NaN;
}

function creator(text) {
  return attr(text.match(/<(?:[\w.-]+:)?gpx\b([^>]*)>/i)?.[1] || "", "creator") || "GPX";
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const radius = 6_371_008.8;
  const first = lat1 * Math.PI / 180, second = lat2 * Math.PI / 180;
  const deltaLat = second - first, deltaLon = (lon2 - lon1) * Math.PI / 180;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(first) * Math.cos(second) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function pointDistance(first, second) {
  return distanceMeters(first.lat, first.lon, second.lat, second.lon);
}

function trackDistance(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    if (points[index].segment === points[index - 1].segment) total += pointDistance(points[index - 1], points[index]);
  }
  return total;
}

function median(values) {
  const rows = values.filter(finite).sort((a, b) => a - b);
  if (!rows.length) return NaN;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function trimTrack(points, requestedMeters) {
  const trimMeters = Math.max(0, Number(requestedMeters) || 0);
  if (!trimMeters) return { points, trimMeters: 0 };
  const cumulative = new Float64Array(points.length);
  for (let index = 1; index < points.length; index++) {
    const distance = points[index].segment === points[index - 1].segment ? pointDistance(points[index - 1], points[index]) : 0;
    cumulative[index] = cumulative[index - 1] + distance;
  }
  const total = cumulative.at(-1);
  const kept = points.filter((_, index) => cumulative[index] >= trimMeters && total - cumulative[index] >= trimMeters);
  if (kept.length < 2) throw new Error("gps_trim_too_large");
  return { points: kept, trimMeters };
}

function buildTrack(sourceName, sourceSha256, sourceIndex, rawPoints, requestedTrimMeters, sourceCreator) {
  if (rawPoints.length < 2) throw new Error("invalid_gpx");
  const originalStart = rawPoints[0].timestamp, originalEnd = rawPoints.at(-1).timestamp;
  const trimmed = trimTrack(rawPoints, requestedTrimMeters), points = trimmed.points;
  const count = points.length;
  const time = new Uint32Array(count), lat = new Float64Array(count), lon = new Float64Array(count);
  const elevation = new Float32Array(count), speedMps = new Float32Array(count), segment = new Uint16Array(count);
  let observedSeconds = 0, gaps = 0, largestGap = 0;
  const intervals = [];
  for (let index = 0; index < count; index++) {
    const point = points[index];
    time[index] = point.timestamp;
    lat[index] = point.lat;
    lon[index] = point.lon;
    elevation[index] = finite(point.elevation) ? point.elevation : NaN;
    speedMps[index] = finite(point.speedMps) ? point.speedMps : NaN;
    segment[index] = point.segment;
    if (index) {
      const elapsed = point.timestamp - points[index - 1].timestamp;
      intervals.push(elapsed);
      const segmentChanged = point.segment !== points[index - 1].segment;
      if (elapsed > MAP_GAP_SECONDS || segmentChanged) gaps++;
      largestGap = Math.max(largestGap, elapsed);
      if (!segmentChanged) observedSeconds += Math.min(Math.max(0, elapsed), 5);
    }
  }
  const duration = Math.max(1, time.at(-1) - time[0]);
  const temporalCoverage = clamp(observedSeconds / duration);
  const typicalInterval = median(intervals.filter((value) => value > 0));
  const samplingScore = finite(typicalInterval) ? clamp(5 / typicalInterval) : 0;
  const continuityScore = clamp(1 - Math.max(0, largestGap - 5) / Math.max(60, duration));
  const qualityScore = .6 * temporalCoverage + .2 * samplingScore + .2 * continuityScore;
  return {
    trackId: `gps_${sourceSha256.slice(0, 16)}_${sourceIndex}`,
    sourceName,
    creator: sourceCreator,
    importedAtUtc: new Date().toISOString(),
    originalStartUtc: iso(originalStart),
    originalEndUtc: iso(originalEnd),
    trimMeters: trimmed.trimMeters,
    time,
    lat,
    lon,
    elevation,
    speedMps,
    segment,
    stats: {
      points: count,
      distanceKm: rounded(trackDistance(points) / 1000, 3),
      durationMinutes: rounded(duration / 60, 2),
      gapCount: gaps,
      largestGapSeconds: Math.round(largestGap),
      medianIntervalSeconds: rounded(typicalInterval, 1),
      temporalCoveragePct: rounded(temporalCoverage * 100, 1),
      qualityScore: rounded(qualityScore * 100, 0),
    },
  };
}

export function parseGpxText(text, { sourceName = "track.gpx", sourceSha256 = "unknown", startIndex = 0, trimMeters = 0 } = {}) {
  if (typeof text !== "string" || !text.trim() || new TextEncoder().encode(text).byteLength > MAX_GPX_BYTES) throw new Error("invalid_gpx");
  const trackMatches = [...text.matchAll(/<(?:[\w.-]+:)?trk\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?trk>/gi)];
  const containers = trackMatches.length ? trackMatches.map((match) => match[1]) : [text];
  const tracks = [];
  let sourceIndex = startIndex, totalPoints = 0;
  for (const container of containers) {
    const points = [];
    const segmentMatches = [...container.matchAll(/<(?:[\w.-]+:)?trkseg\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?trkseg>/gi)];
    const segmentBodies = segmentMatches.length ? segmentMatches.map((match) => match[1]) : [container];
    for (let segmentIndex = 0; segmentIndex < segmentBodies.length; segmentIndex++) {
      const pointPattern = /<(?:[\w.-]+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?trkpt>/gi;
      for (const match of segmentBodies[segmentIndex].matchAll(pointPattern)) {
        const latitude = Number(attr(match[1], "lat")), longitude = Number(attr(match[1], "lon"));
        const timestampMs = Date.parse(childText(match[2], "time") || "");
        if (!finite(latitude) || !finite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !finite(timestampMs)) continue;
        points.push({
          timestamp: Math.floor(timestampMs / 1000),
          lat: latitude,
          lon: longitude,
          elevation: optionalNumber(childText(match[2], "ele")),
          speedMps: optionalNumber(childText(match[2], "speed")),
          segment: segmentIndex,
        });
        totalPoints++;
        if (totalPoints > MAX_TRACK_POINTS) throw new Error("invalid_gpx");
      }
    }
    points.sort((a, b) => a.timestamp - b.timestamp);
    const unique = points.filter((point, index) => !index || point.timestamp !== points[index - 1].timestamp);
    if (unique.length >= 2) tracks.push(buildTrack(sourceName, sourceSha256, sourceIndex++, unique, trimMeters, creator(text)));
  }
  if (!tracks.length) throw new Error("invalid_gpx");
  return tracks;
}

function matchScore(track, journey) {
  const trackStart = track.time[0], trackEnd = track.time.at(-1);
  const journeyStart = Date.parse(journey.startedAtUtc) / 1000, journeyEnd = Date.parse(journey.endedAtUtc) / 1000;
  const journeyDuration = Math.max(1, journeyEnd - journeyStart), overlap = Math.max(0, Math.min(trackEnd, journeyEnd) - Math.max(trackStart, journeyStart));
  const startDelta = Math.abs(trackStart - journeyStart), endDelta = Math.abs(trackEnd - journeyEnd);
  const overlapScore = clamp(overlap / journeyDuration);
  const startScore = clamp(1 - startDelta / 600), endScore = clamp(1 - endDelta / 600);
  const distanceScore = clamp(1 - Math.abs(Number(track.stats.distanceKm) - Number(journey.distanceKm)) / Math.max(1, Number(journey.distanceKm)));
  const qualityScore = clamp(Number(track.stats.qualityScore) / 100);
  const eligible = overlap >= Math.min(60, journeyDuration * .2) || (startDelta <= 600 && endDelta <= 600);
  const score = eligible ? .45 * overlapScore + .2 * startScore + .15 * endScore + .15 * distanceScore + .05 * qualityScore : 0;
  return { score, overlapScore, startDelta, endDelta, distanceScore };
}

function confidence(score) {
  return score >= .86 ? "high" : score >= .65 ? "medium" : "low";
}

function routePreview(track) {
  const width = Math.max(1, Math.ceil(track.time.length / ROUTE_PREVIEW_POINTS));
  const segments = [];
  let current = [], previousIndex = null;
  for (let index = 0; index < track.time.length; index += width) {
    const sourceIndex = Math.min(index, track.time.length - 1);
    const gap = previousIndex != null && (track.time[sourceIndex] - track.time[previousIndex] > MAP_GAP_SECONDS || track.segment[sourceIndex] !== track.segment[previousIndex]);
    if (gap && current.length) { segments.push(current); current = []; }
    current.push({ lat: rounded(track.lat[sourceIndex], 6), lon: rounded(track.lon[sourceIndex], 6), timestampUtc: iso(track.time[sourceIndex]) });
    previousIndex = sourceIndex;
  }
  const lastIndex = track.time.length - 1;
  if (previousIndex !== lastIndex) current.push({ lat: rounded(track.lat[lastIndex], 6), lon: rounded(track.lon[lastIndex], 6), timestampUtc: iso(track.time[lastIndex]) });
  if (current.length) segments.push(current);
  return segments.filter((segment) => segment.length >= 2);
}

export function gpsSnapshot(tracks = [], journeys = [], assignments = {}) {
  const candidates = new Map();
  for (const track of tracks) {
    const ranked = journeys.map((journey) => ({ journey, ...matchScore(track, journey) })).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
    candidates.set(track.trackId, ranked);
  }
  const chosenByJourney = new Map();
  const usedTracks = new Set();
  for (const [journeyId, trackId] of Object.entries(assignments || {})) {
    const track = tracks.find((row) => row.trackId === trackId), journey = journeys.find((row) => row.journeyId === journeyId);
    if (track && journey && !usedTracks.has(trackId)) {
      chosenByJourney.set(journeyId, { track, match: matchScore(track, journey), manual: true });
      usedTracks.add(trackId);
    }
  }
  const automatic = [];
  for (const track of tracks) {
    const best = candidates.get(track.trackId)?.[0];
    if (best && best.score >= .45) automatic.push({ track, match: best, selectionScore: best.score * .8 + Number(track.stats.qualityScore) / 100 * .2 });
  }
  automatic.sort((a, b) => b.selectionScore - a.selectionScore);
  for (const candidate of automatic) {
    if (usedTracks.has(candidate.track.trackId) || chosenByJourney.has(candidate.match.journey.journeyId)) continue;
    chosenByJourney.set(candidate.match.journey.journeyId, { track: candidate.track, match: candidate.match, manual: false });
    usedTracks.add(candidate.track.trackId);
  }

  const journeyRows = journeys.map((journey) => {
    const chosen = chosenByJourney.get(journey.journeyId);
    if (!chosen) return journey;
    return {
      ...journey,
      gps: {
        trackId: chosen.track.trackId,
        sourceName: chosen.track.sourceName,
        creator: chosen.track.creator,
        confidence: confidence(chosen.match.score),
        confidenceScore: rounded(chosen.match.score * 100, 0),
        manual: chosen.manual,
        distanceKm: chosen.track.stats.distanceKm,
        points: chosen.track.stats.points,
        trimMeters: chosen.track.trimMeters,
        segments: routePreview(chosen.track),
      },
    };
  });
  const trackRows = tracks.map((track) => {
    const selectedEntry = [...chosenByJourney].find(([, chosen]) => chosen.track.trackId === track.trackId);
    const selectedJourney = selectedEntry?.[0] || null;
    const best = candidates.get(track.trackId)?.[0];
    return {
      trackId: track.trackId,
      sourceName: track.sourceName,
      creator: track.creator,
      startedAtUtc: iso(track.time[0]),
      endedAtUtc: iso(track.time.at(-1)),
      trimMeters: track.trimMeters,
      ...track.stats,
      matchedJourneyId: selectedJourney,
      manual: Boolean(selectedEntry?.[1]?.manual),
      suggestedJourneyId: best?.journey?.journeyId || null,
      confidence: best ? confidence(best.score) : "low",
      confidenceScore: rounded((best?.score || 0) * 100, 0),
      alternatives: (candidates.get(track.trackId) || []).slice(0, 5).map((row) => ({ journeyId: row.journey.journeyId, score: rounded(row.score * 100, 0) })),
    };
  });
  return { journeys: journeyRows, gps: { tracks: trackRows, matchedCount: chosenByJourney.size, unmatchedCount: trackRows.filter((row) => !row.matchedJourneyId).length } };
}

export function setGpsAssignment(state, trackId, journeyId) {
  const assignments = { ...(state.gpsAssignments || {}) };
  for (const [assignedJourneyId, assignedTrackId] of Object.entries(assignments)) {
    if (assignedTrackId === trackId || (journeyId && assignedJourneyId === journeyId)) delete assignments[assignedJourneyId];
  }
  if (trackId && journeyId) assignments[journeyId] = trackId;
  return { ...state, gpsAssignments: assignments };
}

export const GPX_LIMITS = { maxBytes: MAX_GPX_BYTES, maxPoints: MAX_TRACK_POINTS };
