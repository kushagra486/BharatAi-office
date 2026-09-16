export interface TokenSparklineProps {
  data: number[];
}

const WIDTH = 168;
const HEIGHT = 28;

/** A minimal live line graph — no chart library, just an SVG polyline redrawn as new samples arrive (useTokenHistory). */
export function TokenSparkline({ data }: TokenSparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = Math.max(max - min, 1);

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * WIDTH;
    const y = HEIGHT - ((v - min) / range) * (HEIGHT - 6) - 3;
    return [x, y] as const;
  });
  const [lastX, lastY] = points[points.length - 1];
  const areaPath = `M0,${HEIGHT} L${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${WIDTH},${HEIGHT} Z`;

  return (
    <svg width={WIDTH} height={HEIGHT} className="overflow-visible" role="img" aria-label="Live token usage trend">
      <path d={areaPath} fill="url(#token-spark-fill)" opacity={0.35} />
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="#2FE6D2"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="#2FE6D2" className="animate-glow-pulse text-cyan" />
      <defs>
        <linearGradient id="token-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2FE6D2" />
          <stop offset="100%" stopColor="#2FE6D2" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}
