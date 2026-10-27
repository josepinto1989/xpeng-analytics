const MAX_GPX_BYTES = 50 * 1024 * 1024;
const MAX_TRACK_POINTS = 1_000_000;
const ROUTE_PREVIEW_POINTS = 2_000;
const MAP_GAP_SECONDS = 30;
const CSV_HEADER_ALIASES = {
  time: ["time","timestamp","datetime","date_time","recorded_at","recordedat","utc","timeutc","date"],
  lat: ["lat","latitude","gps_latitude"], lon: ["lon","lng","longitude","gps_longitude"],
  elevation: ["ele","elevation","alt","altitude","height"], speed: ["speed","speed_mps","speed_ms","speed_kmh","velocity"],
};

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

function csvRows(text, delimiter) {
  const output=[];let row=[],field="",quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){if(char==='"'&&text[index+1]==='"'){field+='"';index++;}else if(char==='"')quoted=false;else field+=char;continue;}
    if(char==='"'){quoted=true;continue;}if(char===delimiter){row.push(field);field="";continue;}
    if(char==='\n'||char==='\r'){if(char==='\r'&&text[index+1]==='\n')index++;row.push(field);field="";if(row.some((value)=>value.trim()))output.push(row);row=[];continue;}field+=char;
  }
  row.push(field);if(row.some((value)=>value.trim()))output.push(row);return output;
}

