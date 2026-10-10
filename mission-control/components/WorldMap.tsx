"use client";

import {
  geoCircle,
  geoDistance,
  geoEquirectangular,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoPath,
  type GeoProjection,
} from "d3-geo";
import type { LineString } from "geojson";
import { type PointerEvent, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesJson from "world-atlas/countries-110m.json";

import { BASE_PATH } from "@/lib/base-path";
import type { IssPosition } from "@/lib/iss";

export type MapView = "map" | "globe";

const MAP_WIDTH = 1060;
const MAP_HEIGHT = 780;
const GLOBE_SIZE = 780;
const KM_PER_DEGREE = 111.32;
// Degrees the globe turns per pixel dragged.
const DRAG_SENSITIVITY = 0.4;
// The ISS marker is a round photo; public/ files need the base path, unlike <Link>s.
const AVATAR_RADIUS = 26;

const topology = countriesJson as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topology, topology.objects.countries);
const graticule = geoGraticule10();

// Equirectangular maps longitude/latitude straight to x/y, so the whole world fits a 2:1 box.
// It never rotates, so its static layers are computed once per module load.
const mapProjection = geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: "Sphere" });
const mapPath = geoPath(mapProjection);
const mapStatic = {
  sphere: mapPath({ type: "Sphere" }) ?? "",
  graticule: mapPath(graticule) ?? "",
  countries: mapPath(countries) ?? "",
};

// Wraps any longitude into [-180, 180]; wheretheiss.at reports the Sun's in [0, 360].
function wrapLongitude(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

type Props = {
  view: MapView;
  position: IssPosition | null;
  // Predicted ground tracks as [longitude, latitude] pairs, oldest first.
  pastTrack: [number, number][];
  futureTrack: [number, number][];
};

type LayersProps = Omit<Props, "view"> & {
  projection: GeoProjection;
  path: GeoPath;
  staticPaths: { sphere: string; graticule: string; countries: string };
  // Point the globe is facing, as [longitude, latitude]; points beyond 90° from it are hidden.
  center?: [number, number];
  oceanFill: string;
};

// Everything drawn on top of the projection; the same for the flat map and the globe.
function Layers({ projection, path, staticPaths, center, oceanFill, position, pastTrack, futureTrack }: LayersProps) {
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

  // d3 clips lines at the antimeridian on the map and at the horizon on the globe.
  const trackPath = (points: [number, number][]) => {
    if (points.length < 2) return null;
    const line: LineString = { type: "LineString", coordinates: points };
    return path(line);
  };
  const pastPath = trackPath(pastTrack);
  const futurePath = trackPath(futureTrack);

  const issOnVisibleSide =
    position && (!center || geoDistance([position.longitude, position.latitude], center) < Math.PI / 2);
  const marker = issOnVisibleSide ? projection([position.longitude, position.latitude]) : null;

  return (
    <>
      <path d={staticPaths.sphere} fill={oceanFill} />
      <path d={staticPaths.graticule} className="fill-none stroke-sky-700/30" strokeWidth={0.5} />
      <path d={staticPaths.countries} className="fill-slate-600 stroke-slate-800" strokeWidth={0.5} />
      {nightPath && <path d={nightPath} className="fill-black/45" />}
      {footprintPath && (
        <path d={footprintPath} className="fill-amber-300/10 stroke-amber-300/60" strokeWidth={1} />
      )}
      {futurePath && (
        <path d={futurePath} className="fill-none stroke-amber-200/70" strokeWidth={1.5} strokeDasharray="6 5" />
      )}
      {pastPath && <path d={pastPath} className="fill-none stroke-amber-300" strokeWidth={2} strokeLinecap="round" />}
      {marker && (
        <g transform={`translate(${marker[0]} ${marker[1]})`}>
          <circle r={AVATAR_RADIUS * 1.3 } className="animate-ping fill-amber-300/40 [transform-box:fill-box] origin-center" />
          {/* Only one marker is ever on screen, so a fixed clip-path id can't collide. */}
          <clipPath id="iss-avatar-clip">
            <circle r={AVATAR_RADIUS * 1.3 } />
          </clipPath>
          <image
            href={`${BASE_PATH}/iss-avatar.png`}
            x={-AVATAR_RADIUS }
            y={-AVATAR_RADIUS + 1 }
            width={AVATAR_RADIUS * 2 }
            height={AVATAR_RADIUS * 2 }
            clipPath="url(#iss-avatar-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle r={AVATAR_RADIUS * 1.1} className="fill-none stroke-amber-300" strokeWidth={1} />
        </g>
      )}
    </>
  );
}

function FlatMap(props: Omit<Props, "view">) {
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label="World map showing the current position of the International Space Station"
    >
      <Layers {...props} projection={mapProjection} path={mapPath} staticPaths={mapStatic} oceanFill="#082f49" />
    </svg>
  );
}

function Globe(props: Omit<Props, "view">) {
  const { position } = props;
  // null while following the ISS; set once the user drags the globe around.
  const [manualCenter, setManualCenter] = useState<[number, number] | null>(null);
  const drag = useRef<{ x: number; y: number; center: [number, number] } | null>(null);

  const center: [number, number] = manualCenter ?? (position ? [position.longitude, position.latitude] : [0, 20]);
  const [centerLon, centerLat] = center;

  // Rotating the globe moves every country, so its paths are recomputed when the center changes.
  const { projection, path, staticPaths } = useMemo(() => {
    const projection = geoOrthographic()
      .fitSize([GLOBE_SIZE, GLOBE_SIZE], { type: "Sphere" })
      .rotate([-centerLon, -centerLat]);
    const path = geoPath(projection);
    return {
      projection,
      path,
      staticPaths: {
        sphere: path({ type: "Sphere" }) ?? "",
        graticule: path(graticule) ?? "",
        countries: path(countries) ?? "",
      },
    };
  }, [centerLon, centerLat]);

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, center };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const { x, y, center: start } = drag.current;
    const lon = wrapLongitude(start[0] - (event.clientX - x) * DRAG_SENSITIVITY);
    const lat = Math.max(-90, Math.min(90, start[1] + (event.clientY - y) * DRAG_SENSITIVITY));
    setManualCenter([lon, lat]);
  }

  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div className="relative">
      <svg
        viewBox={`-20 -20 ${GLOBE_SIZE + 40} ${GLOBE_SIZE + 40}`}
        className="mx-auto h-auto w-full max-w-[560px] cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="Globe showing the current position of the International Space Station; drag to rotate"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          {/* Light from the upper left gives the flat disc a sense of volume. */}
          <radialGradient id="globe-ocean" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <radialGradient id="globe-atmosphere" r="50%">
            <stop offset="88%" stopColor="#38bdf8" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={GLOBE_SIZE / 2} cy={GLOBE_SIZE / 2} r={GLOBE_SIZE / 2 + 18} fill="url(#globe-atmosphere)" />
        <Layers
          {...props}
          projection={projection}
          path={path}
          staticPaths={staticPaths}
          center={center}
          oceanFill="url(#globe-ocean)"
        />
      </svg>
      {manualCenter && (
        <button
          type="button"
          onClick={() => setManualCenter(null)}
          className="absolute bottom-3 right-3 rounded-lg bg-slate-800/90 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
        >
          Follow ISS
        </button>
      )}
    </div>
  );
}

export default function WorldMap({ view, ...props }: Props) {
  return view === "globe" ? <Globe {...props} /> : <FlatMap {...props} />;
}
