/**
 * 판매자센터와 동일한 30일 판매량 표기 규칙
 * - null/undefined: 미수신
 * - 0: 실제 무판매
 * - 1~4: "<5"
 * - 100 이상: 백 단위 내림 + "+"
 */
export function formatSalesVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0";
  if (value > 0 && value < 5) return "<5";
  if (value >= 100) {
    const rounded = Math.floor(value / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  }
  return value.toLocaleString();
}

export function parseSalesNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function getSkuSalesValue(
  sku: { skuId?: number | string; dwSkuId?: number | string; commoditySales?: { globalSoldNum30?: number; localSoldNum30?: number } },
  statsCN: Array<{ skuId?: number | string; dwSkuId?: number | string; commoditySales?: { globalSoldNum30?: number; localSoldNum30?: number } }> | undefined,
  field: "globalSoldNum30" | "localSoldNum30"
): number | null {
  const skuId = String(sku.skuId ?? sku.dwSkuId ?? "");
  if (!skuId) return null;

  const cnSku = statsCN?.find((s) => String(s.skuId ?? s.dwSkuId) === skuId);
  const cnVal = cnSku?.commoditySales?.[field];
  if (cnVal !== null && cnVal !== undefined) return cnVal;

  const krVal = sku.commoditySales?.[field];
  if (krVal !== null && krVal !== undefined) return krVal;

  // SKU는 응답에 있으나 commoditySales가 null → API 기준 30일 0건
  if (sku.commoditySales === null) return 0;
  if (cnSku && cnSku.commoditySales === null) return 0;

  return null;
}
