"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { fetchSkuRecommendPrice } from "@/lib/api/recommend-price";

/**
 * 단일 SKU의 현지(KR) 및 글로벌(중국) 추천 입찰가 정보를 조회합니다.
 * @param skuId Poizon DW SKU ID
 */
export async function getSkuRecommendations(skuId: string | number) {
  try {
    const client = await getPoizonClient();
    const data = await fetchSkuRecommendPrice(client, skuId);
    if (data) return { success: true, data };
    return { success: false, error: "추천 정보를 불러오지 못했습니다." };
  } catch (error: any) {
    console.error(`[getSkuRecommendations Error] SKU: ${skuId}`, error);
    return { success: false, error: error.message };
  }
}
