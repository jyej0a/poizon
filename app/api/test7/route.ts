import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    // Variations of stats payload to see what triggers commoditySales
    const payload1 = { 
       region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true }, 
       spuIds: [32226735] 
    };

    const payload2 = { 
       // No region restriction
       language: "zh", timeZone: "Asia/Shanghai", 
       statisticsDataQry: { salesEnable: true }, 
       spuIds: [32226735] 
    };
    
    const payload3 = {
       sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735]
    };

    const res1 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payload1).catch(e => e.message);
    const res2 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payload2).catch(e => e.message);
    const res3 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payload3).catch(e => e.message);

    return NextResponse.json({ 
       res1: res1?.data?.[0]?.spuSaleInfo ? "HAS spuSaleInfo" : res1,
       res2: res2?.data?.[0]?.spuSaleInfo ? "HAS spuSaleInfo" : res2,
       res3: res3?.data?.[0]?.spuSaleInfo ? "HAS spuSaleInfo" : res3,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
