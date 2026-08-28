/**
 * 백그라운드 검색 잡의 실제 수집 파이프라인 (서버 전용).
 *
 * 브랜드는 API 페이지 단위, 품번은 20건씩 한 청크를 처리한다. 워커가
 * 청크를 넘기며 손 안 댄 품번을 최대 500개까지 적재한다.
 *
 * 단계: 상품 조회 → 통계(KR/CN) → 아이템 변환 → 손댄 품번 제외 → 원가 오퍼·노출가
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoizonClient } from "@/lib/api/poizon";
import {
  fetchBrandSpus,
  fetchItemByArticleNumber,
  fetchSpuStatistics,
} from "@/lib/api/poizon-search";
import { mapWithConcurrency } from "@/lib/api/retry";
import { fetchPricesForItems, type EnrichedSearchItem } from "@/lib/search/item-prices";
import { stripTrailingHan } from "@/lib/search/bulk-excel";
import { discoveryKeepCriteria, shouldKeepDiscoveryItem } from "@/lib/search/discovery-keep";
import { loadSystemSettings } from "@/lib/search/system-settings";
import {
  applyStatsToItemData,
  buildSearchItem,
  buildStatsMaps,
  extractBrandResultsFromResponse,
  getSpuKeyFromItem,
  type SearchItem,
} from "@/lib/search/search-item";
import { filterItems, loadExclusionContext } from "@/lib/search/exclusion";
import { getCachedSpuStats, setCachedSpuStats } from "@/lib/search/search-cache";
import {
  SEARCH_JOB_ARTICLE_CHUNK_SIZE,
  SEARCH_JOB_BRAND_PAGE_SIZE,
  SEARCH_JOB_MAX_ITEMS,
  articleTermsFromKeyword,
  jobPurpose,
  type SearchJobOptions,
  type SearchJobType,
} from "@/types/search-job";

const ARTICLE_CONCURRENCY = 5;

export interface SearchJobSpec {
  id: string;
  type: SearchJobType;
  keyword: string;
  options: SearchJobOptions;
}

export interface ProgressUpdate {
  stage?: string;
  progressTotal?: number;
  progressDone?: number;
}

export interface RunSearchJobDeps {
  supabase: SupabaseClient;
  poizon: PoizonClient;
  userId: string;
  onProgress?: (update: ProgressUpdate) => Promise<void> | void;
  onWarning?: (message: string) => void;
  /** 이미 적재된 건수. 500 상한 계산에 사용 */
  alreadyKept?: number;
}

export type { EnrichedSearchItem };

export interface SearchJobChunkOutcome {
  items: EnrichedSearchItem[];
  excludedCount: number;
  warnings: string[];
  brandTotal: number | null;
  brandId: number | string | null;
  /** 다음에 칠 브랜드 페이지. 카탈로그가 끝났으면 현재 페이지 */
  nextBrandPage: number;
  /** 품번 잡: 다음에 조회할 키워드 인덱스 */
  nextArticleOffset: number;
  /** 더 가져올 페이지가 없음 (빈 페이지 또는 품번 검색 완료) */
  catalogEnded: boolean;
}

function createWarningCollector(onWarning?: (message: string) => void) {
  const groups = new Map<string, { count: number; samples: string[] }>();

  return {
    add(reason: string, target?: string) {
      const group = groups.get(reason) ?? { count: 0, samples: [] };
      group.count += 1;
      if (target && group.samples.length < 3) group.samples.push(target);
      groups.set(reason, group);
      if (group.count === 1) onWarning?.(target ? `${reason} (${target})` : reason);
    },
    summarize(): string[] {
      return [...groups.entries()].map(([reason, group]) => {
        if (group.count === 1) {
          return group.samples[0] ? `${reason} (${group.samples[0]})` : reason;
        }
        const samples = group.samples.length > 0 ? ` — 예: ${group.samples.join(", ")}` : "";
        return `${reason} · ${group.count}건${samples}`;
      });
    },
  };
}

