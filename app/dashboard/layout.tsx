import { Sidebar } from "@/components/Sidebar";
import { SearchJobsProvider } from "@/components/providers/search-jobs-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SearchJobsProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
        {/* 데스크탑 사이드바 */}
        <Sidebar />

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
          {/* 모바일 헤더 (추후 추가) */}
          <header className="md:hidden h-14 border-b flex items-center px-4 bg-card">
            <span className="font-bold text-lg text-primary">POIZON Autosell</span>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-5 bg-muted/20">
            <div className="mx-auto w-full h-full max-w-[none]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SearchJobsProvider>
  );
}
