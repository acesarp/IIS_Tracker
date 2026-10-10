// Server-only: Turbopack's production build hangs when satellite.js is bundled for the browser
// (Next 16.4 / satellite.js 7.1), so orbit math runs in route handlers and clients get the points.
import { cacheLife } from "next/cache";
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec } from "satellite.js";

// NORAD catalog id 25544 is the ISS.
const CELESTRAK_TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";
const WHERETHEISS_TLE_URL = "https://api.wheretheiss.at/v1/satellites/25544/tles?format=json";

// A two-line element set: the standard format for a satellite's orbit at a given moment.
type Tle = {
  line1: string;
  line2: string;
};

type Satrec = ReturnType<typeof twoline2satrec>;

function checkTle(tle: Partial<Tle>, source: string): Tle {
  if (!tle.line1?.startsWith("1 ") || !tle.line2?.startsWith("2 ")) {
    throw new Error(`${source} returned an unexpected TLE format`);
  }
  return { line1: tle.line1, line2: tle.line2 };
}

async function fetchCelestrakTle(): Promise<Tle> {
  const res = await fetch(CELESTRAK_TLE_URL);
  if (!res.ok) {
    throw new Error(`CelesTrak returned ${res.status}`);
  }
  const [, line1, line2] = (await res.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return checkTle({ line1, line2 }, "CelesTrak");
}

// Usually a few hours older than CelesTrak's, which still predicts within a few km.
async function fetchWheretheissTle(): Promise<Tle> {
  const res = await fetch(WHERETHEISS_TLE_URL);
  if (!res.ok) {
    throw new Error(`wheretheiss.at returned ${res.status}`);
  }
  return checkTle(await res.json(), "wheretheiss.at");
}

// CelesTrak publishes new elements a few times a day and temporarily blocks (403) clients that
// download the same data too often, so the TLE is cached for hours and shared by every visitor,
// with wheretheiss.at as a fallback source. Failures aren't cached, so the next request retries.
async function getIssTle(): Promise<Tle> {
  "use cache";
  cacheLife("hours");

  try {
    return await fetchCelestrakTle();
  } catch (celestrakError) {
    try {
      return await fetchWheretheissTle();
    } catch (fallbackError) {
      throw new Error(`No TLE source available: ${celestrakError}; ${fallbackError}`);
    }
  }
}

// Predicts the point on Earth directly below the satellite every `stepMs` between two times,
// as [longitude, latitude] pairs. Accurate to a few km for a TLE that's a day or two old.
function groundTrack(satrec: Satrec, fromMs: number, toMs: number, stepMs: number): [number, number][] {
  const points: [number, number][] = [];
  for (let time = fromMs; time <= toMs; time += stepMs) {
    const date = new Date(time);
    const state = propagate(satrec, date);
    if (!state) {
      continue;
    }
    const geodetic = eciToGeodetic(state.position, gstime(date));
    points.push([degreesLong(geodetic.longitude), degreesLat(geodetic.latitude)]);
  }
  return points;
}

export async function getIssGroundTrack(atMs: number, pastMs: number, futureMs: number, stepMs: number) {
  const { line1, line2 } = await getIssTle();
  const satrec = twoline2satrec(line1, line2);
  return {
    past: groundTrack(satrec, atMs - pastMs, atMs, stepMs),
    future: groundTrack(satrec, atMs, atMs + futureMs, stepMs),
  };
}
