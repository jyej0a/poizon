import { parseNumber } from "@/lib/search/column-layout";
import { resolveExposurePriceValue } from "@/lib/utils/exposure-price";
import type { RecommendBidPriceData } from "@/types/recommend-bid-price";

export function parsePositiveWon(value: unknown): number | null {
  const num = parseNumber(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function currentExposureAmount(
  rec: RecommendBidPriceData | null | undefined,
  fallbackPrice: string | number | undefined
): number | null {
  return parsePositiveWon(resolveExposurePriceValue(rec, fallbackPrice));
}

/** 노출가가 목표가 이하이면 알림 도달 */
export function isPriceWatchHit(
  watchPrice: number | null | undefined,
  exposure: number | null | undefined
): boolean {
  if (watchPrice == null || watchPrice <= 0 || exposure == null) return false;
  return exposure <= watchPrice;
}
