export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  manage: 176,
  info: 340,
  poizon: 148,
  naver: 110,
  profit: 110,
  sales: 108,
  bid: 200,
};

/** v5: 거래가+노출가 / 중국+현지 판매량 병합 (9→7열) */
export const COLUMN_STORAGE_KEY = "poizon_dashboard_widths_v5";

export type SortKey = "avg" | "exposure" | "naver" | "profit" | "salesChina" | "salesLocal";

export function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? NaN : num;
}
