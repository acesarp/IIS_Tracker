import { cacheLife } from "next/cache";

import type { IssPosition } from "@/lib/iss";

// NORAD catalog id 25544 is the ISS.
const SOURCE_URL = "https://api.wheretheiss.at/v1/satellites/25544";

// wheretheiss.at allows roughly one request per second, so all visitors share one cached
// position for up to 2 seconds. That stays fresher than the client's 3-second poll.
async function getIssPosition(): Promise<IssPosition> {
  "use cache";
  cacheLife({ stale: 1, revalidate: 1, expire: 2 });

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`wheretheiss.at returned ${res.status}`);
  }

  const data = await res.json();
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    altitudeKm: data.altitude,
    velocityKmh: data.velocity,
    visibility: data.visibility,
    footprintKm: data.footprint,
    solarLatitude: data.solar_lat,
    solarLongitude: data.solar_lon,
    timestamp: data.timestamp,
  };
}

// Proxies the live ISS position so the browser only talks to this app.
export async function GET() {
  try {
    return Response.json(await getIssPosition());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
