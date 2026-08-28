import type { RecommendBidPriceData } from "@/types/recommend-bid-price";
import type { SearchItem } from "@/lib/search/search-item";
import type { SourceOffer, SourceOfferStatus } from "@/types/source-offer";

/** 한 잡에서 적재하는 손 안 댄 품번 상한 */
export const SEARCH_JOB_MAX_ITEMS = 500;

/** 브랜드 API 페이지 크기. POIZON 거부를 피하려면 50 이하 */
export const SEARCH_JOB_BRAND_PAGE_SIZE = 50;

/** 품번 잡 1청크당 조회 건수. 한 번에 500개를 치면 진행률이 안 움직이고 중단 시 처음부터 반복한다 */
export const SEARCH_JOB_ARTICLE_CHUNK_SIZE = 20;

export function articleTermsFromKeyword(
  keyword: string,
  maxItems = SEARCH_JOB_MAX_ITEMS
): string[] {
  return keyword
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, maxItems);
}

/**
 * 적재되는 검색 결과 1건.
 * 원가 오퍼·노출가를 함께 담아 결과 조회 시 추가 API 호출이 필요 없다.
 */
export type SearchJobItemPayload = SearchItem & {
  sourceOffers?: SourceOffer[];
  skuRecommendations?: Record<string, RecommendBidPriceData>;
};

export type SearchJobType = "article" | "brand";

/** 검색 작업대 vs 엑셀 대량 vs 수익 후보 발굴. 없으면 search */
export type SearchJobPurpose = "search" | "bulk" | "discovery";

export const DISCOVERY_DEFAULT_MIN_SALES_VOLUME = 1;

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
  /** 브랜드 검색 1페이지당 건수 (연속 수집은 50 고정) */
  pageSize?: number;
  /** 모든 옵션이 스킵된 품번 제외 (화면 조회용) */
  excludeSkipped?: boolean;
  /** 검토완료된 품번 제외 (화면 조회용) */
  excludeReviewed?: boolean;
  /** 다음에 조회할 브랜드 API 페이지 */
  brandPage?: number;
  /** 이미 알고 있는 브랜드 ID (재조회 생략) */
  brandId?: number | string | null;
  /** 브랜드 전체 건수 (결과 보기 복원용) */
  brandTotal?: number | null;
  /** 적재 상한. 기본 500 */
  maxItems?: number;
  /** 없으면 search. bulk·discovery 잡은 검색 작업 목록에서 제외 */
  purpose?: SearchJobPurpose;
  /** 발굴: 옵션 순수익 하한(원). 하나라도 이상이면 품번 적재 */
  minNetProfit?: number;
  /** 발굴: 중국 30일 판매량 하한. 기본 1, 0이면 끔 */
  minSalesVolume?: number;
  /** 품번 잡: 다음에 조회할 키워드 인덱스 */
  articleOffset?: number;
  /** 대량 조회: 올린 엑셀 파일명 */
  sourceFileName?: string;
  /** 대량 조회: 유니크 품번 수 */
  articleCount?: number;
}

export function jobPurpose(options: SearchJobOptions | null | undefined): SearchJobPurpose {
  if (options?.purpose === "discovery") return "discovery";
  if (options?.purpose === "bulk") return "bulk";
  return "search";
}

export function jobResultPath(job: Pick<SearchJob, "id" | "options">): string {
  const purpose = jobPurpose(job.options);
  if (purpose === "discovery") return `/dashboard/discover/${job.id}`;
  if (purpose === "bulk") return `/dashboard/bulk/${job.id}`;
  return `/dashboard/jobs/${job.id}`;
}

export function jobListPath(purpose: SearchJobPurpose): string {
  if (purpose === "discovery") return "/dashboard/discover";
  if (purpose === "bulk") return "/dashboard/bulk";
  return "/dashboard/jobs";
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

/** 워커가 안 집어가면 대기에 멈춘 것으로 본다 */
export const UNCLAIMED_QUEUE_MS = 45_000;

/** 큐에 올라온 지 오래됐는데 아직 running으로 안 바뀐 잡 */
export function isQueuedUnclaimed(
  job: Pick<SearchJob, "status" | "updatedAt" | "createdAt">,
  now = Date.now(),
  staleMs = UNCLAIMED_QUEUE_MS
): boolean {
  if (job.status !== "queued") return false;
  const t = new Date(job.updatedAt || job.createdAt).getTime();
  return Number.isFinite(t) && now - t >= staleMs;
}

/** 결과를 열어볼 수 있는 상태인지. 진행 중이어도 적재된 건이 있으면 가능 */
export function hasJobResults(job: Pick<SearchJob, "status" | "itemCount">): boolean {
  if (job.itemCount <= 0) return false;
  return (
    job.status === "done" ||
    job.status === "partial" ||
    job.status === "running" ||
    job.status === "queued"
  );
}
