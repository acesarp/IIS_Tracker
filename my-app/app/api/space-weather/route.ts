import { cacheLife } from "next/cache";

import type { NoaaScale, SeriesPoint, SpaceWeather } from "@/lib/space-weather";

const SWPC = "https://services.swpc.noaa.gov";
const XRAY_URL = `${SWPC}/json/goes/primary/xrays-6-hour.json`;
const KP_URL = `${SWPC}/json/planetary_k_index_1m.json`;
const SOLAR_WIND_URL = `${SWPC}/json/rtsw/rtsw_wind_1m.json`;
const SCALES_URL = `${SWPC}/products/noaa-scales.json`;

// The feeds have one point per minute; keeping every 5th is plenty for a 6-hour chart.
const SAMPLE_EVERY_MINUTES = 5;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} returned ${res.status}`);
  }
  return res.json();
}

// Keeps one point every SAMPLE_EVERY_MINUTES, plus the newest so the chart ends at "now".
function downsample(points: SeriesPoint[]): SeriesPoint[] {
  const sampled = points.filter((p) => new Date(p.time).getUTCMinutes() % SAMPLE_EVERY_MINUTES === 0);
  const latest = points.at(-1);
  if (latest && sampled.at(-1) !== latest) {
    sampled.push(latest);
  }
  return sampled;
}

function toScale(raw: { Scale: string | null; Text: string | null } | undefined): NoaaScale {
  return { level: Number(raw?.Scale ?? 0), text: raw?.Text ?? "none" };
}

type XrayRow = { time_tag: string; energy: string; flux: number | null };
type KpRow = { time_tag: string; estimated_kp: number | null };
type WindRow = { time_tag: string; active: boolean; proton_speed: number | null; proton_density: number | null };
type ScalesDoc = Record<string, { R?: { Scale: string | null; Text: string | null }; S?: { Scale: string | null; Text: string | null }; G?: { Scale: string | null; Text: string | null } }>;

// NOAA refreshes these feeds once a minute, so every visitor shares one cached copy per minute
// instead of each poll hitting NOAA (the solar wind file alone is ~3 MB).
async function getSpaceWeather(): Promise<SpaceWeather> {
  "use cache";
  cacheLife("minutes");

  const [xrayRows, kpRows, windRows, scalesDoc] = await Promise.all([
    getJson<XrayRow[]>(XRAY_URL),
    getJson<KpRow[]>(KP_URL),
    // Optional extras: a failure here shouldn't take down the whole panel.
    getJson<WindRow[]>(SOLAR_WIND_URL).catch(() => null),
    getJson<ScalesDoc>(SCALES_URL).catch(() => null),
  ]);

  // The feed interleaves two energy bands; flares are classified on the 0.1-0.8 nm one.
  const xray = xrayRows
    .filter((r) => r.energy === "0.1-0.8nm" && r.flux != null && r.flux > 0)
    .map((r) => ({ time: Date.parse(r.time_tag), value: r.flux as number }));

  // Kp time tags carry no zone designator but are UTC.
  const kp = kpRows
    .filter((r) => r.estimated_kp != null)
    .map((r) => ({ time: Date.parse(`${r.time_tag}Z`), value: r.estimated_kp as number }));

  if (xray.length === 0 || kp.length === 0) {
    throw new Error("NOAA returned no X-ray or Kp data");
  }

  // Newest first; skip rows from the inactive backup spacecraft or with gaps.
  const wind = windRows?.find((r) => r.active && r.proton_speed != null && r.proton_density != null);
  const today = scalesDoc?.["0"];

  return {
    xray: { current: xray.at(-1)!, series: downsample(xray) },
    kp: { current: kp.at(-1)!, series: downsample(kp) },
    solarWind: wind
      ? {
          time: Date.parse(`${wind.time_tag}Z`),
          speedKms: wind.proton_speed as number,
          densityPerCm3: wind.proton_density as number,
        }
      : null,
    scales: today ? { R: toScale(today.R), S: toScale(today.S), G: toScale(today.G) } : null,
  };
}

export async function GET() {
  try {
    return Response.json(await getSpaceWeather());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
