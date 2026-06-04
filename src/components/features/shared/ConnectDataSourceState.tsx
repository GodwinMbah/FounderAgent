import Link from "next/link";
import { Landmark } from "lucide-react";

interface ConnectDataSourceStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ConnectDataSourceState({
  title = "Connect your bank account or upload a statement to begin.",
  description = "Connected bank data is the primary path. Statement upload remains available for historical imports, unsupported banks, and manual fallback.",
  className = "",
}: ConnectDataSourceStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/70 px-6 py-12 text-center ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]">
        <Landmark className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-[var(--foreground)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/upload-centre?focus=bank"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/90"
        >
          Connect Bank Account
        </Link>
        <Link
          href="/upload-centre?focus=upload"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40"
        >
          Upload Statement
        </Link>
      </div>
    </div>
  );
}
