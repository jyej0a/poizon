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
  const startedAt = Date.now();
  // #region agent log
  fetch('http://127.0.0.1:7677/ingest/0db270c0-8dd8-43f3-a04b-0540fc890915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c4e436'},body:JSON.stringify({sessionId:'c4e436',location:'recommendations.ts:getSkuRecommendations:entry',message:'server action started',data:{skuId:String(skuId),region,currency},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  try {
    const client = await getPoizonClient();
    // #region agent log
    fetch('http://127.0.0.1:7677/ingest/0db270c0-8dd8-43f3-a04b-0540fc890915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c4e436'},body:JSON.stringify({sessionId:'c4e436',location:'recommendations.ts:getSkuRecommendations:afterClient',message:'getPoizonClient ok',data:{skuId:String(skuId),elapsedMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    const payload = {
      skuId: Number(skuId),
      biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
      saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
      region: region,
      currency: currency
    };

    const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.RECOMMEND_PRICE, payload);

    if (response && response.code === 200) {
      // #region agent log
      fetch('http://127.0.0.1:7677/ingest/0db270c0-8dd8-43f3-a04b-0540fc890915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c4e436'},body:JSON.stringify({sessionId:'c4e436',location:'recommendations.ts:getSkuRecommendations:success',message:'server action success',data:{skuId:String(skuId),elapsedMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      return { success: true, data: response.data };
    } else {
      console.warn(`[getSkuRecommendations Warn] SKU: ${skuId}`, response);
      // #region agent log
      fetch('http://127.0.0.1:7677/ingest/0db270c0-8dd8-43f3-a04b-0540fc890915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c4e436'},body:JSON.stringify({sessionId:'c4e436',location:'recommendations.ts:getSkuRecommendations:businessFail',message:'poizon business error',data:{skuId:String(skuId),code:response?.code,msg:response?.msg,elapsedMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { success: false, error: response?.msg || "추천 정보를 불러오지 못했습니다." };
    }
  } catch (error: any) {
    console.error(`[getSkuRecommendations Error] SKU: ${skuId}`, error);
    // #region agent log
    fetch('http://127.0.0.1:7677/ingest/0db270c0-8dd8-43f3-a04b-0540fc890915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c4e436'},body:JSON.stringify({sessionId:'c4e436',location:'recommendations.ts:getSkuRecommendations:catch',message:'server action error',data:{skuId:String(skuId),error:error?.message,elapsedMs:Date.now()-startedAt},timestamp:Date.now(),hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    return { success: false, error: error.message };
  }
}
