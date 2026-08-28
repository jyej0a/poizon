/**
 * SKU 추천가(노출가) 조회. 서버 액션과 워커가 같은 호출부를 쓴다.
 */

import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import type { RecommendBidPriceData } from "@/types/recommend-bid-price";

export interface RecommendRetryReporter {
  onRetry?: (context: string, error: unknown, attempt: number, delayMs: number) => void;
}

export function compactRecommendPrice(data: unknown): RecommendBidPriceData {
  const rec = (data ?? {}) as RecommendBidPriceData;
  const leakInfos = Array.isArray(rec.leakInfos)
    ? rec.leakInfos
        .filter((leak) => leak.buyerRegion === "CN" || leak.region === "CN")
        .map((leak) => ({
          leakPrice: leak.leakPrice,
          buyerRegion: leak.buyerRegion,
          region: leak.region,
        }))
    : undefined;

  return {
    leakInfos,
    globalMinPrice: rec.globalMinPrice,
    asiaMinPrice: rec.asiaMinPrice,
    effectiveExposurePrice: rec.effectiveExposurePrice,
  };
}

export async function fetchSkuRecommendPrice(
  client: PoizonClient,
  skuId: string | number,
  _reporter?: RecommendRetryReporter
): Promise<RecommendBidPriceData | null> {
  // client.request가 이미 재시도한다. 여기서 한 번 더 감싸면 빈도 제한이 9회까지 반복된다.
  const response = await client.request<{ code?: number; data?: unknown; msg?: string }>(
    POIZON_CONSTANTS.ENDPOINTS.RECOMMEND_PRICE,
    {
      skuId: Number(skuId),
      biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
      saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
      region: "KR",
      currency: "KRW",
    }
  );

  if (response?.code === 200 && response.data) {
    return compactRecommendPrice(response.data);
  }
  return null;
}
