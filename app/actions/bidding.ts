"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";

export interface BidPayload {
  skuId: string | number;
  spuId?: string | number;
  price: number;
}

export async function executeBidding(bids: BidPayload[]) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const supabase = getServiceRoleClient();
    const { data: user } = await supabase.from("users").select("id").eq("clerk_id", userId).single();
    if (!user) throw new Error("사용자 정보를 찾을 수 없습니다.");

    const { data: configData } = await supabase
      .from("user_configs")
      .select("poizon_app_key, poizon_app_secret, poizon_access_token")
      .eq("user_id", user.id)
      .single();

    if (!configData?.poizon_app_key || !configData?.poizon_app_secret) {
      throw new Error("Poizon API Key가 등록되지 않았습니다.");
    }

    const client = new PoizonClient({
      appKey: configData.poizon_app_key,
      appSecret: configData.poizon_app_secret,
      // access_token은 Optional - 있으면 포함, 없어도 입찰 시도
      ...(configData.poizon_access_token ? { accessToken: configData.poizon_access_token } : {}),
    });

    const results = [];
    for (const bid of bids) {
      const payload = {
        requestId: crypto.randomUUID(),
        skuId: Number(bid.skuId),
        price: Number(bid.price),
        quantity: 1,
        countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
        deliveryCountryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
        currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
        sizeType: POIZON_CONSTANTS.BIDDING.DEFAULT_SIZE_TYPE,
        biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
        saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE
      };

      try {
        console.log(`[Bidding DEBUG] 실제 전송 payload:`, JSON.stringify(payload, null, 2));
        const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SUBMIT_BID, payload);
        
        // 포이즌 API는 내부적으로 code: 200이 성공을 의미함. (클라이언트에서 예외를 던지지 않을 경우 대비)
        if (response && response.code === 200) {
          console.log(`[Bidding Success / Real] SKU: ${bid.skuId}, Price: ${bid.price}`);
          results.push({
            skuId: bid.skuId,
            success: true,
            data: response.data,
            message: "입찰 성공"
          });
        } else {
          console.warn(`[Bidding Partial Fail] SKU: ${bid.skuId}`, response);
          results.push({
            skuId: bid.skuId,
            success: false,
            message: response?.msg || "응답 처리 실패"
          });
        }
      } catch (err: any) {
        console.error(`[Bidding Exception] SKU: ${bid.skuId}`, err);
        results.push({
          skuId: bid.skuId,
          success: false,
          message: err.message
        });
      }
    }

    // 통신 결과 종합 평가 (단건이라도 실패 시 false 반환 경고)
    const allSuccess = results.every(r => r.success);
    return { 
      success: allSuccess, 
      data: results, 
      error: allSuccess ? undefined : "일부 또는 전체 입찰이 실패했습니다. 결과를 확인하세요." 
    };
  } catch (error: any) {
    console.error("Execute Bidding Error:", error);
    return { success: false, error: error.message };
  }
}
