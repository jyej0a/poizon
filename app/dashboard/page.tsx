import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { SearchBoard } from "@/components/dashboard/search-board";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full gap-4 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="shrink-0 space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <p className="text-sm text-muted-foreground">
          품번·브랜드로 조회하고, 원가 오퍼와 비교해 입찰합니다.
        </p>
      </header>

      {/* SearchBoard가 `?job=` 파라미터를 읽으므로 Suspense 경계가 필요하다 */}
      <Suspense
        fallback={
          <div className="flex-1 grid place-items-center">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        }
      >
        <SearchBoard />
      </Suspense>
    </div>
  );
}
