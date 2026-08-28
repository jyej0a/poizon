import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import {
  TRADE_STATUS,
  type ParsedListingItem,
  type PriceAdjustMode,
} from "@/types/poizon-listing";

export type { ParsedListingItem };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return "";
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function parseSizeInfo(item: Record<string, unknown>): string {
  const props = item.regionSalePvInfoList;
  if (Array.isArray(props)) {
    const rows = props
      .map((row) => asRecord(row))
      .map((row) => ({
        name: pickString(row, ["name"]),
        value: pickString(row, ["localValue"]),
      }))
      .filter((row) => row.value);
    const size = rows.find((row) => row.name.includes("사이즈") || /size/i.test(row.name));
    const color = rows.find((row) => row.name.includes("색") || /color/i.test(row.name));
    const parts = [color?.value, size?.value ?? rows.at(-1)?.value].filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }

  const rawProp = item.skuSaleProp;
  if (typeof rawProp === "string") {
    try {
      const parsed = JSON.parse(rawProp) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((row) => pickString(asRecord(row), ["value"]))
          .filter(Boolean)
          .join(" · ");
      }
    } catch {
      /* ignore malformed skuSaleProp */
    }
  }

  return pickString(item, ["sizeInfo", "size"]);
}

function exposureEnabled(item: Record<string, unknown>, region: string): boolean {
  const list = item.exposureItemList;
  if (!Array.isArray(list)) return false;
  const match = list
    .map((row) => asRecord(row))
    .find((row) => String(row.region || "").toUpperCase() === region);
  return Boolean(match?.exposureEnabled);
}

export function extractListingRawList(response: unknown): unknown[] {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const list = data.list ?? data.contents ?? root.list ?? root.contents;
  return Array.isArray(list) ? list : [];
}

