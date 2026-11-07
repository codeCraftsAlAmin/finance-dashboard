"use client";

import { addMonths, monthLabel } from "@/lib/format";
import type { MonthKey } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export function MonthSwitcher({
  month,
  current,
  onChange,
}: {
  month: MonthKey;
  current: MonthKey;
  onChange: (month: MonthKey) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Month">
      <button type="button" className="btn btn-sm btn-icon" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        <ChevronLeftIcon />
      </button>
      <span className="min-w-32 text-center font-display text-lg font-semibold" aria-live="polite">
        {monthLabel(month, true)}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-icon"
        aria-label="Next month"
        disabled={month >= current}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRightIcon />
      </button>
      {month !== current && (
        <button type="button" className="btn btn-sm btn-ghost underline underline-offset-4" onClick={() => onChange(current)}>
          This month
        </button>
      )}
    </div>
  );
}
