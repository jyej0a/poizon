import { calculateMargin, type SystemSettings } from "@/lib/utils/calculate-margin";

export function skuOptionLabel(sku: {
  regionSalePvInfoList?: Array<{ value?: string; propertyValue?: string }>;
  properties?: Array<{ value?: string; propertyValue?: string }>;
}): string {
  const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
  return propsRaw.map((p) => p.value || p.propertyValue).filter(Boolean).join(" / ");
}

export function skuAverageAmount(sku: {
  averagePrice?: {
    averagePrice?: { amount?: number };
    globalAveragePrice?: { amount?: number };
  };
}): number {
  const avgObj = sku.averagePrice;
  return Number(avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0);
}

export function skuListPrice(sku: {
  minPrice?: { globalMinPriceVO?: { amountText?: string }; price?: string | number };
}): string {
  return String(sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "—");
}

/** 추천가/SKU 가격 대비 1등 오퍼 원가의 순수익 */
export function skuOfferProfit(
  rec: { globalMinPrice?: string | number } | null | undefined,
  skuPrice: string | number | undefined,
  cost: number | null | undefined,
  settings: SystemSettings | null
): { profit: number; fee: number } | null {
  if (!cost || !settings) return null;
  const raw = String(rec?.globalMinPrice || skuPrice || "").replace(/[^0-9]/g, "");
  const poizon = Number(raw);
  if (!poizon || poizon <= 0) return null;
  const { fee } = calculateMargin(poizon, settings);
  return { fee, profit: poizon - fee - Number(cost) };
}
