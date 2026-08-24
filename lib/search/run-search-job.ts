/**
 * 백그라운드 검색 잡의 실제 수집 파이프라인 (서버 전용).
 *
 * 기존에는 `search-board.tsx`의 `handleSearch`가 브라우저에서 전 과정을 `await`했기 때문에
 * 브랜드 50건 검색이 20~60초간 화면을 잠갔고, 이탈하면 결과가 전량 소실됐다.
 * 동일한 단계를 서버에서 수행하고 결과를 DB에 적재한다.
 *
 * 단계: 상품 조회 → 통계(KR/CN) → 아이템 변환 → 제외 필터 → 외부 소싱 오퍼
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoizonClient } from "@/lib/api/poizon";
import {
  fetchBrandSpus,
  fetchItemByArticleNumber,
  fetchSpuStatistics,
} from "@/lib/api/poizon-search";
import { mapWithConcurrency, withRetry } from "@/lib/api/retry";
import {
  fetchTopSourceOffers,
  filterOffersByActiveSources,
} from "@/lib/sourcing/source-offers";
import { loadActiveSourceProviders } from "@/lib/sourcing/source-malls";
import {
  applyStatsToItemData,
  buildSearchItem,
  buildStatsMaps,
  extractBrandResultsFromResponse,
  getSpuKeyFromItem,
  type SearchItem,
} from "@/lib/search/search-item";
import { filterItems, loadExclusionContext } from "@/lib/search/exclusion";
import {
  getCachedSourceOffers,
  getCachedSpuStats,
  setCachedSourceOffers,
  setCachedSpuStats,
} from "@/lib/search/search-cache";
import type { SearchJobOptions, SearchJobType, SourceOfferItemStatus } from "@/types/search-job";
import type { SourceOffer, SourceOfferStatus } from "@/types/source-offer";

/** 품번 동시 조회 수. POIZON 부하와 총 소요시간의 균형점 */
const ARTICLE_CONCURRENCY = 5;
/**
 * 외부 소싱 오퍼 동시 조회 수.
 */
const SOURCE_OFFER_CONCURRENCY = 3;

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
  /** public.users.id (Clerk ID 아님) */
  userId: string;
  onProgress?: (update: ProgressUpdate) => Promise<void> | void;
  onWarning?: (message: string) => void;
}

export interface EnrichedSearchItem {
  item: SearchItem;
  sourceOffers: SourceOffer[];
  offerStatus: SourceOfferItemStatus;
}

export interface SearchJobOutcome {
  items: EnrichedSearchItem[];
  excludedCount: number;
  warnings: string[];
  brandTotal: number | null;
  brandId: number | string | null;
}

/**
 * 같은 사유의 실패를 하나로 묶는다.
 *
 * 외부 소싱 수집이 죽어 있으면 50건 검색에서 동일한 경고가 50개 쌓이고 로그도 그만큼 반복된다.
 * 사유별로 건수와 예시 몇 개만 남겨 진단에 필요한 정보는 유지하면서 부피를 줄인다.
 */