async function applyStatistics(
  specId: string,
  supabase: SupabaseClient,
  poizon: PoizonClient,
  rawEntries: Array<{ data: any; term: string }>,
  warnings: ReturnType<typeof createWarningCollector>,
  reporter: { onRetry: (context: string, error: unknown, attempt: number) => void }
) {
  const spuIdsForStats = rawEntries
    .map((entry) => Number(entry.data.spuInfo?.spuId || entry.data.spuId || entry.data.goodsId))
    .filter((id) => !!id && !Number.isNaN(id));

  if (spuIdsForStats.length === 0) return;

  const [{ hits: cachedStatsKR, missing: missingKR }, { hits: cachedStatsCN, missing: missingCN }] =
    await Promise.all([
      getCachedSpuStats(supabase, spuIdsForStats, "KR"),
      getCachedSpuStats(supabase, spuIdsForStats, "CN"),
    ]);

  const [fetchedStatsKR, fetchedStatsCN] = await Promise.all([
    missingKR.length > 0
      ? fetchSpuStatistics(poizon, missingKR, ["KR"], {
          reporter,
          onChunkError: (context, error) =>
            warnings.add(`${context}: ${error instanceof Error ? error.message : String(error)}`),
        }).catch((error) => {
          warnings.add(`KR 통계 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
          return {} as Record<string, any[]>;
        })
      : Promise.resolve({} as Record<string, any[]>),
    missingCN.length > 0
      ? fetchSpuStatistics(poizon, missingCN, ["CN"], {
          reporter,
          onChunkError: () => {},
        }).catch(() => {
          return {} as Record<string, any[]>;
        })
      : Promise.resolve({} as Record<string, any[]>),
  ]);

  await Promise.all([
    setCachedSpuStats(supabase, "KR", fetchedStatsKR),
    setCachedSpuStats(supabase, "CN", fetchedStatsCN),
  ]);

  const statsKR = { ...cachedStatsKR, ...fetchedStatsKR };
  const statsCN = { ...cachedStatsCN, ...fetchedStatsCN };
  const { statsMapKR, statsMapCN } = buildStatsMaps(
    { success: true, data: statsKR },
    { success: true, data: statsCN }
  );

  rawEntries.forEach((entry) => applyStatsToItemData(entry.data, statsMapKR, statsMapCN));
  void specId;
}

/**
 * 한 청크(브랜드 1페이지 또는 품번 목록)를 수집한다.
 */
export async function runSearchJobChunk(
  spec: SearchJobSpec,
  deps: RunSearchJobDeps
): Promise<SearchJobChunkOutcome> {
  const { supabase, poizon, userId, onProgress } = deps;
  const warnings = createWarningCollector(deps.onWarning);
  const alreadyKept = deps.alreadyKept ?? 0;
  const maxItems = spec.options.maxItems ?? SEARCH_JOB_MAX_ITEMS;
  const remaining = Math.max(0, maxItems - alreadyKept);

  const reporter = {
    onRetry: (context: string, error: unknown, attempt: number) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[job ${spec.id}] 재시도 ${attempt} — ${context}: ${msg}`);
    },
  };

  const options: SearchJobOptions = spec.options ?? {};
  let brandTotal: number | null = options.brandTotal ?? null;
  let brandId: number | string | null = options.brandId ?? null;
  const pageNum = options.brandPage ?? 1;
  let catalogEnded = false;
  let nextBrandPage = pageNum;
  let nextArticleOffset = options.articleOffset ?? 0;
  let articleTermTotal = maxItems;

  await onProgress?.({
    stage: spec.type === "brand" ? `상품 조회 p.${pageNum}` : "상품 조회",
    progressTotal: maxItems,
    progressDone: alreadyKept,
  });

  const rawEntries: Array<{ data: any; term: string }> = [];

  if (spec.type === "article") {
    const allTerms = articleTermsFromKeyword(spec.keyword, maxItems);
    articleTermTotal = allTerms.length;
    const offset = Math.min(nextArticleOffset, allTerms.length);
    const terms = allTerms.slice(offset, offset + SEARCH_JOB_ARTICLE_CHUNK_SIZE);
    nextArticleOffset = offset + terms.length;
    catalogEnded = nextArticleOffset >= allTerms.length;

    await onProgress?.({
      stage: "상품 조회",
      progressTotal: articleTermTotal,
      progressDone: offset,
    });

    if (terms.length === 0) {
      if (alreadyKept === 0) {
        throw new Error("검색 결과가 없습니다. 품번을 확인해 주세요.");
      }
      return {
        items: [],
        excludedCount: 0,
        warnings: warnings.summarize(),
        brandTotal,
        brandId,
        nextBrandPage,
        nextArticleOffset,
        catalogEnded: true,
      };
    }

    let done = 0;
    const results = await mapWithConcurrency(terms, ARTICLE_CONCURRENCY, async (term) => {
      try {
        const res = await fetchItemByArticleNumber(poizon, term, reporter);
        return { term, res };
      } catch (error) {
        warnings.add(
          `품번 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
          term
        );
        return { term, res: null };
      } finally {
        done += 1;
        await onProgress?.({ progressDone: offset + done, progressTotal: articleTermTotal });
      }
    });

    for (const { term, res } of results) {
      if (!res) continue;
      let itemData = (res as any).data ?? res;
      if (Array.isArray(itemData)) itemData = itemData[0];

      if (itemData) {
        rawEntries.push({ data: itemData, term });
        continue;
      }

      const stripped = stripTrailingHan(term);
      if (stripped && stripped !== term) {
        try {
          const retry = await fetchItemByArticleNumber(poizon, stripped, reporter);
          let retryData = (retry as any)?.data ?? retry;
          if (Array.isArray(retryData)) retryData = retryData[0];
          if (retryData) {
            rawEntries.push({ data: retryData, term: stripped });
            continue;
          }
        } catch {
          // 원문 없음과 같이 취급
        }
      }

      warnings.add("조회 결과 없음", term);
    }

    if (rawEntries.length === 0) {
      if (alreadyKept === 0 && catalogEnded) {
        throw new Error("검색 결과가 없습니다. 품번을 확인해 주세요.");
      }
      return {
        items: [],
        excludedCount: 0,
        warnings: warnings.summarize(),
        brandTotal,
        brandId,
        nextBrandPage,
        nextArticleOffset,
        catalogEnded,
      };
    }
  } else {
    const pageSize = SEARCH_JOB_BRAND_PAGE_SIZE;
    const brandRes = await fetchBrandSpus(poizon, spec.keyword, pageNum, pageSize, brandId, reporter);
    brandTotal = brandRes.total;
    brandId = brandRes.brandId;

    const results = extractBrandResultsFromResponse(brandRes.data);
    if (results.length === 0) {
      if (pageNum <= 1 && alreadyKept === 0) {
        throw new Error(
          `'${spec.keyword}' 브랜드로 검색된 상품이 없습니다. 명칭을 다시 확인해 주세요.`
        );
      }
      return {
        items: [],
        excludedCount: 0,
        warnings: warnings.summarize(),
        brandTotal,
        brandId,
        nextBrandPage: pageNum,
        nextArticleOffset,
        catalogEnded: true,
      };
    }

    results.forEach((item: any) => rawEntries.push({ data: item, term: spec.keyword }));
    nextBrandPage = pageNum + 1;
    catalogEnded = results.length < pageSize;
  }

  const progressTotal = spec.type === "article" ? articleTermTotal : maxItems;

  await onProgress?.({ stage: "통계 수집", progressTotal, progressDone: alreadyKept });
  await applyStatistics(spec.id, supabase, poizon, rawEntries, warnings, reporter);

  const built: SearchItem[] = [];
  for (const entry of rawEntries) {
    const item = buildSearchItem(entry.data, entry.term);
    if (item) built.push(item);
  }

  await onProgress?.({ stage: "제외 필터 적용" });

  const exclusionOptions = {
    excludeSkipped: true,
    excludeReviewed: true,
    excludeActed: true,
  };
  const spuKeys = [...new Set(built.map(getSpuKeyFromItem).filter(Boolean))];
  const ctx = await loadExclusionContext(supabase, userId, exclusionOptions, spuKeys);
  const { items: keptItems, excludedCount } = filterItems(built, exclusionOptions, ctx);

  if (remaining <= 0 || keptItems.length === 0) {
    return {
      items: [],
      excludedCount,
      warnings: warnings.summarize(),
      brandTotal,
      brandId,
      nextBrandPage,
      nextArticleOffset,
      catalogEnded: catalogEnded || remaining <= 0,
    };
  }

  const isDiscovery = jobPurpose(options) === "discovery";
  const toEnrich = isDiscovery ? keptItems : keptItems.slice(0, remaining);

  await onProgress?.({
    stage: isDiscovery ? "가격 수집·수익 필터" : "가격 수집",
    progressTotal,
    progressDone: spec.type === "article" ? nextArticleOffset : alreadyKept,
  });

  const enriched = await fetchPricesForItems(toEnrich, {
    supabase,
    poizon,
    onWarning: (reason, target) => warnings.add(reason, target),
    onProgress: async (done) => {
      await onProgress?.({ progressDone: alreadyKept + done });
    },
  });

  if (!isDiscovery) {
    return {
      items: enriched,
      excludedCount,
      warnings: warnings.summarize(),
      brandTotal,
      brandId,
      nextBrandPage,
      nextArticleOffset,
      catalogEnded,
    };
  }

  const criteria = discoveryKeepCriteria(options.minNetProfit, options.minSalesVolume);
  if (!criteria) {
    warnings.add("발굴 순수익 하한이 없어 이 페이지를 적재하지 않았습니다");
    return {
      items: [],
      excludedCount: excludedCount + enriched.length,
      warnings: warnings.summarize(),
      brandTotal,
      brandId,
      nextBrandPage,
      nextArticleOffset,
      catalogEnded,
    };
  }

  const settings = await loadSystemSettings(supabase);
  const passed = enriched.filter((entry) => shouldKeepDiscoveryItem(entry, settings, criteria));
  const dropped = enriched.length - passed.length;
  const items = passed.slice(0, remaining);

  return {
    items,
    excludedCount: excludedCount + dropped + (passed.length - items.length),
    warnings: warnings.summarize(),
    brandTotal,
    brandId,
    nextBrandPage,
    nextArticleOffset,
    catalogEnded,
  };
}
