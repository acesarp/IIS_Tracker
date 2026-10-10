// Shape returned by /api/iss, normalized from wheretheiss.at's response.
export type IssPosition = {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmh: number;
  // "eclipsed" means the station is in Earth's shadow (night on board).
  visibility: "daylight" | "eclipsed";
  // Diameter, in km, of the area on Earth from which the ISS is above the horizon.
  footprintKm: number;
  // Point on Earth where the Sun is directly overhead; used to draw the night side.
  solarLatitude: number;
  solarLongitude: number;
  // Unix seconds.
  timestamp: number;
};

// Shape returned by /api/iss/track: predicted ground tracks as [longitude, latitude] pairs,
// oldest first, split at `computedAt` (Unix milliseconds).
export type IssTrack = {
  computedAt: number;
  past: [number, number][];
  future: [number, number][];
};
