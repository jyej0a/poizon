import type { SearchJobPushPayload, SearchJobPushStatus, WebPushPayload } from "@/types/push";

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildSearchJobPushPayload(job: {
  id: string;
  keyword: string;
  itemCount: number;
  status: SearchJobPushStatus;
  error?: string | null;
}): SearchJobPushPayload {
  const titles: Record<SearchJobPushStatus, string> = {
    done: "검색 완료",
    partial: "검색 부분 완료",
    failed: "검색 실패",
  };

  const url = job.itemCount > 0 ? `/dashboard?job=${job.id}` : "/dashboard/jobs";
  const body =
    job.status === "failed"
      ? `${job.keyword} · ${truncate(job.error || "수집에 실패했습니다.")}`
      : `${job.keyword} · ${job.itemCount.toLocaleString("ko-KR")}건 적재`;

  return {
    title: titles[job.status],
    body,
    url,
    jobId: job.id,
    status: job.status,
  };
}

export function buildPriceWatchPushPayload(hit: {
  skuId: string | number;
  watchPrice: number;
  exposure: number;
}): WebPushPayload {
  const sku = String(hit.skuId);
  return {
    title: "가격 알림 도달",
    body: `SKU ${sku} · 노출 ₩${hit.exposure.toLocaleString("ko-KR")} ≤ 목표 ₩${hit.watchPrice.toLocaleString("ko-KR")}`,
    url: "/dashboard",
  };
}
