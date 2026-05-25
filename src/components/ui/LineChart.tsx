"use client";

interface LineChartProps {
  data: { label: string; actual: number; forecast?: number }[];
  width?: number;
  height?: number;
}

export function LineChart({ data, width = 500, height = 160 }: LineChartProps) {
  const padding = { top: 10, right: 10, bottom: 24, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = data.flatMap((d) => [d.actual, d.forecast ?? d.actual]);
  const min = Math.min(...allValues) * 0.9;
  const max = Math.max(...allValues) * 1.1;
  const range = max - min || 1;

  const xFor = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const yFor = (v: number) => padding.top + chartH - ((v - min) / range) * chartH;

  const actualPoints = data.map((d, i) => `${xFor(i)},${yFor(d.actual)}`).join(" ");
  const forecastPoints = data
    .filter((d) => d.forecast !== undefined)
    .map((d, i) => `${xFor(i)},${yFor(d.forecast!)}`)
    .join(" ");

  // Y-axis labels
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(min + (range * i) / yTicks)
  );

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {yLabels.map((val, i) => {
        const y = yFor(val);
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize={10}>
              ${(val / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => (
        <text
          key={d.label}
          x={xFor(i)}
          y={height - 4}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize={10}
        >
          {d.label}
        </text>
      ))}

      {/* Forecast area */}
      {data.some((d) => d.forecast !== undefined) && (
        <>
          <path
            d={`M${forecastPoints.split(" ")[0]} ${forecastPoints.split(" ").slice(1).map((p) => `L${p}`).join(" ")}`}
            fill="none"
            stroke="var(--soft-lilac)"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Actual line */}
      <path
        d={`M${actualPoints.split(" ")[0]} ${actualPoints.split(" ").slice(1).map((p) => `L${p}`).join(" ")}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(d.actual)} r={3} fill="var(--accent)" />
      ))}
    </svg>
  );
}
