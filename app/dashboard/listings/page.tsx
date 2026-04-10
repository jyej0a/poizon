import { ListingsBoard } from "@/components/dashboard/listings-board";

export default function ListingsPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">입찰 관리</h1>
          <p className="text-muted-foreground mt-1">
            내 입찰 현황을 조회하고, 가격 수정 및 취소를 관리합니다.
          </p>
        </div>
      </div>

      <ListingsBoard />
    </div>
  );
}
