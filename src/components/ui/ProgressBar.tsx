interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "accent" | "success" | "warning" | "danger" | "neon-cyan";
  size?: "sm" | "md";
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "accent",
  size = "md",
  showLabel = false,
  label,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const height = size === "sm" ? "h-1.5" : "h-2";
  const colorMap: Record<string, string> = {
    accent: "bg-[var(--accent)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--danger)]",
    "neon-cyan": "bg-[var(--neon-cyan)]",
  };

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-[var(--muted-foreground)]">{label}</span>}
          {showLabel && <span className="font-medium text-[var(--foreground)]">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-[var(--muted)] ${height}`}>
        <div
          className={`${height} rounded-full ${colorMap[color]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
