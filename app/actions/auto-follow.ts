"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { parseAutoFollowList, type AutoFollowRule } from "@/types/auto-follow";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getAutoFollowRules() {
  try {
    const client = await getPoizonClient();
    const response = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.AUTO_FOLLOW_LIST, {
      language: "ko",
      timeZone: "Asia/Seoul",
      region: "KR",
      pageNum: 1,
      pageSize: 50,
    });
    return { success: true as const, data: parseAutoFollowList(response) };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.warn("[getAutoFollowRules]", message.slice(0, 200));
    return { success: false as const, error: message, data: [] as AutoFollowRule[] };
  }
}

export async function submitAutoFollow(input: {
  sellerBiddingNo: string;
  lowestPrice: number;
  followType: number;
  autoSwitch: boolean;
}) {
  try {
    const sellerBiddingNo = input.sellerBiddingNo.trim();
    if (!sellerBiddingNo) return { success: false as const, error: "입찰번호가 없습니다." };
    if (!Number.isFinite(input.lowestPrice) || input.lowestPrice <= 0) {
      return { success: false as const, error: "최저가를 입력해 주세요." };
    }
    const client = await getPoizonClient();
    const response = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.AUTO_FOLLOW_SUBMIT, {
      language: "ko",
      timeZone: "Asia/Seoul",
      biddingNo: sellerBiddingNo,
      sellerBiddingNo,
      lowestPrice: input.lowestPrice,
      followType: input.followType,
      autoSwitch: input.autoSwitch,
      countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
      currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
    });
    return { success: true as const, data: response.data ?? response };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[submitAutoFollow]", message);
    return { success: false as const, error: message };
  }
}
