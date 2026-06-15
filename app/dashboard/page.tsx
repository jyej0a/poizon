import { SearchBoard } from "@/components/dashboard/search-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="shrink-0 space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">Poizon Bidding</h1>
        <p className="text-sm text-muted-foreground">
          Analyze items and execute automated bids based on Naver lowest prices.
        </p>
      </header>

      <SearchBoard />
    </div>
  );
}
