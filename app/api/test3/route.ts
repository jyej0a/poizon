import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  // 1. Brand Search Mock
  const spuPayload = { brandIdList: [1000444], language: "ko", region: "KR", pageNum: 1, pageSize: 1 };
  const brandRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);
  
  let results: any[] = [];
  if (Array.isArray(brandRes.data?.contents)) results = brandRes.data.contents;
  else if (Array.isArray(brandRes.contents)) results = brandRes.contents;
  
  const spuIds = results.map(i => i.spuId || i.goodsId).filter(Boolean);
  
  // 2. Stats Search Mock
  const statsPayload = { sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, spuIds };
  const statsRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", statsPayload);
  
  const statsDataArray = Array.isArray(statsRes.data) ? statsRes.data : [];
  
  return NextResponse.json({
    dumpSpuStats: statsDataArray.map(st => st.spuSaleInfo || st.spuInfo || st)
  });
}
