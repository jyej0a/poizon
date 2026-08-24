"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";

/**
 * 단일 SKU의 현지(KR) 및 글로벌(중국) 추천 입찰가 정보를 조회합니다.
 * @param skuId Poizon DW SKU ID
 * @param region 판매자 발송 지역 (기본: "KR")
 * @param currency 통화 단위 (기본: "KRW")
 */
export async function getSkuRecommendations(skuId: string | number, region = "KR", currency = "KRW") {
  try {
    const client = await getPoizonClient();

    const payload = {
      skuId: Number(skuId),
      biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
      saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
      region: region,
      currency: currency
    };

    const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.RECOMMEND_PRICE, payload);

    if (response && response.code === 200) {
      return { success: true, data: response.data };
    } else {
      console.warn(`[getSkuRecommendations Warn] SKU: ${skuId}`, response);
      return { success: false, error: response?.msg || "추천 정보를 불러오지 못했습니다." };
    }
  } catch (error: any) {
    console.error(`[getSkuRecommendations Error] SKU: ${skuId}`, error);
    return { success: false, error: error.message };
  }
}
