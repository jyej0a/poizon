import { RevenueBoard } from "@/components/dashboard/revenue-board";

export default function RevenuePage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">수익 현황</h1>
        <p className="text-muted-foreground mt-1">
          체결 주문의 매출과 수수료를 기간으로 집계합니다. 건별 처리는 주문 관리에서 합니다.
        </p>
      </header>
      <RevenueBoard />
    </div>
  );
}
