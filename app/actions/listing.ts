"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import {
  extractListingLastOffsetId,
  extractListingRawList,
  listingListPayload,
  parseListingItem,
} from "@/lib/utils/poizon-listing";
import { enrichListingItems } from "@/lib/utils/listing-enrich";
import { canEditListing, type ParsedListingItem } from "@/types/poizon-listing";

export type ListingItem = ParsedListingItem;

export interface ListingFilters {
  tradeStatus: number;
  exclusiveStartOffsetId?: number;
  pageSize?: number;
  sellerBiddingNo?: string;
}

export interface ListingListResult {
  success: true;
  data: ListingItem[];
  lastOffsetId: number;
  hasMore: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingEndpoint(error: unknown): boolean {
  const msg = errorMessage(error);
  return msg.includes('"status":404') || msg.includes("前方拥挤");
}

type UpdateBidResult = {
  success: boolean;
  error?: string;
  message?: string;
  data?: unknown;
};

function failUpdate(error: string): UpdateBidResult {
  return { success: false, error };
}

function okUpdate(message: string, data?: unknown): UpdateBidResult {
  return { success: true, message, data };
}

export async function getMyListings(filters: ListingFilters) {
  try {
    const client = await getPoizonClient();
    const pageSize = filters.pageSize || 20;
    const exclusiveStartOffsetId = filters.exclusiveStartOffsetId ?? 0;
    const response = await client.request<Record<string, unknown>>(
      POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      listingListPayload({
        tradeStatus: filters.tradeStatus,
        exclusiveStartOffsetId,
        pageSize,
        sellerBiddingNo: filters.sellerBiddingNo,
      })
    );

    const items = extractListingRawList(response).map(parseListingItem);
    const lastOffsetId = extractListingLastOffsetId(response);
    let enriched = items;
    try {
      enriched = await enrichListingItems(client, items);
    } catch (error: unknown) {
      console.warn("[getMyListings] enrich failed:", errorMessage(error).slice(0, 200));
    }
    return {
      success: true as const,
      data: enriched,
      lastOffsetId,
      hasMore: items.length >= pageSize && lastOffsetId > exclusiveStartOffsetId,
    };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[getMyListings]", message);
    return { success: false as const, error: message, data: [] as ListingItem[], lastOffsetId: 0, hasMore: false };
  }
}

export async function cancelBid(sellerBiddingNo: string) {
  try {
    const client = await getPoizonClient();
    const response = await client.request<unknown>(POIZON_CONSTANTS.ENDPOINTS.CANCEL_BID, {
      sellerBiddingNo,
    });

    const { userId } = await auth();
    if (userId) {
      const supabase = getServiceRoleClient();
      await supabase
        .from("bid_history")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("seller_bidding_no", sellerBiddingNo);
    }

    return { success: true as const, data: response };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[cancelBid]", message);
    return { success: false as const, error: message };
  }
}

async function updateBidViaOfficialApi(
  sellerBiddingNo: string,
  skuId: number,
  newPrice: number,
  quantity: number
) {
  const client = await getPoizonClient();
  const response = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.UPDATE_BID, {
    requestId: crypto.randomUUID(),
    sellerBiddingNo,
    skuId,
    price: newPrice,
    quantity,
    countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    deliveryCountryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
    sizeType: POIZON_CONSTANTS.BIDDING.DEFAULT_SIZE_TYPE,
    biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
  });
  return response;
}

async function updateBidByCancelAndResubmit(
  sellerBiddingNo: string,
  skuId: number,
  newPrice: number,
  spuId?: number
): Promise<UpdateBidResult> {
  const cancelResult = await cancelBid(sellerBiddingNo);
  if (!cancelResult.success) {
    return failUpdate(`취소 실패: ${cancelResult.error}`);
  }
  const { executeBidding } = await import("@/app/actions/bidding");
  const bidResult = await executeBidding([{ skuId, spuId, price: newPrice }]);
  const first = bidResult.data?.[0];
  if (!bidResult.success) {
    return failUpdate(first?.message || bidResult.error || "가격 변경 재입찰 실패");
  }
  return okUpdate(first?.message || "가격 변경 재입찰 성공", first?.data ?? bidResult.data);
}

/**
 * 입찰 가격을 수정합니다. 공식 update-bid를 쓰고, 엔드포인트가 없으면 취소→재입찰로 폴백합니다.
 */
export async function updateBidPrice(
  sellerBiddingNo: string,
  skuId: number,
  newPrice: number,
  spuId?: number,
  quantity = 1
): Promise<UpdateBidResult> {
  if (!sellerBiddingNo) return failUpdate("입찰 번호가 없습니다.");
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return failUpdate("유효한 가격을 입력해 주세요.");
  }

  try {
    const response = await updateBidViaOfficialApi(
      sellerBiddingNo,
      skuId,
      newPrice,
      Math.max(1, Math.round(quantity))
    );

    const { userId } = await auth();
    if (userId) {
      const supabase = getServiceRoleClient();
      await supabase
        .from("bid_history")
        .update({ bid_price: newPrice, updated_at: new Date().toISOString() })
        .eq("seller_bidding_no", sellerBiddingNo);
    }

    return okUpdate("가격을 수정했습니다.", response?.data ?? response);
  } catch (error: unknown) {
    if (isMissingEndpoint(error)) {
      console.warn("[updateBidPrice] official update missing, fallback cancel+resubmit");
      return updateBidByCancelAndResubmit(sellerBiddingNo, skuId, newPrice, spuId);
    }
    const message = errorMessage(error);
    console.error("[updateBidPrice]", message);
    return failUpdate(message);
  }
}

export async function updateSelectedListingPrices(
  items: { sellerBiddingNo: string; skuId: number; spuId?: number; quantity?: number; tradeStatus: number; newPrice: number }[]
) {
  const results: { sellerBiddingNo: string; success: boolean; error?: string }[] = [];
  for (const item of items) {
    if (!canEditListing(item.tradeStatus)) {
      results.push({ sellerBiddingNo: item.sellerBiddingNo, success: false, error: "수정할 수 없는 상태입니다." });
      continue;
    }
    const result = await updateBidPrice(
      item.sellerBiddingNo,
      item.skuId,
      item.newPrice,
      item.spuId,
      item.quantity
    );
    results.push({
      sellerBiddingNo: item.sellerBiddingNo,
      success: !!result.success,
      error: result.success ? undefined : result.error,
    });
  }
  const failed = results.filter((row) => !row.success).length;
  return {
    success: failed === 0,
    failed,
    total: results.length,
    results,
    error: failed ? `${failed}/${results.length}건 실패` : undefined,
  };
}

export async function getLocalBidHistory(page = 1, pageSize = 20) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const supabase = getServiceRoleClient();
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!user) throw new Error("사용자 정보를 찾을 수 없습니다.");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("bid_history")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return { success: true as const, data: data || [], total: count || 0 };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[getLocalBidHistory]", message);
    return { success: false as const, error: message, data: [] as Record<string, unknown>[], total: 0 };
  }
}
