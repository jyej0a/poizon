import type { RecommendBidPriceData } from "@/types/recommend-bid-price";

function cnLeakPrice(rec: RecommendBidPriceData | null | undefined): number | undefined {
  return rec?.leakInfos?.find((leak) => leak.buyerRegion === "CN" || leak.region === "CN")?.leakPrice;
}

export function formatWonAmount(value: string | number | null | undefined): string {
  if (value == null || value === "" || value === "—") return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return `₩${value.toLocaleString()}`;
  }
  const numStr = String(value).replace(/[^0-9]/g, "");
  return numStr ? `₩${Number(numStr).toLocaleString()}` : String(value);
}

/** 입찰가 자동 입력용: CN leakPrice, 없으면 글로벌 최저가 */
export function resolveCnLeakOrGlobalMin(
  rec: RecommendBidPriceData | null | undefined
): string | number | undefined {
  return cnLeakPrice(rec) ?? rec?.globalMinPrice;
}

export function resolveExposurePriceValue(
  rec: RecommendBidPriceData | null | undefined,
  fallbackPrice: string | number | undefined
): string | number {
  return cnLeakPrice(rec) ?? rec?.globalMinPrice ?? fallbackPrice ?? "—";
}

export function formatExposurePrice(
  rec: RecommendBidPriceData | null | undefined,
  fallbackPrice: string | number | undefined
): string {
  return formatWonAmount(resolveExposurePriceValue(rec, fallbackPrice));
}

export interface ExposurePriceBreakdown {
  leakPrice?: number;
  globalMinPrice?: number;
  effectiveExposurePrice?: number;
}

export function getExposurePriceBreakdown(
  rec: RecommendBidPriceData | null | undefined
): ExposurePriceBreakdown {
  return {
    leakPrice: cnLeakPrice(rec),
    globalMinPrice: rec?.globalMinPrice,
    effectiveExposurePrice: rec?.effectiveExposurePrice,
  };
}
