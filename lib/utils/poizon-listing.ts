import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";

export interface ParsedListingItem {
  sellerBiddingNo: string;
  skuId: number;
  spuId: number;
  articleNumber: string;
  productName: string;
  brandName: string;
  categoryName: string;
  sizeInfo: string;
  image: string;
  price: number;
  quantity: number;
  status: string;
  bidFailCount: number;
  cnMarketInfo: string;
  krMarketInfo: string;
  createdAt: string;
}

export function extractListingRawList(response: any): any[] {
  return (
    response?.data?.contents ||
    response?.data?.list ||
    response?.contents ||
    response?.list ||
    []
  );
}

export function parseListingItem(item: any): ParsedListingItem {
  return {
    sellerBiddingNo: String(item.sellerBiddingNo || item.biddingNo || item.id || ""),
    skuId: Number(item.skuId) || 0,
    spuId: Number(item.spuId) || 0,
    articleNumber: item.articleNumber || item.styleId || "",
    productName: item.productName || item.title || item.spuName || "",
    brandName: item.brandName || item.brand || "",
    categoryName: item.categoryName || item.category || "",
    sizeInfo:
      item.sizeInfo ||
      item.size ||
      item.properties?.map((p: any) => p.value).join(" / ") ||
      "",
    image: item.image || item.logoUrl || item.imgUrl || "",
    price: Number(item.price || item.bidPrice || item.amount || 0),
    quantity: Number(item.quantity || item.qty || 1),
    status: item.status || item.bidStatus || "active",
    bidFailCount: item.bidFailCount || item.failCount || 0,
    cnMarketInfo: item.cnMarketInfo || item.chinaMarket || "-",
    krMarketInfo: item.krMarketInfo || item.koreaMarket || "-",
    createdAt: item.createdAt || item.createTime || item.gmtCreate || "",
  };
}

export function formatBidDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d
    .toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
    .replace(".", "월")
    .replace(/\.$/, "일");
}

/**
 * 실데이터 listing/list API에서 SKU ID 집합에 해당하는 활성 입찰을 조회합니다.
 */
export async function fetchActiveListingsBySkuIds(
  client: PoizonClient,
  skuIds: number[]
): Promise<Map<number, ParsedListingItem>> {
  const targetSet = new Set(skuIds.filter((id) => id > 0));
  const result = new Map<number, ParsedListingItem>();

  if (targetSet.size === 0) return result;

  let pageNo = 1;
  const pageSize = 50;

  while (pageNo <= 10) {
    const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST, {
      pageNo,
      pageSize,
      region: "KR",
      language: "ko",
    });

    const rawList = extractListingRawList(response);

    for (const raw of rawList) {
      const parsed = parseListingItem(raw);
      if (parsed.skuId && targetSet.has(parsed.skuId) && !result.has(parsed.skuId)) {
        result.set(parsed.skuId, parsed);
      }
    }

    if (result.size >= targetSet.size) break;
    if (rawList.length < pageSize) break;
    pageNo++;
  }

  return result;
}