export function extractListingLastOffsetId(response: unknown): number {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const value = Number(data.lastOffsetId ?? root.lastOffsetId ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function parseListingItem(raw: unknown): ParsedListingItem {
  const item = asRecord(raw);
  return {
    sellerBiddingNo: pickString(item, ["sellerBiddingNo", "biddingNo"]),
    skuId: pickNumber(item, ["skuId"]),
    spuId: pickNumber(item, ["spuId"]),
    globalSkuId: pickNumber(item, ["globalSkuId"]),
    globalSpuId: pickNumber(item, ["globalSpuId"]),
    skuIdAliases: [],
    productName: pickString(item, ["spuTitle", "productName", "title", "spuName"]),
    articleNumber: pickString(item, ["articleNumber", "goodsNo", "styleId"]),
    image: pickString(item, ["image", "logoUrl", "imgUrl", "skuLogo"]),
    sizeInfo: parseSizeInfo(item),
    price: pickNumber(item, ["price", "bidPrice", "amount"]),
    quantity: pickNumber(item, ["quantity", "qty"]) || 1,
    onSaleQuantity: pickNumber(item, ["onSaleQuantity"]),
    currency: pickString(item, ["currency"]) || "KRW",
    tradeStatus: pickNumber(item, ["tradeStatus"]),
    biddingType: pickNumber(item, ["biddingType"]) || POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: Number.isFinite(Number(item.saleType))
      ? Number(item.saleType)
      : POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
    cnExposed: exposureEnabled(item, "CN"),
    krExposed: exposureEnabled(item, "KR"),
    isWeakIntercept: Boolean(item.isWeakIntercept),
    createdAt: pickString(item, ["createTime", "createdAt", "gmtCreate"]),
    modifiedAt: pickString(item, ["modifyTime", "modifiedAt"]),
  };
}

export function listingListPayload(input: {
  tradeStatus: number;
  exclusiveStartOffsetId?: number;
  pageSize?: number;
  sellerBiddingNo?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    language: "ko",
    timeZone: "Asia/Seoul",
    region: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
    tradeStatus: input.tradeStatus,
    exclusiveStartOffsetId: input.exclusiveStartOffsetId ?? 0,
    pageSize: input.pageSize ?? 20,
  };
  const biddingNo = input.sellerBiddingNo?.trim();
  if (biddingNo) payload.sellerBiddingNoList = [biddingNo];
  return payload;
}

export function computeAdjustedPrice(
  current: number,
  mode: PriceAdjustMode,
  value: number
): number {
  if (!Number.isFinite(value)) return 0;
  if (mode === "set") return Math.max(0, Math.round(value));
  if (mode === "delta") return Math.max(0, Math.round(current + value));
  return Math.max(0, Math.round(current * (1 + value / 100)));
}

export function formatBidDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateStr;
  return d
    .toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
    .replace(".", "월")
    .replace(/\.$/, "일");
}

function listingMatchesSku(parsed: ParsedListingItem, skuId: number): boolean {
  return parsed.skuId === skuId || parsed.globalSkuId === skuId;
}

/**
 * 실데이터 활성 입찰을 SKU ID 집합으로 조회합니다.
 * 목록 API는 skuId 필터가 없어 커서를 넘기며 찾는다.
 */
export async function fetchActiveListingsBySkuIds(
  client: PoizonClient,
  skuIds: number[]
): Promise<Map<number, ParsedListingItem>> {
  const targetSet = new Set(skuIds.filter((id) => id > 0));
  const result = new Map<number, ParsedListingItem>();
  if (targetSet.size === 0) return result;

  let exclusiveStartOffsetId = 0;
  const pageSize = 100;

  for (let page = 0; page < 10; page++) {
    const response = await client.request<unknown>(
      POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      listingListPayload({
        tradeStatus: TRADE_STATUS.ACTIVE,
        exclusiveStartOffsetId,
        pageSize,
      })
    );

    const rawList = extractListingRawList(response);
    for (const raw of rawList) {
      const parsed = parseListingItem(raw);
      if (!parsed.sellerBiddingNo) continue;
      for (const skuId of targetSet) {
        if (listingMatchesSku(parsed, skuId) && !result.has(skuId)) {
          result.set(skuId, parsed);
        }
      }
    }

    if (result.size >= targetSet.size) break;
    const lastOffsetId = extractListingLastOffsetId(response);
    if (rawList.length < pageSize || lastOffsetId <= exclusiveStartOffsetId) break;
    exclusiveStartOffsetId = lastOffsetId;
  }

  return result;
}

/**
 * listing list 혼잡·타임아웃 시 빈 맵을 반환한다.
 * 입찰 이력 표시는 로컬 DB로 폴백할 수 있게 한다.
 */
export async function fetchActiveListingsBySkuIdsSafe(
  client: PoizonClient,
  skuIds: number[]
): Promise<Map<number, ParsedListingItem>> {
  try {
    return await fetchActiveListingsBySkuIds(client, skuIds);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("[fetchActiveListingsBySkuIds] fallback to local:", msg.slice(0, 200));
    return new Map();
  }
}

/**
 * 입찰번호로 실데이터 1건을 찾는다. 상태 탭이 달라 안 보이는 경우를 막기 위해
 * 활성 → 거래중 → 취소 순으로 본다.
 */
export async function fetchListingByBiddingNo(
  client: PoizonClient,
  sellerBiddingNo: string
): Promise<ParsedListingItem | null> {
  const biddingNo = sellerBiddingNo.trim();
  if (!biddingNo) return null;

  const statuses = [
    TRADE_STATUS.ACTIVE,
    TRADE_STATUS.IN_TRANSACTION,
    TRADE_STATUS.CANCELLED,
  ] as const;

  let lastError: unknown;
  for (const tradeStatus of statuses) {
    try {
      const response = await client.request<unknown>(
        POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
        listingListPayload({
          tradeStatus,
          sellerBiddingNo: biddingNo,
          pageSize: 20,
        })
      );
      const match = extractListingRawList(response)
        .map(parseListingItem)
        .find((item) => item.sellerBiddingNo === biddingNo);
      if (match) return match;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}
