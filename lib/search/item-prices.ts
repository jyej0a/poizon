/**
 * 품번별 원가 오퍼 + SKU 노출가 수집. 워커와 선택 가격 갱신이 같은 경로를 쓴다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoizonClient } from "@/lib/api/poizon";
import { fetchSkuRecommendPrice } from "@/lib/api/recommend-price";
import { mapWithConcurrency, withRetry } from "@/lib/api/retry";
import {
  getCachedSourceOffers,
  setCachedSourceOffers,
} from "@/lib/search/search-cache";
import { getChildSkuIds, type SearchItem } from "@/lib/search/search-item";
import {
  fetchTopSourceOffers,
  filterOffersByActiveSources,
} from "@/lib/sourcing/source-offers";
import { loadActiveSourceProviders } from "@/lib/sourcing/source-malls";
import type { RecommendBidPriceData } from "@/types/recommend-bid-price";
import type { SourceOfferItemStatus } from "@/types/search-job";
import type { SourceOffer, SourceOfferStatus } from "@/types/source-offer";

const SOURCE_OFFER_CONCURRENCY = 3;
const RECOMMEND_CONCURRENCY = 5;

export interface EnrichedSearchItem {
  item: SearchItem;
  sourceOffers: SourceOffer[];
  skuRecommendations: Record<string, RecommendBidPriceData>;
  offerStatus: SourceOfferItemStatus;
}

export interface FetchItemPricesDeps {
  supabase: SupabaseClient;
  poizon: PoizonClient;
  onWarning?: (reason: string, target?: string) => void;
  onProgress?: (done: number, total: number) => Promise<void> | void;
}

export async function fetchPricesForItems(
  items: SearchItem[],
  deps: FetchItemPricesDeps
): Promise<EnrichedSearchItem[]> {
  const { supabase, poizon, onWarning, onProgress } = deps;
  const sourceProviders = await loadActiveSourceProviders();
  const total = items.length;
  let done = 0;

  return mapWithConcurrency(items, SOURCE_OFFER_CONCURRENCY, async (item) => {
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
                    `소싱 오퍼 재시도 ${attempt} — ${articleNumber}: ${
                      error instanceof Error ? error.message : String(error)
                    }`
                  ),
              }
            );

        sourceOffers = result.offers;
        offerStatus = result.status;
        result.warnings.forEach((warning) => onWarning?.(`원가 수집 경고: ${warning}`, articleNumber));
        if (!cached && result.offers.length > 0) {
          await setCachedSourceOffers(supabase, articleNumber, result.offers);
        }
      } catch (error) {
        sourceOffers = [];
        offerStatus = "failed";
        onWarning?.(
          `원가 수집 실패: ${error instanceof Error ? error.message : String(error)}`,
          articleNumber
        );
      }
    }

    const skuRecommendations: Record<string, RecommendBidPriceData> = {};
    const skuIds = getChildSkuIds(item);
    const recResults = await mapWithConcurrency(skuIds, RECOMMEND_CONCURRENCY, async (skuId) => {
      try {
        const rec = await fetchSkuRecommendPrice(poizon, skuId);
        return { skuId, rec };
      } catch (error) {
        onWarning?.(
          `노출가 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
          skuId
        );
        return { skuId, rec: null };
      }
    });
    recResults.forEach(({ skuId, rec }) => {
      if (rec) skuRecommendations[skuId] = rec;
    });

    done += 1;
    await onProgress?.(done, total);

    return { item, sourceOffers, skuRecommendations, offerStatus };
  });
}
