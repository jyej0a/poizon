export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="shrink-0 space-y-2">
        <div className="h-8 w-36 rounded-md bg-secondary/70 animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded-md bg-secondary/40 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 glass-panel border border-border/60 rounded-xl overflow-hidden">
        <div className="h-14 border-b border-border/40 bg-secondary/20 animate-pulse" />
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-12 rounded-md bg-secondary/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
