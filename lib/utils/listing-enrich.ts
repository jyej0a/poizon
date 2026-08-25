import type { PoizonClient } from "@/lib/api/poizon";
import { mapWithConcurrency } from "@/lib/api/retry";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import type { ParsedListingItem } from "@/types/poizon-listing";

const SPU_CHUNK = 5;
const RECOMMEND_CONCURRENCY = 4;

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
  return 0;
}

function asArray(response: unknown): unknown[] {
  const root = asRecord(response);
  const data = root.data;
  if (Array.isArray(data)) return data;
  const nested = asRecord(data);
  if (Array.isArray(nested.data)) return nested.data;
  if (Array.isArray(nested.contents)) return nested.contents;
  if (Array.isArray(nested.list)) return nested.list;
  return [];
}

function skuMatchesListing(listing: ParsedListingItem, sku: Record<string, unknown>): boolean {
  const ids = [pickNumber(sku, ["skuId"]), pickNumber(sku, ["dwSkuId"]), pickNumber(sku, ["regionSkuId"])];
  return ids.includes(listing.skuId) || (listing.globalSkuId > 0 && ids.includes(listing.globalSkuId));
}

async function fetchCatalogBySpuIds(
  client: PoizonClient,
  listings: ParsedListingItem[]
): Promise<Map<string, { articleNumber: string; image: string }>> {
  const catalog = new Map<string, { articleNumber: string; image: string }>();
  const spuIds = [...new Set(listings.map((item) => item.spuId).filter((id) => id > 0))];
  if (spuIds.length === 0) return catalog;

  const chunks: number[][] = [];
  for (let i = 0; i < spuIds.length; i += SPU_CHUNK) {
    chunks.push(spuIds.slice(i, i + SPU_CHUNK));
  }

  const rows = await mapWithConcurrency(chunks, 2, async (chunk) => {
    try {
      const response = await client.request(POIZON_CONSTANTS.ENDPOINTS.SKU_BY_SPU, {
        spuIds: chunk,
        region: "KR",
        language: "ko",
      });
      return asArray(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[enrichListings] by-spu failed:", msg.slice(0, 160));
      return [] as unknown[];
    }
  });

  const listingBySku = new Map(listings.map((item) => [item.sellerBiddingNo, item]));

  for (const group of rows.flat()) {
    const block = asRecord(group);
    const spuInfo = asRecord(block.spuInfo);
    const articleNumber = pickString(spuInfo, ["articleNumber", "goodsNo"]);
    const spuImage = pickString(spuInfo, ["logoUrl", "image", "imgUrl"]);
    const skus = Array.isArray(block.skuInfoList) ? block.skuInfoList : [];

    for (const listing of listingBySku.values()) {
      const sku = skus.map((row) => asRecord(row)).find((row) => skuMatchesListing(listing, row));
      if (!sku) continue;
      catalog.set(listing.sellerBiddingNo, {
        articleNumber,
        image: pickString(sku, ["logoUrl", "image", "imgUrl"]) || spuImage,
      });
    }
  }

  return catalog;
}

function minsFromRecommendData(data: unknown): { cnMin?: number; krMin?: number } {
  const rec = asRecord(data);
  const leaks = Array.isArray(rec.leakInfos) ? rec.leakInfos.map((row) => asRecord(row)) : [];
  const kr = leaks.find((row) => String(row.buyerRegion || row.region || "").toUpperCase() === "KR");
  const cnMin = Number(rec.globalMinPrice);
  const krMin = Number(kr?.leakPrice);
  return {
    cnMin: Number.isFinite(cnMin) && cnMin > 0 ? cnMin : undefined,
    krMin: Number.isFinite(krMin) && krMin > 0 ? krMin : undefined,
  };
}

async function fetchRecommendMins(
  client: PoizonClient,
  listings: ParsedListingItem[]
): Promise<Map<string, { cnMin?: number; krMin?: number }>> {
  const minsBySku = new Map<number, { cnMin?: number; krMin?: number }>();
  const uniqueBySku = [
    ...new Map(listings.filter((item) => item.skuId > 0).map((item) => [item.skuId, item])).values(),
  ];
  const results = await mapWithConcurrency(uniqueBySku, RECOMMEND_CONCURRENCY, async (item) => {
    try {
      const response = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.RECOMMEND_PRICE, {
        skuId: item.skuId,
        biddingType: item.biddingType || POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
        saleType: item.saleType,
        region: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
        currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
      });
      return { skuId: item.skuId, mins: minsFromRecommendData(asRecord(response).data ?? response) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[enrichListings] recommend failed:", item.skuId, msg.slice(0, 120));
      return { skuId: item.skuId, mins: {} };
    }
  });

  for (const row of results) {
    minsBySku.set(row.skuId, row.mins);
  }

  const mins = new Map<string, { cnMin?: number; krMin?: number }>();
  for (const item of listings) {
    const rec = minsBySku.get(item.skuId);
    if (rec) mins.set(item.sellerBiddingNo, rec);
  }
  return mins;
}

export async function enrichListingItems(
  client: PoizonClient,
  listings: ParsedListingItem[]
): Promise<ParsedListingItem[]> {
  if (listings.length === 0) return listings;

  const [catalog, mins] = await Promise.all([
    fetchCatalogBySpuIds(client, listings),
    fetchRecommendMins(client, listings),
  ]);

  return listings.map((item) => {
    const extra = catalog.get(item.sellerBiddingNo);
    const rec = mins.get(item.sellerBiddingNo);
    return {
      ...item,
      articleNumber: extra?.articleNumber || item.articleNumber,
      image: extra?.image || item.image,
      cnMinPrice: rec?.cnMin,
      krMinPrice: rec?.krMin,
    };
  });
}
