import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const statsPayload = { 
       sellerStatusEnable: true, 
       buyStatusEnable: true, 
       region: "KR", 
       language: "ko", 
       timeZone: "Asia/Seoul", 
       statisticsDataQry: { 
          salesEnable: true, 
          minPriceEnable: true, 
          customCodeEnable: true, 
          bidStatusEnable: true, 
          applySourceEnable: true, 
          channelInfoEnable: true, 
          forFilingEnable: true 
       }, 
       spuIds: [32226735] 
    };
    const statsRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", statsPayload);
    
    return NextResponse.json(statsRes);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
