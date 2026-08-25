"use client";

import { CONTROL_PRESS } from "@/lib/utils/motion";

export type WorkspaceView = "hierarchy" | "sku" | "profitable";

export type DisplayFilter = "all" | "unprocessed" | "hideSkipped" | "hideReviewed";

const VIEW_OPTIONS: { id: WorkspaceView; label: string }[] = [
  { id: "hierarchy", label: "품번" },
  { id: "sku", label: "옵션" },
  { id: "profitable", label: "수익 옵션" },
];

const DISPLAY_OPTIONS: { id: DisplayFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unprocessed", label: "미처리" },
  { id: "hideSkipped", label: "스킵 숨김" },
  { id: "hideReviewed", label: "검토 숨김" },
];

interface DashboardViewTabsProps {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}

export function DashboardViewTabs({ view, onViewChange }: DashboardViewTabsProps) {
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/60 bg-background p-0.5">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onViewChange(opt.id)}
          className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${CONTROL_PRESS} ${
            view === opt.id
              ? opt.id === "profitable"
                ? "bg-blue-500/10 text-blue-600"
                : "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface DisplayFilterSelectProps {
  value: DisplayFilter;
  onChange: (value: DisplayFilter) => void;
  className?: string;
}

export function DisplayFilterSelect({ value, onChange, className }: DisplayFilterSelectProps) {
  return (
    <div className={`flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 ${className ?? ""}`}>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">표시</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DisplayFilter)}
        className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
        aria-label="목록 표시 필터"
      >
        {DISPLAY_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
