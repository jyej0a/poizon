export const TRADE_STATUS = {
  IN_TRANSACTION: 0,
  CANCELLED: 1,
  ACTIVE: 2,
  SOLD_OUT: 3,
} as const;

export type TradeStatus = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];

export type ListingStatusTab = "active" | "inTrade" | "soldOut" | "cancelled";

export const LISTING_STATUS_TABS: {
  key: ListingStatusTab;
  label: string;
  tradeStatus: TradeStatus;
}[] = [
  { key: "active", label: "활성", tradeStatus: TRADE_STATUS.ACTIVE },
  { key: "inTrade", label: "거래중", tradeStatus: TRADE_STATUS.IN_TRANSACTION },
  { key: "soldOut", label: "매진", tradeStatus: TRADE_STATUS.SOLD_OUT },
  { key: "cancelled", label: "취소", tradeStatus: TRADE_STATUS.CANCELLED },
];

export const TRADE_STATUS_LABEL: Record<number, { label: string; color: string }> = {
  [TRADE_STATUS.IN_TRANSACTION]: {
    label: "거래중",
    color: "text-yellow-700 bg-yellow-500/10 border-yellow-500/20",
  },
  [TRADE_STATUS.CANCELLED]: {
    label: "취소",
    color: "text-gray-500 bg-gray-500/10 border-gray-500/20",
  },
  [TRADE_STATUS.ACTIVE]: {
    label: "활성",
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  [TRADE_STATUS.SOLD_OUT]: {
    label: "매진",
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
};

export type ListingViewFilter =
  | "all"
  | "cn_hidden"
  | "kr_hidden"
  | "cn_lowest"
  | "kr_lowest"
  | "stock";

export const LISTING_VIEW_FILTERS: { key: ListingViewFilter; label: string }[] = [
  { key: "all", label: "노출 전체" },
  { key: "cn_hidden", label: "중국 미노출" },
  { key: "kr_hidden", label: "한국 미노출" },
  { key: "cn_lowest", label: "중국 최저가 미달" },
  { key: "kr_lowest", label: "한국 최저가 미달" },
  { key: "stock", label: "재고 보유" },
];

export type PriceAdjustMode = "set" | "delta" | "percent";

export interface ParsedListingItem {
  sellerBiddingNo: string;
  skuId: number;
  spuId: number;
  globalSkuId: number;
  globalSpuId: number;
  /** 카탈로그 `skuId`/`dwSkuId`/`regionSkuId` — 검색 보드 sku_status 키와 맞출 때 사용 */
  skuIdAliases: number[];
  productName: string;
  articleNumber: string;
  image: string;
  sizeInfo: string;
  price: number;
  quantity: number;
  onSaleQuantity: number;
  currency: string;
  tradeStatus: number;
  biddingType: number;
  saleType: number;
  cnExposed: boolean;
  krExposed: boolean;
  cnMinPrice?: number;
  krMinPrice?: number;
  isWeakIntercept: boolean;
  createdAt: string;
  modifiedAt: string;
}

export function isLowestMissed(price: number, minPrice: number | undefined): boolean {
  return minPrice != null && minPrice > 0 && price > minPrice;
}

export function matchesListingViewFilter(
  item: ParsedListingItem,
  filter: ListingViewFilter,
  opts?: { stockMarked?: boolean }
): boolean {
  if (filter === "cn_hidden") return !item.cnExposed;
  if (filter === "kr_hidden") return !item.krExposed;
  if (filter === "cn_lowest") return isLowestMissed(item.price, item.cnMinPrice);
  if (filter === "kr_lowest") return isLowestMissed(item.price, item.krMinPrice);
  if (filter === "stock") return !!opts?.stockMarked;
  return true;
}

export function canEditListing(tradeStatus: number) {
  return tradeStatus === TRADE_STATUS.ACTIVE || tradeStatus === TRADE_STATUS.IN_TRANSACTION;
}

export function listingStatusMeta(status: number) {
  return (
    TRADE_STATUS_LABEL[status] ?? {
      label: `상태 ${status}`,
      color: "text-muted-foreground bg-secondary/20 border-secondary/30",
    }
  );
}
