"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 구 북마크 `/dashboard?job=` · `/dashboard/jobs?job=` 를 잡 결과 경로로 보낸다.
 */
export function LegacyJobRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const legacyJob = searchParams.get("job");
    if (!legacyJob) return;
    if (pathname === "/dashboard" || pathname === "/dashboard/jobs") {
      router.replace(`/dashboard/jobs/${encodeURIComponent(legacyJob)}`);
    }
  }, [pathname, searchParams, router]);

  return null;
}
