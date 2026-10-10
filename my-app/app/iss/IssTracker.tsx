"use client";

import { useEffect, useState } from "react";

import type { IssPosition, IssTrack } from "@/lib/iss";

import WorldMap from "./WorldMap";

const POLL_INTERVAL_MS = 3000;
// The server recomputes the predicted track every 30 seconds.
const TRACK_POLL_INTERVAL_MS = 30_000;

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export default function IssTracker() {
  const [position, setPosition] = useState<IssPosition | null>(null);
  const [track, setTrack] = useState<IssTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Schedules the next poll only after the current one finishes, so slow responses
    // never stack up overlapping requests.
    async function poll() {
      try {
        const res = await fetch("/api/iss", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const next: IssPosition = await res.json();
        if (cancelled) return;
        setPosition(next);
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

  // The predicted track is a nice-to-have: if it can't be loaded, the map just shows the
  // live position without it.
  useEffect(() => {
    let cancelled = false;

    async function loadTrack() {
      try {
        const res = await fetch("/api/iss/track", { cache: "no-store" });
        if (!res.ok) return;
        const next: IssTrack = await res.json();
        if (!cancelled) setTrack(next);
      } catch {
        // Keep showing the previous track, if any.
      }
    }

    loadTrack();
    const interval = setInterval(loadTrack, TRACK_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const stats = position
    ? [
        { label: "Latitude", value: formatCoordinate(position.latitude, "N", "S") },
        { label: "Longitude", value: formatCoordinate(position.longitude, "E", "W") },
        { label: "Altitude", value: `${position.altitudeKm.toFixed(1)} km` },
        { label: "Speed", value: `${Math.round(position.velocityKmh).toLocaleString()} km/h` },
        { label: "On board", value: position.visibility === "daylight" ? "☀️ Daylight" : "🌙 Earth's shadow" },
        { label: "Updated", value: new Date(position.timestamp * 1000).toLocaleTimeString() },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <WorldMap position={position} pastTrack={track?.past ?? []} futureTrack={track?.future ?? []} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-200">
          Could not update the position: {error}. Retrying…
        </p>
      )}

      {position ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</dt>
              <dd className="mt-1 font-mono text-lg text-slate-100">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        !error && <p className="text-slate-400">Locating the ISS…</p>
      )}
    </div>
  );
}
