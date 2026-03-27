import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { POIZON_CONSTANTS } from '@/lib/constants/poizon';
import crypto from 'crypto';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  
  if (!config) {
    return NextResponse.json({ error: "No config found" });
  }

  const client = new PoizonClient({ 
    appKey: config.poizon_app_key, 
    appSecret: config.poizon_app_secret 
  });

  try {
    // 가장 흔한 오류나 명세 제한을 유도하기 위해 극단적으로 낮은 가격(100원)으로 테스트
    const payload = {
      requestId: crypto.randomUUID(),
      skuId: 843559215, // JKJJS25122 Black XS or similar SKU
      price: 100, // 터무니없는 가격으로 거절 응답 유도
      quantity: 1,
      countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
      deliveryCountryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
      currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
      sizeType: POIZON_CONSTANTS.BIDDING.DEFAULT_SIZE_TYPE,
      biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
      saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE
    };

    console.log("[Test-Bid] Sending Payload:", payload);

    const response = await client.request<any>(
        POIZON_CONSTANTS.ENDPOINTS.SUBMIT_BID, 
        payload
    );
    
    return NextResponse.json({
      payloadSent: payload,
      poizonResponse: response,
      keys: Object.keys(response || {}),
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: "Exception occurred", 
      message: e.message,
      stack: e.stack
    });
  }
}
