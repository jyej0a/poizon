export interface RecommendLeakInfo {
  leakPrice?: number;
  buyerRegion?: string;
  region?: string;
}

export interface RecommendPriceRangeItem {
  percentValue?: number;
  price?: number;
}

/** `recommend-bid/price` 응답 `data`. 실측 2026-08-24. */
export interface RecommendBidPriceData {
  leakInfos?: RecommendLeakInfo[];
  priceRangeItems?: RecommendPriceRangeItem[];
  asiaMinPrice?: number;
  effectiveExposurePrice?: number;
  globalMinPrice?: number;
}
