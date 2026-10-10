import type { SeriesPoint } from "@/lib/space-weather";

const WIDTH = 300;
const HEIGHT = 80;

type Threshold = {
  value: number;
  label: string;
};

type Props = {
  points: SeriesPoint[];
  // Value range of the vertical axis, already in the chart's scale (e.g. log10 of flux).
  min: number;
  max: number;
  // Maps a raw value onto the axis; identity by default, Math.log10 for the X-ray chart.
  scale?: (value: number) => number;
  thresholds?: Threshold[];
  className?: string;
  label: string;
};

// A minimal line chart: time on x, value on y, with labelled horizontal reference lines.
export default function Sparkline({ points, min, max, scale = (v) => v, thresholds = [], className, label }: Props) {
  if (points.length < 2) {
    return null;
  }

  const start = points[0].time;
  const span = points.at(-1)!.time - start || 1;
  const x = (time: number) => ((time - start) / span) * WIDTH;
  const y = (value: number) => {
    const clamped = Math.min(max, Math.max(min, scale(value)));
    return HEIGHT - ((clamped - min) / (max - min)) * HEIGHT;
  };

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-20 w-full overflow-visible" role="img" aria-label={label}>
      {thresholds.map((t) => (
        <g key={t.label}>
          <line x1={0} x2={WIDTH} y1={y(t.value)} y2={y(t.value)} className="stroke-slate-700" strokeDasharray="3 3" />
          <text x={WIDTH} y={y(t.value) - 2} textAnchor="end" className="fill-slate-500 text-[9px]">
            {t.label}
          </text>
        </g>
      ))}
      <path d={area} className={`${className} opacity-15`} fill="currentColor" />
      <path d={line} className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
