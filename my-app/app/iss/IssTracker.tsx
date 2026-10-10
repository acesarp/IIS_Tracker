"use client";

import { useEffect, useState } from "react";

import type { IssPosition, IssTrack } from "@/lib/iss";

import WorldMap, { type MapView } from "./WorldMap";

const POLL_INTERVAL_MS = 3000;
// The server recomputes the predicted track every 30 seconds.
const TRACK_POLL_INTERVAL_MS = 30_000;

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

export default function IssTracker() {
  const [position, setPosition] = useState<IssPosition | null>(null);
  const [track, setTrack] = useState<IssTrack | null>(null);
  const [trackUnavailable, setTrackUnavailable] = useState(false);
  const [view, setView] = useState<MapView>("globe");
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
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const next: IssTrack = await res.json();
        if (cancelled) return;
        setTrack(next);
        setTrackUnavailable(false);
      } catch {
        // Keep showing the previous track, if any.
        if (!cancelled) setTrackUnavailable(true);
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
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="absolute left-3 top-3 z-10 flex rounded-lg bg-slate-800/90 p-1 text-sm">
          {(["globe", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`rounded-md px-3 py-1 capitalize ${view === option ? "bg-slate-600 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {option}
            </button>
          ))}
        </div>
        <WorldMap view={view} position={position} pastTrack={track?.past ?? []} futureTrack={track?.future ?? []} />
        {trackUnavailable && !track && (
          <p className="absolute bottom-3 left-3 rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs text-slate-400">
            Orbit prediction unavailable right now
          </p>
        )}
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
