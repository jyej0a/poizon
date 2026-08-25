import type { SystemSettings } from "@/lib/utils/calculate-margin";

/** 효자 하한: 최소 수수료의 2배. 수익 옵션(순수익 > 0)보다 한 단계 위. */
export function highProfitFloor(settings: SystemSettings | null | undefined): number | null {
  if (!settings) return null;
  const minFee = Number(settings.min_fee);
  if (!Number.isFinite(minFee) || minFee <= 0) return null;
  return minFee * 2;
}

export function isHighProfit(
  profit: number | null | undefined,
  settings: SystemSettings | null | undefined
): boolean {
  const floor = highProfitFloor(settings);
  if (floor == null || profit == null || !Number.isFinite(profit)) return false;
  return profit >= floor;
}
