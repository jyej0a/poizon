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
    const regions = ["HK", "MO", "TW", "JP", "US", "SG", "MY"];
    const results: any = {};

    for (const r of regions) {
       const payload = { 
          sellerStatusEnable: true, buyStatusEnable: true, region: r, language: "ko", timeZone: "Asia/Seoul", 
          statisticsDataQry: baseQry, 
          spuIds: [spuId] 
       };
       const res = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payload).catch(e => ({ error: e.message }));
       
       results[r] = {
         globalSales: res.data?.[0]?.commoditySales?.globalSoldNum30 ?? "N/A",
         localSales: res.data?.[0]?.commoditySales?.localSoldNum30 ?? "N/A",
         avgPrice: res.data?.[0]?.averagePrice?.globalAveragePriceVO?.amountText ?? "N/A"
       };
    }

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
