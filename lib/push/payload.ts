import type { SearchJobPushPayload, SearchJobPushStatus, WebPushPayload } from "@/types/push";
import { jobListPath, jobPurpose, type SearchJobPurpose } from "@/types/search-job";

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
  purpose?: SearchJobPurpose;
}): SearchJobPushPayload {
  const purpose = jobPurpose({ purpose: job.purpose });
  const titles: Record<SearchJobPushStatus, string> = {
    done: purpose === "discovery" ? "발굴 완료" : purpose === "bulk" ? "대량 조회 완료" : "검색 완료",
    partial: purpose === "discovery" ? "발굴 부분 완료" : purpose === "bulk" ? "대량 조회 부분 완료" : "검색 부분 완료",
    failed: purpose === "discovery" ? "발굴 실패" : purpose === "bulk" ? "대량 조회 실패" : "검색 실패",
  };

  const listPath = jobListPath(purpose);
  const url = job.itemCount > 0 ? `${listPath}/${job.id}` : listPath;
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
