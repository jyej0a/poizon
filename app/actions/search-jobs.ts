"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getPoizonClient } from "@/app/actions/poizon";
import { isActedSpu, loadExclusionContext } from "@/lib/search/exclusion";
import { fetchPricesForItems } from "@/lib/search/item-prices";
import * as jobStore from "@/lib/search/job-store";
import { getChildSkuIds, toStoredSearchItem, type SearchItem } from "@/lib/search/search-item";
import type {
  SearchJob,
  SearchJobItemRecord,
  SearchJobOptions,
  SearchJobPurpose,
  SearchJobType,
} from "@/types/search-job";
import { DISCOVERY_DEFAULT_MIN_SALES_VOLUME, SEARCH_JOB_MAX_ITEMS } from "@/types/search-job";
import { normalizeBulkArticles } from "@/lib/search/bulk-excel";

export interface EnqueueSearchJobInput {
  type: SearchJobType;
  keyword: string;
  options?: SearchJobOptions;
}

/**
 * 검색을 큐에 등록하고 즉시 반환한다. 실제 수집은 워커가 수행하므로
 * 사용자가 화면을 닫아도 진행된다.
 */
export async function enqueueSearchJob(
  input: EnqueueSearchJobInput
): Promise<{ success: boolean; data?: SearchJob; error?: string }> {
  try {
    const keyword = input.keyword.trim();
    if (!keyword) return { success: false, error: "검색어를 입력해 주세요." };

    const { supabase, userId } = await getCurrentUserId();
    const job = await jobStore.createJob(supabase, userId, {
      type: input.type,
      keyword,
      options: input.options ?? {},
    });

    return { success: true, data: job };
  } catch (error: any) {
    console.error("[enqueueSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export interface EnqueueDiscoveryJobInput {
  keyword: string;
  minNetProfit: number;
  minSalesVolume?: number;
}

/** 아이템 발굴 잡. 브랜드 스캔 + 적재 직전 수익 필터. */
export async function enqueueDiscoveryJob(
  input: EnqueueDiscoveryJobInput
): Promise<{ success: boolean; data?: SearchJob; error?: string }> {
  try {
    const keyword = input.keyword.trim();
    if (!keyword) return { success: false, error: "브랜드명을 입력해 주세요." };

    const minNetProfit = Number(input.minNetProfit);
    if (!Number.isFinite(minNetProfit) || minNetProfit < 0) {
      return { success: false, error: "순수익 하한을 0원 이상으로 입력해 주세요." };
    }

    const minSalesVolume =
      input.minSalesVolume == null
        ? DISCOVERY_DEFAULT_MIN_SALES_VOLUME
        : Number(input.minSalesVolume);
    if (!Number.isFinite(minSalesVolume) || minSalesVolume < 0) {
      return { success: false, error: "판매량 하한을 0 이상으로 입력해 주세요." };
    }

    const { supabase, userId } = await getCurrentUserId();
    const job = await jobStore.createJob(supabase, userId, {
      type: "brand",
      keyword,
      options: {
        purpose: "discovery",
        minNetProfit,
        minSalesVolume,
      },
    });

    return { success: true, data: job };
  } catch (error: any) {
    console.error("[enqueueDiscoveryJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export interface EnqueueBulkArticleJobInput {
  articles: string[];
  fileName?: string;
}

/** 실데이터 판매 엑셀에서 뽑은 품번을 백그라운드 품번 잡으로 등록한다. */
export async function enqueueBulkArticleJob(
  input: EnqueueBulkArticleJobInput
): Promise<{ success: boolean; data?: SearchJob; error?: string }> {
  try {
    const { articles } = normalizeBulkArticles(input.articles ?? [], SEARCH_JOB_MAX_ITEMS);
    if (articles.length === 0) {
      return { success: false, error: "엑셀에서 품번을 찾지 못했습니다." };
    }

    const fileName = sanitizeBulkFileName(input.fileName);
    const { supabase, userId } = await getCurrentUserId();
    const job = await jobStore.createJob(supabase, userId, {
      type: "article",
      keyword: articles.join(","),
      options: {
        purpose: "bulk",
        maxItems: articles.length,
        sourceFileName: fileName,
        articleCount: articles.length,
      },
    });

    return { success: true, data: job };
  } catch (error: any) {
    console.error("[enqueueBulkArticleJob] Error:", error);
    return { success: false, error: error.message };
  }
}

function sanitizeBulkFileName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const base = raw.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!base) return undefined;
  return base.slice(0, 120);
}

export async function getSearchJobs(
  limit = 30,
  purpose: SearchJobPurpose = "search"
): Promise<{ success: boolean; data: SearchJob[]; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const jobs = await jobStore.listJobs(supabase, userId, limit, purpose);
    return { success: true, data: jobs };
  } catch (error: any) {
    console.error("[getSearchJobs] Error:", error);
    return { success: false, data: [], error: error.message };
  }
}

export async function getSearchJobDetail(jobId: string): Promise<{
  success: boolean;
  job?: SearchJob;
  items?: SearchJobItemRecord[];
  error?: string;
}> {
  try {
    const { supabase, userId } = await getCurrentUserId();

    const job = await jobStore.getJob(supabase, userId, jobId);
    if (!job) return { success: false, error: "잡을 찾을 수 없습니다." };

    const items = await jobStore.getJobItems(supabase, jobId);
    return { success: true, job, items };
  } catch (error: any) {
    console.error("[getSearchJobDetail] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function cancelSearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const cancelled = await jobStore.cancelJob(supabase, userId, jobId);
    if (!cancelled) return { success: false, error: "이미 종료된 잡입니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[cancelSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function retrySearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const requeued = await jobStore.retryJob(supabase, userId, jobId);
    if (!requeued) return { success: false, error: "잡을 찾을 수 없습니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[retrySearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteSearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const deleted = await jobStore.deleteJob(supabase, userId, jobId);
    if (!deleted) return { success: false, error: "잡을 찾을 수 없습니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[deleteSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getActedSearchJobItems(input: {
  type: SearchJobType;
  keyword: string;
}): Promise<{ success: boolean; items: SearchJobItemRecord[]; error?: string }> {
  try {
    const keyword = input.keyword.trim();
    if (!keyword) return { success: true, items: [] };

    const { supabase, userId } = await getCurrentUserId();
    const items = await jobStore.listJobItemsByKeyword(
      supabase,
      userId,
      input.type,
      keyword
    );
    const spuKeys = [...new Set(items.map((row) => row.spuId).filter(Boolean))];
    const ctx = await loadExclusionContext(
      supabase,
      userId,
      { excludeSkipped: true, excludeReviewed: true, excludeActed: true },
      spuKeys
    );
    const acted = items.filter((row) =>
      isActedSpu(row.spuId, getChildSkuIds(row.payload), ctx, row.articleNumber)
    );
    return { success: true, items: acted };
  } catch (error: any) {
    console.error("[getActedSearchJobItems] Error:", error);
    return { success: false, items: [], error: error.message };
  }
}

export async function refreshSearchItemPrices(input: {
  jobId?: string | null;
  items: SearchItem[];
}): Promise<{
  success: boolean;
  items?: SearchJobItemRecord[];
  error?: string;
}> {
  try {
    if (input.items.length === 0) {
      return { success: false, error: "선택한 품번이 없습니다." };
    }

    const { supabase, userId } = await getCurrentUserId();
    const poizon = await getPoizonClient();
    const enriched = await fetchPricesForItems(input.items, { supabase, poizon });
    const records: SearchJobItemRecord[] = enriched.map((entry, index) => ({
      spuId: String(entry.item.id),
      articleNumber: entry.item.articleNumber ?? null,
      title: entry.item.title ?? null,
      brand: entry.item.brand ?? null,
      payload: {
        ...toStoredSearchItem(entry.item),
        sourceOffers: entry.sourceOffers,
        skuRecommendations: entry.skuRecommendations,
      },
      offerStatus: entry.offerStatus,
      sortOrder: index,
    }));

    if (input.jobId) {
      const job = await jobStore.getJob(supabase, userId, input.jobId);
      if (job) {
        await jobStore.updateJobItemPayloads(
          supabase,
          input.jobId,
          records.map((row) => ({
            spuId: row.spuId,
            payload: row.payload,
            offerStatus: row.offerStatus,
          }))
        );
      }
    }

    return { success: true, items: records };
  } catch (error: any) {
    console.error("[refreshSearchItemPrices] Error:", error);
    return { success: false, error: error.message };
  }
}
