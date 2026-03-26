import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  const fetchStats = async (ids: number[]) => {
    const payload = {
       sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: ids
    };
    const res = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payload).catch(e => ({ error: e.message }));
    if (res.error) return res.error;
    
    // Check what is returned
    const mapping = res.data?.map((item: any) => ({
      passedSpuId: item.spuId || item.spuSaleInfo?.spuId,
      hasSpuSaleInfo: !!item.spuSaleInfo,
      globalSoldNum30: item.spuSaleInfo?.commoditySales?.globalSoldNum30 ?? "N/A"
    }));
    return mapping;
  };

  try {
    const case1 = await fetchStats([32226735]);
    const case2 = await fetchStats([17050836]);
    const case3 = await fetchStats([32226735, 17050836]);

    return NextResponse.json({
      "Case1_[32226735]": case1,
      "Case2_[17050836]": case2,
      "Case3_[32226735_17050836]": case3
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
