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
       spuIds: [32226735] 
    };

    const resSku = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payload);
    const resSpu = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payload);

    return NextResponse.json({ 
       skuEndpoint_Keys: resSku.data?.[0] ? Object.keys(resSku.data[0]) : "FAILED",
       skuEndpoint_HasRootCommodity: !!resSku.data?.[0]?.commoditySales,
       skuEndpoint_SalesVolume: resSku.data?.[0]?.commoditySales?.globalSoldNum30 ?? resSku.data?.[0]?.spuSaleInfo?.commoditySales?.globalSoldNum30 ?? "N/A",

       spuEndpoint_Keys: resSpu.data?.[0] ? Object.keys(resSpu.data[0]) : "FAILED",
       spuEndpoint_HasRootCommodity: !!resSpu.data?.[0]?.commoditySales,
       spuEndpoint_SalesVolume: resSpu.data?.[0]?.commoditySales?.globalSoldNum30 ?? resSpu.data?.[0]?.spuSaleInfo?.commoditySales?.globalSoldNum30 ?? "N/A"
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
