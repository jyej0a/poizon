"use client";

interface DashboardViewTabsProps {
  showOnlyProfitable: boolean;
  showOnlyUnprocessed: boolean;
  onChange: (next: { profitable: boolean; unprocessed: boolean }) => void;
}

export function DashboardViewTabs({
  showOnlyProfitable,
  showOnlyUnprocessed,
  onChange,
}: DashboardViewTabsProps) {
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/60 bg-background p-0.5">
      <button
        type="button"
        onClick={() => onChange({ profitable: false, unprocessed: false })}
        className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${
          !showOnlyProfitable && !showOnlyUnprocessed
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        전체
      </button>
      <button
        type="button"
        onClick={() => onChange({ profitable: true, unprocessed: false })}
        className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${
          showOnlyProfitable && !showOnlyUnprocessed
            ? "bg-blue-500/10 text-blue-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        수익 상품
      </button>
      <button
        type="button"
        onClick={() => onChange({ profitable: false, unprocessed: true })}
        className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${
          !showOnlyProfitable && showOnlyUnprocessed
            ? "bg-emerald-500/10 text-emerald-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        미처리
      </button>
      <button
        type="button"
        onClick={() => onChange({ profitable: true, unprocessed: true })}
        className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${
          showOnlyProfitable && showOnlyUnprocessed
            ? "bg-violet-500/10 text-violet-600"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        수익+미처리
      </button>
    </div>
  );
}
