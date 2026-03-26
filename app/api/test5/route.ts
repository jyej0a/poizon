import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const spuPayload = { brandIdList: [1000444], language: "ko", region: "KR", pageNum: 1, pageSize: 2 };
    const brandRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);
    
    let results: any[] = [];
    if (Array.isArray(brandRes.data?.contents)) results = brandRes.data.contents;
    else if (Array.isArray(brandRes.contents)) results = brandRes.contents;
    
    const spuIds = results.map(i => Number(i.spuId || i.goodsId)).filter(id => !isNaN(id));
    
    const statsPayload = { sellerStatusEnable: true, buyStatusEnable: true, region: "KR", language: "ko", timeZone: "Asia/Seoul", statisticsDataQry: { salesEnable: true, minPriceEnable: true, customCodeEnable: true, bidStatusEnable: true, applySourceEnable: true, channelInfoEnable: true, forFilingEnable: true }, spuIds };
    const statsRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", statsPayload);
    
    const statsMap = new Map();
    for (const statItem of statsRes.data) {
       const spuData = statItem.spuSaleInfo || statItem.spuInfo || statItem;
       const sId = Number(spuData?.spuId || spuData?.goodsId);
       if (sId) statsMap.set(sId, statItem);
    }
    
    results = results.map(item => {
       const sId = Number(item.spuId || item.goodsId);
       const st = statsMap.get(sId);
       return {
          ...item,
          skuStats: st?.skuInfoList || st?.skuSaleInfos || [],
          spuStats: st?.spuSaleInfo || st?.spuInfo || {}
       };
    });

    const debugLogs: any[] = [];

    // Simulate parseAndPushItem
    for (const rawData of results) {
       let apiData = rawData.data || rawData;
       if (Array.isArray(apiData)) apiData = apiData[0] || {};
       
       const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
       
       const salesVolume = rawData.spuStats?.commoditySales?.globalSoldNum30 ?? rawData.spuStats?.salesAmount ?? rawData.spuStats?.transactionVolume ?? "-";
       const minPrice = rawData.spuStats?.marketPrice?.globalMarketPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.globalMinPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.price ?? "-";
                
       debugLogs.push({
          spuId: spuInfo.spuId,
          rawDataSpuStats: rawData.spuStats,
          salesVolumeEval: salesVolume,
          minPriceEval: minPrice,
       });
    }

    return NextResponse.json({ debugLogs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
