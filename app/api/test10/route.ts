import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const payload = { 
       sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735, 17050836] 
    };

    const resUrl1 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payload).catch(e => ({ error: e.message }));
    const resUrl2 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-statistics", payload).catch(e => ({ error: e.message }));
    const resUrl3 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/sku-statistics", payload).catch(e => ({ error: e.message }));

    return NextResponse.json({ 
       spuBasicInfo: Object.keys(resUrl1.data?.[0] || resUrl1),
       spuBasicInfoStats: resUrl1.data?.[0]?.spuSaleInfo?.commoditySales || "N/A",
       spuStatistics: resUrl2.error || resUrl2,
       skuStatistics: resUrl3.error || resUrl3
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
