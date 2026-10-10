// Shape returned by /api/space-weather, normalized from NOAA SWPC's public JSON feeds.

export type SeriesPoint = {
  // Unix milliseconds.
  time: number;
  value: number;
};

export type NoaaScale = {
  // 0 (none) to 5 (extreme).
  level: number;
  text: string;
};

export type SpaceWeather = {
  // GOES 0.1-0.8 nm X-ray flux in W/m², the measurement solar flares are classified by.
  xray: { current: SeriesPoint; series: SeriesPoint[] };
  // Estimated planetary K index (0-9), updated every minute. 5 or more is a geomagnetic storm.
  kp: { current: SeriesPoint; series: SeriesPoint[] };
  // Measured upstream of Earth at L1, about an hour before it arrives here.
  solarWind: { time: number; speedKms: number; densityPerCm3: number } | null;
  // Today's NOAA space weather scales: Radio blackouts, Solar radiation storms, Geomagnetic storms.
  scales: { R: NoaaScale; S: NoaaScale; G: NoaaScale } | null;
};

const FLARE_CLASSES = [
  ["X", 1e-4],
  ["M", 1e-5],
  ["C", 1e-6],
  ["B", 1e-7],
  ["A", 1e-8],
] as const;

// Turns an X-ray flux into its flare class, e.g. 2.3e-6 W/m² -> "C2.3".
export function flareClass(flux: number): string {
  for (const [letter, base] of FLARE_CLASSES) {
    if (flux >= base) {
      return `${letter}${(flux / base).toFixed(1)}`;
    }
  }
  return "<A1";
}
