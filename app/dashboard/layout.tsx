import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
      {/* 데스크탑 사이드바 */}
      <Sidebar />
      
      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* 모바일 헤더 (추후 추가) */}
        <header className="md:hidden h-14 border-b flex items-center px-4 bg-card">
          <span className="font-bold text-lg text-primary">POIZON Autosell</span>
        </header>
        <main className="flex-1 overflow-auto p-1 md:p-2 lg:p-2">
          <div className="mx-auto w-full h-full max-w-[none]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
