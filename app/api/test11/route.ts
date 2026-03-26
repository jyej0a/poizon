import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const payloadMulti = { 
       sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735, 17050836] 
    };

    const payloadSingle = { 
       sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, 
       spuIds: [32226735] 
    };

    const resMulti = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payloadMulti);
    const resSingle = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", payloadSingle);

    return NextResponse.json({ 
       multi_hasSpuSaleInfo: !!resMulti.data?.[0]?.spuSaleInfo,
       multi_hasSpuInfo: !!resMulti.data?.[0]?.spuInfo,
       multi_arrayLength: resMulti.data?.length,
       
       single_hasSpuSaleInfo: !!resSingle.data?.[0]?.spuSaleInfo,
       single_hasSpuInfo: !!resSingle.data?.[0]?.spuInfo,
       single_arrayLength: resSingle.data?.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
