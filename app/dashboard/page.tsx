import { SearchBoard } from "@/components/dashboard/search-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 헤더 섹션 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Poizon Bidding</h1>
          <p className="text-muted-foreground mt-1">
            Analyze items and execute automated bids based on Naver lowest prices.
          </p>
        </div>
      </div>

      <SearchBoard />
    </div>
  );
}
