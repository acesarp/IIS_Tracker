"use client";

import { type ReactNode, useEffect, useState } from "react";

import { BASE_PATH } from "@/lib/base-path";
import { flareClass, type NoaaScale, type SpaceWeather } from "@/lib/space-weather";

import Sparkline from "./Sparkline";

// NOAA updates these feeds once a minute.
const POLL_INTERVAL_MS = 60_000;

// Kp 5 is a G1 storm, each step up is one G level, through G5 at Kp 9.
function kpTone(kp: number) {
  if (kp >= 7) return { text: "text-red-400", label: "Strong storm" };
  if (kp >= 5) return { text: "text-orange-400", label: "Geomagnetic storm" };
  if (kp >= 4) return { text: "text-yellow-300", label: "Active" };
  return { text: "text-emerald-400", label: "Quiet" };
}

function flareTone(flux: number) {
  if (flux >= 1e-4) return { text: "text-red-400", label: "Major flare" };
  if (flux >= 1e-5) return { text: "text-orange-400", label: "Moderate flare" };
  if (flux >= 1e-6) return { text: "text-yellow-300", label: "Minor activity" };
  return { text: "text-emerald-400", label: "Quiet" };
}

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ScaleBadge({ letter, scale, title }: { letter: string; scale: NoaaScale; title: string }) {
  const active = scale.level > 0;
  return (
    <span
      title={title}
      className={`rounded-md px-2 py-0.5 font-mono text-xs ${active ? "bg-orange-500/20 text-orange-300" : "bg-slate-800 text-slate-400"}`}
    >
      {letter}
      {scale.level} {scale.text}
    </span>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-xs uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export default function SpaceWeatherPanel() {
  const [data, setData] = useState<SpaceWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`${BASE_PATH}/api/space-weather`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const next: SpaceWeather = await res.json();
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!data) {
    return error ? (
      <p className="rounded-lg border border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-200">
        Could not load space weather: {error}. Retrying…
      </p>
    ) : (
      <p className="text-slate-400">Loading space weather…</p>
    );
  }

  const flare = flareTone(data.xray.current.value);
  const kp = kpTone(data.kp.current.value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-xl font-semibold">Space weather</h2>
        {data.scales && (
          <>
            <ScaleBadge letter="R" scale={data.scales.R} title="Radio blackouts (from solar flares)" />
            <ScaleBadge letter="S" scale={data.scales.S} title="Solar radiation storms" />
            <ScaleBadge letter="G" scale={data.scales.G} title="Geomagnetic storms" />
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-300">Last update failed ({error}); showing the previous data.</p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Solar flares · GOES X-ray">
          <div className="flex items-baseline justify-between">
            <span className={`font-mono text-3xl ${flare.text}`}>{flareClass(data.xray.current.value)}</span>
            <span className={`text-sm ${flare.text}`}>{flare.label}</span>
          </div>
          <Sparkline
            points={data.xray.series}
            min={-8}
            max={-3}
            scale={Math.log10}
            thresholds={[
              { value: 1e-6, label: "C" },
              { value: 1e-5, label: "M" },
              { value: 1e-4, label: "X" },
            ]}
            className="text-amber-300"
            label="Solar X-ray flux over the last 6 hours, logarithmic scale"
          />
          <p className="text-xs text-slate-500">Last 6 h · updated {formatTime(data.xray.current.time)}</p>
        </Card>

        <Card title="Geomagnetic activity · Kp index">
          <div className="flex items-baseline justify-between">
            <span className={`font-mono text-3xl ${kp.text}`}>{data.kp.current.value.toFixed(2)}</span>
            <span className={`text-sm ${kp.text}`}>{kp.label}</span>
          </div>
          <Sparkline
            points={data.kp.series}
            min={0}
            max={9}
            thresholds={[{ value: 5, label: "storm" }]}
            className="text-emerald-300"
            label="Estimated Kp index over the last 6 hours"
          />
          <p className="text-xs text-slate-500">
            Last 6 h · updated {formatTime(data.kp.current.time)} · higher Kp pushes auroras farther from the poles
          </p>
        </Card>

        <Card title="Solar wind · at L1">
          {data.solarWind ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl text-sky-300">{Math.round(data.solarWind.speedKms)}</span>
                <span className="text-sm text-slate-400">km/s</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl text-sky-200">{data.solarWind.densityPerCm3.toFixed(1)}</span>
                <span className="text-sm text-slate-400">protons/cm³</span>
              </div>
              <p className="mt-auto text-xs text-slate-500">
                Measured 1.5 million km sunward, reaching Earth in about an hour · updated{" "}
                {formatTime(data.solarWind.time)}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Solar wind data unavailable right now.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
