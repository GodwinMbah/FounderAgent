"use client";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: DataPoint[];
  maxValue?: number;
  height?: number;
  showLabels?: boolean;
}

export function SimpleBarChart({ data, maxValue, height = 160, showLabels = true }: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value));
  const barWidth = data.length > 0 ? Math.min(48, 100 / data.length) : 0;
  const gap = 8;

  return (
    <div className="w-full" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${data.length * 56} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 24);
          const x = i * 56 + gap;
          const y = height - barHeight - 16;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={40}
                height={barHeight}
                rx={4}
                fill={d.color || "var(--accent)"}
                opacity={0.85}
              />
              {showLabels && (
                <text
                  x={x + 20}
                  y={height - 4}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize="10"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface SimpleLineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  showArea?: boolean;
}

export function SimpleLineChart({ data, color = "var(--accent)", height = 160, showArea = true }: SimpleLineChartProps) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const padding = 16;
  const chartWidth = data.length > 1 ? (data.length - 1) * 60 : 100;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = i * 60 + padding;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const areaPoints = `${padding},${height - padding} ${points.join(" ")} ${chartWidth + padding},${height - padding}`;

  return (
    <div className="w-full" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth + padding * 2} ${height}`} preserveAspectRatio="none">
        {showArea && (
          <polygon points={areaPoints} fill={color} opacity={0.1} />
        )}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const x = i * 60 + padding;
          const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="var(--background)" stroke={color} strokeWidth={2} />
              <text x={x} y={height - 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface SimpleDonutProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function SimpleDonut({ segments, size = 160, centerLabel, centerValue }: SimpleDonutProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offsets = segments.reduce<number[]>((acc, seg, i) => {
    const prev = i === 0 ? 0 : acc[i - 1] + (segments[i - 1].value / total) * circumference;
    acc.push(prev);
    return acc;
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={14}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsets[i]}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })},
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-bold text-[var(--foreground)]">{centerValue}</span>}
          {centerLabel && <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