function createWarningCollector(onWarning?: (message: string) => void) {
  const groups = new Map<string, { count: number; samples: string[] }>();

  return {
    add(reason: string, target?: string) {
      const group = groups.get(reason) ?? { count: 0, samples: [] };
      group.count += 1;
      if (target && group.samples.length < 3) group.samples.push(target);
      groups.set(reason, group);

      // 로그는 사유당 1회만 (반복 출력이 실제 원인을 덮는다)
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
    get isEmpty() {
      return groups.size === 0;
    },
  };
}

export async function runSearchJob(
  spec: SearchJobSpec,
  deps: RunSearchJobDeps
): Promise<SearchJobOutcome> {
  const { supabase, poizon, userId, onProgress } = deps;
  const warnings = createWarningCollector(deps.onWarning);

  const reporter = {
    onRetry: (context: string, error: unknown, attempt: number) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[job ${spec.id}] 재시도 ${attempt} — ${context}: ${msg}`);
    },
  };

  const options: SearchJobOptions = spec.options ?? {};
  let brandTotal: number | null = null;
  let brandId: number | string | null = options.brandId ?? null;

  // 1) 상품 조회
  await onProgress?.({ stage: "상품 조회" });

  const rawEntries: Array<{ data: any; term: string }> = [];

  if (spec.type === "article") {
    const terms = spec.keyword
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    await onProgress?.({ stage: "상품 조회", progressTotal: terms.length, progressDone: 0 });

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
        await onProgress?.({ progressDone: done });
      }
    });

    for (const { term, res } of results) {
      if (!res) continue;
      let itemData = (res as any).data ?? res;
      if (Array.isArray(itemData)) itemData = itemData[0];

      if (itemData) {
        rawEntries.push({ data: itemData, term });
      } else {
        // 호출은 성공했으나 매칭되는 상품이 없는 경우. 어느 품번이 비었는지 알려준다.
        warnings.add("조회 결과 없음", term);
      }
    }

    if (rawEntries.length === 0) {
      throw new Error("검색 결과가 없습니다. 품번을 확인해 주세요.");
    }
  } else {
    const pageNum = options.brandPage ?? 1;
    const pageSize = options.pageSize ?? 20;

    const brandRes = await fetchBrandSpus(
      poizon,
      spec.keyword,
      pageNum,
      pageSize,
      brandId,
      reporter
    );
    brandTotal = brandRes.total;
    brandId = brandRes.brandId;

    const results = extractBrandResultsFromResponse(brandRes.data);
    if (results.length === 0) {
      return { items: [], excludedCount: 0, warnings: warnings.summarize(), brandTotal, brandId };
    }

    results.forEach((item: any) => rawEntries.push({ data: item, term: spec.keyword }));
  }

  // 2) 통계 (중국 판매량은 CN 우선, 실패 시 KR 폴백)
  await onProgress?.({ stage: "통계 수집", progressTotal: 0, progressDone: 0 });

  const spuIdsForStats = rawEntries
    .map((entry) => Number(entry.data.spuInfo?.spuId || entry.data.spuId || entry.data.goodsId))
    .filter((id) => !!id && !Number.isNaN(id));

  if (spuIdsForStats.length > 0) {
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
      // CN은 계정/상품에 따라 'Overseas region information not found'가 정상적으로 발생한다.
      // 중국 판매량이 KR 값으로 폴백되는 설계이므로 실패를 경고로 올리지 않는다.
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
  }

  // 3) 아이템 변환
  const built: SearchItem[] = [];
  for (const entry of rawEntries) {
    const item = buildSearchItem(entry.data, entry.term);
    if (item) built.push(item);
  }

  // 4) 제외 필터
  await onProgress?.({ stage: "제외 필터 적용" });

  const exclusionOptions = {
    excludeSkipped: options.excludeSkipped ?? false,
    excludeReviewed: options.excludeReviewed ?? false,
  };
  const spuKeys = [...new Set(built.map(getSpuKeyFromItem).filter(Boolean))];
  const ctx = await loadExclusionContext(supabase, userId, exclusionOptions, spuKeys);
  const { items: keptItems, excludedCount } = filterItems(built, exclusionOptions, ctx);

  if (keptItems.length === 0) {
    return { items: [], excludedCount, warnings: warnings.summarize(), brandTotal, brandId };
  }

  // 5) 외부 소싱 오퍼 상위 10개
  await onProgress?.({
    stage: "외부 원가 수집",
    progressTotal: keptItems.length,
    progressDone: 0,
  });

  let sourceDone = 0;
  const sourceProviders = await loadActiveSourceProviders();

  const enriched = await mapWithConcurrency(
    keptItems,
    SOURCE_OFFER_CONCURRENCY,
    async (item): Promise<EnrichedSearchItem> => {
      const articleNumber = item.articleNumber;
      let sourceOffers: SourceOffer[] = [];
      let offerStatus: SourceOfferItemStatus = "skipped";

      if (articleNumber && articleNumber !== "N/A") {
        try {
          const cached = await getCachedSourceOffers(supabase, articleNumber);
          const result = cached
            ? (() => {
                const offers = filterOffersByActiveSources(cached, sourceProviders);
                return {
                  offers,
                  status: (offers.length > 0 ? "ok" : "empty") as SourceOfferStatus,
                  warnings: [] as string[],
                };
              })()
            : await withRetry(
                () => fetchTopSourceOffers(articleNumber, { providers: sourceProviders }),
                {
                  attempts: 3,
                  baseDelayMs: 1_000,
                  onRetry: (error, attempt) =>
                    console.warn(
                      `[job ${spec.id}] 소싱 오퍼 재시도 ${attempt} — ${articleNumber}: ${
                        error instanceof Error ? error.message : String(error)
                      }`
                    ),
                }
              );

          sourceOffers = result.offers;
          offerStatus = result.status;
          result.warnings.forEach((warning) => warnings.add(`원가 수집 경고: ${warning}`, articleNumber));
          if (!cached && result.offers.length > 0) {
            await setCachedSourceOffers(supabase, articleNumber, result.offers);
          }
        } catch (error) {
          sourceOffers = [];
          offerStatus = "failed";
          warnings.add(`원가 수집 실패: ${error instanceof Error ? error.message : String(error)}`, articleNumber);
        }
      }

      sourceDone += 1;
      await onProgress?.({ progressDone: sourceDone });

      return { item, sourceOffers, offerStatus };
    }
  );

  return { items: enriched, excludedCount, warnings: warnings.summarize(), brandTotal, brandId };
}
