import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const spuId = 19498274; // JKJJS25122
    const baseQry = { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true };
    
    const payloadNoRegion = { 
       sellerStatusEnable: true, buyStatusEnable: true, language: "ko",
       statisticsDataQry: baseQry, 
       spuIds: [spuId] 
    };
    
    // global param without regional limit
    const payloadNoTZ = { 
       sellerStatusEnable: true, buyStatusEnable: true, language: "en",
       statisticsDataQry: baseQry, 
       spuIds: [spuId] 
    };

    const res1 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payloadNoRegion).catch(e => ({ error: e.message }));
    const res2 = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payloadNoTZ).catch(e => ({ error: e.message }));

    return NextResponse.json({ 
       NoRegion_Sales: res1.data?.[0]?.commoditySales || res1.error || "N/A",
       NoRegion_Price: res1.data?.[0]?.averagePrice,
       
       NoTZ_Sales: res2.data?.[0]?.commoditySales || res2.error || "N/A",
       NoTZ_Price: res2.data?.[0]?.averagePrice
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
