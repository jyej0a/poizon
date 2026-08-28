/**
 * 발굴 잡 적재 조건. 화면 순수익과 같은 공식.
 * 품번 단위 — 옵션 하나라도 통과하면 적재.
 */

import type { EnrichedSearchItem } from "@/lib/search/item-prices";
import { resolveSkuId } from "@/lib/search/search-item";
import { skuListPrice, skuOfferProfit } from "@/lib/search/sku-display";
import { getBestSourceOfferPrice } from "@/lib/sourcing/source-offer-view";
import { parseSalesNumber } from "@/lib/utils/sales-volume";
import type { SystemSettings } from "@/lib/utils/calculate-margin";
import { DISCOVERY_DEFAULT_MIN_SALES_VOLUME } from "@/types/search-job";

export interface DiscoveryKeepCriteria {
  minNetProfit: number;
  minSalesVolume: number;
}

export function discoveryKeepCriteria(
  minNetProfit: number | undefined,
  minSalesVolume: number | undefined
): DiscoveryKeepCriteria | null {
  if (!Number.isFinite(minNetProfit)) return null;
  const sales =
    minSalesVolume == null || !Number.isFinite(minSalesVolume)
      ? DISCOVERY_DEFAULT_MIN_SALES_VOLUME
      : Math.max(0, minSalesVolume);
  return { minNetProfit: minNetProfit as number, minSalesVolume: sales };
}

export function shouldKeepDiscoveryItem(
  entry: EnrichedSearchItem,
  settings: SystemSettings,
  criteria: DiscoveryKeepCriteria
): boolean {
  const article = entry.item.articleNumber;
  const cost = getBestSourceOfferPrice(
    article ? { [article]: entry.sourceOffers } : {},
    article
  );
  if (cost == null) return false;

  if (
    criteria.minSalesVolume > 0 &&
    parseSalesNumber(entry.item.salesVolume) < criteria.minSalesVolume
  ) {
    return false;
  }

  const skus = entry.item.skuDetails ?? [];
  for (const sku of skus) {
    const skuId = resolveSkuId(sku);
    const rec = skuId ? entry.skuRecommendations[skuId] : undefined;
    const computed = skuOfferProfit(
      rec,
      skuListPrice(sku as { minPrice?: { globalMinPriceVO?: { amountText?: string }; price?: string | number } }),
      cost,
      settings
    );
    if (computed && computed.profit >= criteria.minNetProfit) return true;
  }

  return false;
}
