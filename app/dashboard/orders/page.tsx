import { OrdersBoard } from "@/components/dashboard/orders-board";

export default function OrdersPage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">주문 관리</h1>
        <p className="text-muted-foreground mt-1">
          입찰이 체결된 주문을 조회하고, 발송 대기 건은 송장을 등록합니다.
        </p>
      </header>
      <OrdersBoard />
    </div>
  );
}
