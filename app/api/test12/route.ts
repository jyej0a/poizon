import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const payloadZH = { 
       language: "zh", timeZone: "Asia/Shanghai", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735] 
    };

    const payloadNoRegion = { 
       language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735] 
    };

    const resZH = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payloadZH);
    const resNoRegion = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payloadNoRegion);

    return NextResponse.json({ 
       zh_hasSpuSaleInfo: !!resZH.data?.[0]?.spuSaleInfo,
       zh_dump: resZH.data?.[0]?.spuSaleInfo ? resZH.data[0].spuSaleInfo.commoditySales : "N/A",
       ko_hasSpuSaleInfo: !!resNoRegion.data?.[0]?.spuSaleInfo,
       ko_dump: resNoRegion.data?.[0]?.spuSaleInfo ? resNoRegion.data[0].spuSaleInfo.commoditySales : "N/A"
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
