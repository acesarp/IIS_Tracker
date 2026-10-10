"use client";

import { geoCircle, geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import type { LineString } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesJson from "world-atlas/countries-110m.json";

import type { IssPosition } from "@/lib/iss";

const WIDTH = 960;
const HEIGHT = 480;
const KM_PER_DEGREE = 111.32;

// Equirectangular maps longitude/latitude straight to x/y, so the whole world fits a 2:1 box.
const projection = geoEquirectangular().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
const path = geoPath(projection);

// The static layers never change, so their SVG paths are computed once per module load.
const topology = countriesJson as unknown as Topology<{ countries: GeometryCollection }>;
const countriesPath = path(feature(topology, topology.objects.countries)) ?? "";
const graticulePath = path(geoGraticule10()) ?? "";
const spherePath = path({ type: "Sphere" }) ?? "";

// Wraps any longitude into [-180, 180]; wheretheiss.at reports the Sun's in [0, 360].
function wrapLongitude(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

type Props = {
  position: IssPosition | null;
  // Predicted ground tracks as [longitude, latitude] pairs, oldest first.
  pastTrack: [number, number][];
  futureTrack: [number, number][];
};

// d3 splits a line where it crosses the antimeridian, so there's no wrap-around streak.
function trackPath(points: [number, number][]) {
  if (points.length < 2) return null;
  const line: LineString = { type: "LineString", coordinates: points };
  return path(line);
}

export default function WorldMap({ position, pastTrack, futureTrack }: Props) {
  // Night is the hemisphere centered on the point opposite the Sun.
  const nightPath = position
    ? path(
        geoCircle()
          .center([wrapLongitude(position.solarLongitude + 180), -position.solarLatitude])
          .radius(90)(),
      )
    : null;

  const footprintPath = position
    ? path(
        geoCircle()
          .center([position.longitude, position.latitude])
          .radius(position.footprintKm / 2 / KM_PER_DEGREE)(),
      )
    : null;

  const pastPath = trackPath(pastTrack);
  const futurePath = trackPath(futureTrack);

  const marker = position ? projection([position.longitude, position.latitude]) : null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label="World map showing the current position of the International Space Station"
    >
      <path d={spherePath} className="fill-sky-950" />
      <path d={graticulePath} className="fill-none stroke-sky-800/40" strokeWidth={0.5} />
      <path d={countriesPath} className="fill-slate-600 stroke-slate-800" strokeWidth={0.5} />
      {nightPath && <path d={nightPath} className="fill-black/45" />}
      {footprintPath && (
        <path d={footprintPath} className="fill-amber-300/10 stroke-amber-300/60" strokeWidth={1} />
      )}
      {futurePath && (
        <path d={futurePath} className="fill-none stroke-amber-200/70" strokeWidth={1.5} strokeDasharray="6 5" />
      )}
      {pastPath && (
        <path d={pastPath} className="fill-none stroke-amber-300" strokeWidth={2} strokeLinecap="round" />
      )}
      {marker && (
        <g transform={`translate(${marker[0]} ${marker[1]})`}>
          <circle r={10} className="animate-ping fill-amber-300/50 [transform-box:fill-box] origin-center" />
          <circle r={5} className="fill-amber-300 stroke-slate-950" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}
