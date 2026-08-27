import { SearchBoard } from "@/components/dashboard/search-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <header className="shrink-0 space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <p className="text-sm text-muted-foreground">
          품번·브랜드로 조회하고, 원가 오퍼와 비교해 입찰합니다. 화면을 나가면 조회는 중단되고, 대량은 백그라운드 작업으로 이어집니다.
        </p>
      </header>
      <SearchBoard variant="live" />
    </div>
  );
}