function normalHeader(value){return String(value||"").trim().toLowerCase().replace(/^\ufeff/,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
function headerIndex(headers,aliases){for(const alias of aliases){const index=headers.indexOf(alias);if(index>=0)return index;}return -1;}
function parsedTimestamp(value){
  const raw=String(value??"").trim();if(!raw)return NaN;const numeric=Number(raw);
  if(finite(numeric)){if(numeric>1e12)return Math.floor(numeric/1000);if(numeric>1e9)return Math.floor(numeric);}
  const milliseconds=Date.parse(raw);return finite(milliseconds)?Math.floor(milliseconds/1000):NaN;
}

export function looksLikeGpsCsv(text){
  if(typeof text!=="string"||!text.trim())return false;const first=text.split(/\r?\n/,1)[0]||"";
  const delimiter=[",",";","\t"].sort((a,b)=>first.split(b).length-first.split(a).length)[0],headers=csvRows(first,delimiter)[0]?.map(normalHeader)||[];
  return headerIndex(headers,CSV_HEADER_ALIASES.time)>=0&&headerIndex(headers,CSV_HEADER_ALIASES.lat)>=0&&headerIndex(headers,CSV_HEADER_ALIASES.lon)>=0;
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
    requestedTrimMeters: Math.max(0, Number(requestedTrimMeters) || 0),
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
    if (unique.length >= 2) {
      const track = buildTrack(sourceName, sourceSha256, sourceIndex++, unique, 0, creator(text));
      track.requestedTrimMeters = Math.max(0, Number(trimMeters) || 0);
      tracks.push(track);
    }
  }
  if (!tracks.length) throw new Error("invalid_gpx");
  return tracks;
}

export function parseGpsCsvText(text, { sourceName = "track.csv", sourceSha256 = "unknown", startIndex = 0, trimMeters = 0 } = {}) {
  if(typeof text!=="string"||!text.trim()||new TextEncoder().encode(text).byteLength>MAX_GPX_BYTES||!looksLikeGpsCsv(text))throw new Error("invalid_gpx");
  const first=text.split(/\r?\n/,1)[0]||"",delimiter=[",",";","\t"].sort((a,b)=>first.split(b).length-first.split(a).length)[0],records=csvRows(text,delimiter);
  if(records.length<3)throw new Error("invalid_gpx");
  const headers=records.shift().map(normalHeader),timeIndex=headerIndex(headers,CSV_HEADER_ALIASES.time),latIndex=headerIndex(headers,CSV_HEADER_ALIASES.lat),lonIndex=headerIndex(headers,CSV_HEADER_ALIASES.lon),elevationIndex=headerIndex(headers,CSV_HEADER_ALIASES.elevation),speedIndex=headerIndex(headers,CSV_HEADER_ALIASES.speed),speedIsKmh=speedIndex>=0&&/kmh|kph/.test(headers[speedIndex]);
  const points=[];let segment=0,previousTime=null;
  for(const record of records){
    const timestamp=parsedTimestamp(record[timeIndex]),lat=Number(String(record[latIndex]??"").trim().replace(",",".")),lon=Number(String(record[lonIndex]??"").trim().replace(",","."));
    if(!finite(timestamp)||!finite(lat)||!finite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
    if(previousTime!=null&&timestamp-previousTime>600)segment++;
    const speed=optionalNumber(record[speedIndex]);
    points.push({timestamp,lat,lon,elevation:optionalNumber(record[elevationIndex]),speedMps:finite(speed)?(speedIsKmh?speed/3.6:speed):NaN,segment});previousTime=timestamp;
    if(points.length>MAX_TRACK_POINTS)throw new Error("invalid_gpx");
  }
  points.sort((a,b)=>a.timestamp-b.timestamp);const unique=points.filter((point,index)=>!index||point.timestamp!==points[index-1].timestamp);
  if(unique.length<2)throw new Error("invalid_gpx");
  const track=buildTrack(sourceName,sourceSha256,startIndex,unique,0,"GPS CSV");track.requestedTrimMeters=Math.max(0,Number(trimMeters)||0);return [track];
}

function confidence(score) {
  return score >= .86 ? "high" : score >= .65 ? "medium" : "low";
}

function lowerBound(values, target) {
  let low = 0, high = values.length;
  while (low < high) { const middle = (low + high) >> 1; if (values[middle] < target) low = middle + 1; else high = middle; }
  return low;
}

function upperBound(values, target) {
  let low = 0, high = values.length;
  while (low < high) { const middle = (low + high) >> 1; if (values[middle] <= target) low = middle + 1; else high = middle; }
  return low;
}

function candidateForTrip(track, trip, clockOffsetSeconds = 0) {
  const tripStart = Date.parse(trip.startedAtUtc) / 1000, tripEnd = Date.parse(trip.endedAtUtc) / 1000;
  if (!finite(tripStart) || !finite(tripEnd) || tripEnd <= tripStart || track.time.at(-1)+clockOffsetSeconds < tripStart || track.time[0]+clockOffsetSeconds > tripEnd) return null;
  const first = lowerBound(track.time, tripStart-clockOffsetSeconds), last = upperBound(track.time, tripEnd-clockOffsetSeconds), points = [];
  for (let index = first; index < last; index++) points.push({
    timestamp: track.time[index]+clockOffsetSeconds, lat: track.lat[index], lon: track.lon[index], elevation: track.elevation[index], speedMps: track.speedMps[index], segment: track.segment[index],
  });
  if (points.length < 2) return null;
  let route;
  const sourceTrackId = track.sourceTrackId || track.trackId;
  const requestedTrimMeters = Number(track.requestedTrimMeters ?? track.trimMeters ?? 0);
  try {
    route = buildTrack(track.sourceName, sourceTrackId, 0, points, track.matchedTripId ? 0 : requestedTrimMeters, track.creator);
  } catch {
    return null;
  }
  route.trackId = `${sourceTrackId}__${trip.tripId}`;
  route.sourceTrackId = sourceTrackId;
  route.matchedTripId = trip.tripId;
  route.requestedTrimMeters = requestedTrimMeters;
  if (track.matchedTripId) route.trimMeters = Number(track.trimMeters || 0);
  route.ignoredSourceIds = Array.isArray(track.ignoredSourceIds) ? [...track.ignoredSourceIds] : [];
  route.ignoredDuplicates = route.ignoredSourceIds.length || Number(track.ignoredDuplicates || 0);
  const duration = Math.max(1, tripEnd - tripStart), routeDuration = Math.max(1, route.time.at(-1) - route.time[0]);
  const startDelta = Math.max(0, route.time[0] - tripStart), endDelta = Math.max(0, tripEnd - route.time.at(-1));
  const coverageScore = clamp(routeDuration / duration), startScore = clamp(1 - startDelta / 180), endScore = clamp(1 - endDelta / 180);
  const tripDistance = Math.max(.01, Number(trip.distanceKm) || 0), routeDistance = Number(route.stats.distanceKm) || 0;
  const distanceScore = clamp(1 - Math.abs(routeDistance - tripDistance) / Math.max(.5, tripDistance));
  const tripSpeed = Number(trip.avgSpeedKmh) || tripDistance / (duration / 3600), routeSpeed = routeDistance / (routeDuration / 3600);
  const speedScore = clamp(1 - Math.abs(routeSpeed - tripSpeed) / Math.max(10, tripSpeed));
  const qualityScore = clamp(Number(route.stats.qualityScore) / 100);
  const offsetPenalty=clockOffsetSeconds?Math.min(.08,Math.abs(clockOffsetSeconds)/3600*.004):0;
  const score = .4 * coverageScore + .12 * startScore + .1 * endScore + .2 * distanceScore + .1 * speedScore + .08 * qualityScore-offsetPenalty;
  const eligible = route.time.length >= 2 && coverageScore >= .2 && routeDistance >= Math.min(.03, tripDistance * .2) && score >= .45;
  return { route, trip, score, eligible, coverageScore, distanceScore, speedScore, clockOffsetSeconds };
}

function routeContext(route){
  const seconds={urban:0,road:0,motorway:0};let validSeconds=0;
  for(let index=1;index<route.time.length;index++){
    const elapsed=route.time[index]-route.time[index-1];if(elapsed<=0||elapsed>60||route.segment[index]!==route.segment[index-1])continue;
    let speed=Number(route.speedMps[index])*3.6;if(!finite(speed))speed=pointDistance({lat:route.lat[index-1],lon:route.lon[index-1]},{lat:route.lat[index],lon:route.lon[index]})/elapsed*3.6;
    if(!finite(speed)||speed<2)continue;const context=speed>=90?"motorway":speed>=50?"road":"urban";seconds[context]+=elapsed;validSeconds+=elapsed;
  }
  const ranked=Object.entries(seconds).sort((a,b)=>b[1]-a[1]),dominant=ranked[0]?.[0]||"urban",share=validSeconds?ranked[0][1]/validSeconds:0;
  return {dominant,confidence:share>=.7?"high":share>=.5?"medium":"low",shares:Object.fromEntries(Object.entries(seconds).map(([key,value])=>[key,rounded(validSeconds?value/validSeconds*100:0,0)]))};
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

export function gpsSnapshot(tracks = [], journeys = [], trips = []) {
  const chosenByTrip = new Map(), selectedTracks = [];
  let duplicateCount = 0;
  for (const trip of trips) {
    const bestBySource = new Map();
    for (const track of tracks) {
      let candidate = candidateForTrip(track, trip, 0);
      if(!candidate||candidate.score<.62){
        for(let hour=-12;hour<=14;hour++){if(!hour)continue;const shifted=candidateForTrip(track,trip,hour*3600);if(shifted&&(!candidate||shifted.score>candidate.score))candidate=shifted;}
      }
      if (!candidate) continue;
      const sourceId = candidate.route.sourceTrackId;
      const previous = bestBySource.get(sourceId);
      if (!previous || candidate.score > previous.score) bestBySource.set(sourceId, candidate);
    }
    const ranked = [...bestBySource.values()].sort((left, right) => right.score - left.score || Number(right.route.stats.qualityScore) - Number(left.route.stats.qualityScore) || right.route.time.length - left.route.time.length || left.route.trackId.localeCompare(right.route.trackId));
    const chosen = ranked.find((candidate) => candidate.eligible);
    if (!chosen) continue;
    const ignoredSourceIds = new Set(chosen.route.ignoredSourceIds || []);
    for (const alternative of ranked) {
      if (alternative === chosen) continue;
      const overlapsSameTrip = alternative.score >= .35 || (alternative.coverageScore >= .25 && alternative.distanceScore >= .15);
      if (!overlapsSameTrip) continue;
      ignoredSourceIds.add(alternative.route.sourceTrackId);
      for (const sourceId of alternative.route.ignoredSourceIds || []) ignoredSourceIds.add(sourceId);
    }
    ignoredSourceIds.delete(chosen.route.sourceTrackId);
    chosen.route.ignoredSourceIds = [...ignoredSourceIds].sort();
    chosen.route.ignoredDuplicates = chosen.route.ignoredSourceIds.length;
    chosen.route.clockOffsetSeconds=chosen.clockOffsetSeconds;
    chosen.route.stats={...chosen.route.stats,matchCoveragePct:rounded(chosen.coverageScore*100,1),partialMatch:chosen.coverageScore<.8,sparseRecording:Number(chosen.route.stats.medianIntervalSeconds)>10||Number(chosen.route.stats.largestGapSeconds)>60,clockOffsetMinutes:Math.round(chosen.clockOffsetSeconds/60),routeContext:routeContext(chosen.route)};
    duplicateCount += chosen.route.ignoredDuplicates;
    chosenByTrip.set(trip.tripId, chosen);
    selectedTracks.push(chosen.route);
  }
  const selectedSourceIds = new Set(selectedTracks.map((track) => track.sourceTrackId));
  const ignoredTrackCount = new Set(tracks.map((track) => track.sourceTrackId || track.trackId).filter((trackId) => !selectedSourceIds.has(trackId))).size;
  const journeyRows = journeys.map((journey) => {
    const chosen = (journey.tripIds || []).map((tripId) => chosenByTrip.get(tripId)).filter(Boolean);
    if (!chosen.length) return journey;
    const sourceNames = [...new Set(chosen.map((row) => row.route.sourceName))], creators = [...new Set(chosen.map((row) => row.route.creator))];
    const weight = chosen.reduce((total, row) => total + Math.max(1, row.route.time.at(-1) - row.route.time[0]), 0);
    const score = chosen.reduce((total, row) => total + row.score * Math.max(1, row.route.time.at(-1) - row.route.time[0]), 0) / weight;
    const contextTotals={urban:0,road:0,motorway:0};chosen.forEach((row)=>{const context=row.route.stats.routeContext;for(const key of Object.keys(contextTotals))contextTotals[key]+=Number(context?.shares?.[key]||0)*Math.max(1,row.route.time.at(-1)-row.route.time[0]);});
    const contextShares=Object.fromEntries(Object.entries(contextTotals).map(([key,value])=>[key,rounded(value/weight,0)])),dominantContext=Object.entries(contextShares).sort((a,b)=>b[1]-a[1])[0]?.[0]||"urban";
    const offsets=[...new Set(chosen.map((row)=>Math.round(row.clockOffsetSeconds/60)).filter(Boolean))];
    return {
      ...journey,
      gps: {
        trackId: chosen.map((row) => row.route.trackId).join("+"),
        sourceName: sourceNames.length === 1 ? sourceNames[0] : `${sourceNames[0]} +${sourceNames.length - 1}`,
        creator: creators.join(", "),
        confidence: confidence(score), confidenceScore: rounded(score * 100, 0),
        distanceKm: rounded(chosen.reduce((total, row) => total + Number(row.route.stats.distanceKm || 0), 0), 3),
        points: chosen.reduce((total, row) => total + row.route.time.length, 0),
        trimMeters: Math.max(...chosen.map((row) => Number(row.route.trimMeters || 0))),
        coveragePct:rounded(chosen.reduce((total,row)=>total+row.coverageScore*Math.max(1,row.route.time.at(-1)-row.route.time[0]),0)/weight*100,1),
        diagnostics:{partial:chosen.some((row)=>row.route.stats.partialMatch),sparse:chosen.some((row)=>row.route.stats.sparseRecording),clockOffsetMinutes:offsets.length===1?offsets[0]:offsets.length?offsets:null},
        routeContext:{dominant:dominantContext,shares:contextShares,confidence:contextShares[dominantContext]>=70?"high":contextShares[dominantContext]>=50?"medium":"low"},
        segments: chosen.flatMap((row) => routePreview(row.route)),
      },
    };
  });
  const trackRows = selectedTracks.map((track) => ({
    trackId: track.trackId, sourceName: track.sourceName, creator: track.creator, startedAtUtc: iso(track.time[0]), endedAtUtc: iso(track.time.at(-1)),
    trimMeters: track.trimMeters, ...track.stats, matchedTripId: track.matchedTripId, confidence: confidence(chosenByTrip.get(track.matchedTripId)?.score || 0), confidenceScore: rounded((chosenByTrip.get(track.matchedTripId)?.score || 0) * 100, 0),
  }));
  return { journeys: journeyRows, selectedTracks, gps: { tracks: trackRows, matchedCount: journeyRows.filter((row) => row.gps).length, matchedTripCount: chosenByTrip.size, duplicateCount, ignoredTrackCount, diagnosticCounts:{partial:trackRows.filter((row)=>row.partialMatch).length,sparse:trackRows.filter((row)=>row.sparseRecording).length,clockAdjusted:trackRows.filter((row)=>row.clockOffsetMinutes).length} } };
}

export const GPX_LIMITS = { maxBytes: MAX_GPX_BYTES, maxPoints: MAX_TRACK_POINTS };
