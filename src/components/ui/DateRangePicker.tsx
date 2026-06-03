"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import {
  type DateRangePreset,
  DATE_RANGE_PRESETS,
  getDateRange,
} from "@/lib/date-range";

export interface DateRangePickerProps {
  value: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
  preset?: DateRangePreset;
  onPresetChange?: (preset: DateRangePreset) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function DateRangePicker({
  value,
  onChange,
  preset: controlledPreset,
  onPresetChange,
  open: controlledOpen,
  onOpenChange,
}: DateRangePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const toggleOpen = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const close = useCallback(() => {
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
  }, [isControlled, onOpenChange]);

  const [internalPreset, setInternalPreset] = useState<DateRangePreset>(
    controlledPreset ?? "last30"
  );
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activePreset = controlledPreset ?? internalPreset;

  const result = getDateRange(activePreset, customFrom, customTo);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [close, open]);

  function handlePresetClick(p: DateRangePreset) {
    if (onPresetChange) {
      onPresetChange(p);
    } else {
      setInternalPreset(p);
    }
    const r = getDateRange(p, customFrom, customTo);
    onChange({ from: r.from, to: r.to });
    if (p !== "custom") {
      close();
    }
  }

  function handleCustomApply() {
    const r = getDateRange("custom", customFrom, customTo);
    if (onPresetChange) {
      onPresetChange("custom");
    } else {
      setInternalPreset("custom");
    }
    onChange({ from: r.from, to: r.to });
    close();
  }

  const displayLabel =
    activePreset === "custom"
      ? result.label
      : DATE_RANGE_PRESETS.find((p) => p.value === activePreset)?.label ??
        result.label;

  const popup = (
    <div
      ref={popoverRef}
      className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:rounded-xl sm:border sm:border-[var(--border)]"
    >
      {/* Mobile backdrop */}
      <div
        className="absolute inset-0 -z-10 bg-black/60 sm:hidden"
        onClick={close}
      />

      <div className="rounded-t-xl border border-[var(--border)] bg-[#0f172a] p-4 shadow-2xl sm:rounded-xl sm:bg-[var(--popover)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Date Range
          </span>
          <button
            onClick={close}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets grid */}
        <div className="grid grid-cols-3 gap-2">
          {DATE_RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePresetClick(p.value)}
              className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                activePreset === p.value
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <span className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
            Custom range
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]/50 [color-scheme:dark]"
            />
            <span className="text-xs text-[var(--muted-foreground)]">
              →
            </span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]/50 [color-scheme:dark]"
            />
          </div>
          <button
            onClick={handleCustomApply}
            className="mt-3 w-full rounded-md bg-[var(--accent)]/10 px-3 py-2 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
          >
            Apply Custom Range
          </button>
        </div>
      </div>
    </div>
  );

  if (isControlled) {
    return open ? popup : null;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleOpen}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/50"
      >
        <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="hidden sm:inline">{displayLabel}</span>
        <span className="sm:hidden">
          {activePreset === "custom"
            ? "Custom"
            : DATE_RANGE_PRESETS.find((p) => p.value === activePreset)
                ?.label ?? "Range"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && popup}
    </div>
  );
}
