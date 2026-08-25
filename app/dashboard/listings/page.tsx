import { ListingsBoard } from "@/components/dashboard/listings-board";

export default function ListingsPage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">입찰 관리</h1>
        <p className="text-muted-foreground mt-1">
          실데이터 입찰을 조회하고, 가격 수정·취소·CSV 내보내기를 합니다.
        </p>
      </header>
      <ListingsBoard />
    </div>
  );
}
