// Server-only: Turbopack's production build hangs when satellite.js is bundled for the browser
// (Next 16.4 / satellite.js 7.1), so orbit math runs in route handlers and clients get the points.
import { cacheLife } from "next/cache";
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec } from "satellite.js";

// NORAD catalog id 25544 is the ISS.
const TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

// A two-line element set: the standard format for a satellite's orbit at a given moment.
type Tle = {
  line1: string;
  line2: string;
};

type Satrec = ReturnType<typeof twoline2satrec>;

// CelesTrak publishes new elements a few times a day and asks clients not to poll more often
// than that, so the TLE is cached for hours and shared by every visitor.
async function getIssTle(): Promise<Tle> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(TLE_URL);
  if (!res.ok) {
    throw new Error(`CelesTrak returned ${res.status}`);
  }

  const [, line1, line2] = (await res.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!line1?.startsWith("1 ") || !line2?.startsWith("2 ")) {
    throw new Error("CelesTrak returned an unexpected TLE format");
  }
  return { line1, line2 };
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
