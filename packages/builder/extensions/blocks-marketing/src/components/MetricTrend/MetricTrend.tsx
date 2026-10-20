import { useId } from 'react';

export interface MetricTrendProps {
  readonly values: readonly number[];
  readonly label: string;
}

/** A bounded, script-free sparkline with its complete observations as accessible text. */
export function MetricTrend({ values, label }: MetricTrendProps) {
  const id = useId();
  if (values.length < 2 || values.length > 24 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  // Scale first so finite extreme values never overflow the geometry arithmetic.
  const scale = Math.max(...values.map(Math.abs)) || 1;
  const normalized = values.map((value) => value / scale);
  const min = Math.min(...normalized);
  const span = Math.max(...normalized) - min;
  const points = normalized.map((value, index) => {
    const x = 4 + (index / (values.length - 1)) * 152;
    const y = span === 0 ? 20 : 36 - ((value - min) / span) * 32;
    return `${String(x)},${String(y)}`;
  });
  return (
    <svg
      role="img"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-values`}
      viewBox="0 0 160 40"
      className="block h-10 w-full min-w-0 text-accent"
      data-metric-trend=""
    >
      <title id={`${id}-title`}>{label}</title>
      <desc id={`${id}-values`}>{values.join(' → ')}</desc>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
