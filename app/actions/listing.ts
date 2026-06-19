"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import {
  extractListingRawList,
  parseListingItem,
  type ParsedListingItem,
} from "@/lib/utils/poizon-listing";

export interface ListingFilters {
  status?: string;      // active | sold | cancelled | expired
  keyword?: string;     // 품번 또는 상품명 검색
  pageNo?: number;
  pageSize?: number;
}

export interface ListingItem extends ParsedListingItem {}

/**
 * 포이즌 API에서 내 입찰/리스팅 목록을 조회합니다.
 */
export async function getMyListings(filters: ListingFilters = {}) {
  try {
    const client = await getPoizonClient();

    const payload: Record<string, any> = {
      pageNo: filters.pageNo || 1,
      pageSize: filters.pageSize || 20,
      region: "KR",
      language: "ko",
    };

    if (filters.status) {
      payload.status = filters.status;
    }
    if (filters.keyword) {
      payload.keyword = filters.keyword;
    }

    const response = await client.request<any>(
      POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      payload
    );

    const rawList = extractListingRawList(response);
    const total = response?.data?.total || response?.total || rawList.length;
    const items: ListingItem[] = rawList.map(parseListingItem);

    return { success: true, data: items, total, raw: response };
  } catch (error: any) {
    console.error("[getMyListings] Error:", error);
    return { success: false, error: error.message, data: [], total: 0 };
  }
}

/**
 * 입찰을 취소합니다.
 */
export async function cancelBid(sellerBiddingNo: string) {
  try {
    const client = await getPoizonClient();

    const response = await client.request<any>(
      POIZON_CONSTANTS.ENDPOINTS.CANCEL_BID,
      { sellerBiddingNo }
    );

    // 로컬 DB 상태도 업데이트
    const { userId } = await auth();
    if (userId) {
      const supabase = getServiceRoleClient();
      await supabase
        .from("bid_history")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("seller_bidding_no", sellerBiddingNo);
    }

    return { success: true, data: response };
  } catch (error: any) {
    console.error("[cancelBid] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 입찰 가격을 수정합니다. (취소 → 재입찰 방식)
 */
export async function updateBidPrice(
  sellerBiddingNo: string,
  skuId: number,
  newPrice: number,
  spuId?: number
) {
  try {
    // 1. 기존 입찰 취소
    const cancelResult = await cancelBid(sellerBiddingNo);
    if (!cancelResult.success) {
      return { success: false, error: `취소 실패: ${cancelResult.error}` };
    }

    // 2. 새 가격으로 재입찰
    const { executeBidding } = await import("@/app/actions/bidding");
    const bidResult = await executeBidding([{ skuId, spuId, price: newPrice }]);

    return bidResult;
  } catch (error: any) {
    console.error("[updateBidPrice] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 로컬 DB에서 입찰 이력을 조회합니다.
 */
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

    return { success: true, data: data || [], total: count || 0 };
  } catch (error: any) {
    console.error("[getLocalBidHistory] Error:", error);
    return { success: false, error: error.message, data: [], total: 0 };
  }
}
