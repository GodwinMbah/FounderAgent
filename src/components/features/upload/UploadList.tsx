"use client";

import { FileText, CheckCircle, AlertCircle } from "lucide-react";

interface UploadFile {
  name: string;
  size: string;
  status: "uploading" | "done" | "error";
}

export function UploadList({ files }: { files: UploadFile[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="font-semibold text-[var(--foreground)]">Recent Uploads</h2>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{file.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{file.size}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {file.status === "done" && (
                <>
                  <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  <span className="text-xs font-medium text-[var(--success)]">Processed</span>
                </>
              )}
              {file.status === "uploading" && (
                <span className="text-xs font-medium text-[var(--warning)]">Uploading…</span>
              )}
              {file.status === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
                  <span className="text-xs font-medium text-[var(--danger)]">Failed</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
