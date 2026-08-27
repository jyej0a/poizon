import { Sidebar } from "@/components/Sidebar";
import { SearchJobsProvider } from "@/components/providers/search-jobs-provider";
import { LegacyJobRedirect } from "@/components/dashboard/legacy-job-redirect";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SearchJobsProvider>
      <div className="relative flex h-screen w-full overflow-hidden selection:bg-primary/20 bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,oklch(0.68_0.15_190/0.12),transparent_42%),radial-gradient(ellipse_at_100%_100%,oklch(0.72_0.08_230/0.07),transparent_48%)]"
        />
        <Sidebar />

        <div className="relative z-[1] flex-1 flex flex-col h-full overflow-hidden">
          <header className="md:hidden h-14 border-b flex items-center px-4 glass-panel">
            <span className="font-bold text-lg text-primary">POIZON Autosell</span>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-5">
            <div className="mx-auto w-full h-full max-w-[none]">
              <Suspense fallback={null}>
                <LegacyJobRedirect />
              </Suspense>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SearchJobsProvider>
  );
}
