"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";

export function UploadDropzone({ onDrop }: { onDrop?: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDrop?.(Array.from(e.dataTransfer.files));
      }
    },
    [onDrop]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
        isDragging
          ? "border-[var(--accent)] bg-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.02]"
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
        <Upload className="h-6 w-6 text-[var(--accent)]" />
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
        Drag & drop files here, or{" "}
        <span className="text-[var(--accent)] underline underline-offset-2">browse</span>
      </p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        PDF, CSV, OFX, QFX up to 20MB
      </p>
    </div>
  );
}
