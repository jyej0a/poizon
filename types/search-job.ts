import type { SearchItem } from "@/lib/search/search-item";
import type { SourceOffer, SourceOfferStatus } from "@/types/source-offer";

/**
 * 적재되는 검색 결과 1건.
 * 외부 소싱 오퍼를 함께 담아 결과 조회 시 추가 API 호출이 필요 없다.
 */
export type SearchJobItemPayload = SearchItem & {
  sourceOffers?: SourceOffer[];
};

export type SearchJobType = "article" | "brand";

export type SearchJobStatus =
  | "queued"
  | "running"
  | "done"
  | "partial"
  | "failed"
  | "cancelled";

/** 진행 중으로 간주하는 상태 (폴링 지속 판단에 사용) */
export const ACTIVE_JOB_STATUSES: SearchJobStatus[] = ["queued", "running"];

export type SourceOfferItemStatus = SourceOfferStatus;

export interface SearchJobOptions {
  /** 브랜드 검색 1페이지당 건수 */
  pageSize?: number;
  /** 모든 옵션이 스킵된 품번 제외 */
  excludeSkipped?: boolean;
  /** 검토완료된 품번 제외 */
  excludeReviewed?: boolean;
  /** 브랜드 검색 시 조회할 API 페이지 (이어서 탐색) */
  brandPage?: number;
  /** 이미 알고 있는 브랜드 ID (재조회 생략) */
  brandId?: number | string | null;
}

export interface SearchJob {
  id: string;
  type: SearchJobType;
  keyword: string;
  options: SearchJobOptions;
  status: SearchJobStatus;
  stage: string | null;
  progressTotal: number;
  progressDone: number;
  itemCount: number;
  excludedCount: number;
  error: string | null;
  warnings: string[];
  retryCount: number;
  maxRetries: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchJobItemRecord {
  spuId: string;
  articleNumber: string | null;
  title: string | null;
  brand: string | null;
  payload: SearchJobItemPayload;
  offerStatus: SourceOfferItemStatus;
  sortOrder: number;
}

export const JOB_STATUS_LABEL: Record<SearchJobStatus, string> = {
  queued: "대기 중",
  running: "진행 중",
  done: "완료",
  partial: "부분 완료",
  failed: "실패",
  cancelled: "취소됨",
};

export function isJobActive(status: SearchJobStatus): boolean {
  return status === "queued" || status === "running";
}

/** 결과를 열어볼 수 있는 상태인지 */
export function hasJobResults(job: Pick<SearchJob, "status" | "itemCount">): boolean {
  return job.itemCount > 0 && (job.status === "done" || job.status === "partial");
}
