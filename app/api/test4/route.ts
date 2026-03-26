import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const spuPayload = { brandIdList: [1000444], language: "ko", region: "KR", pageNum: 1, pageSize: 20 };
    const brandRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);
    
    let results: any[] = [];
    if (Array.isArray(brandRes.data?.contents)) results = brandRes.data.contents;
    else if (Array.isArray(brandRes.contents)) results = brandRes.contents;
    
    // Simulate 100 items by duplicating
    if (results.length > 0) {
      const original = [...results];
      while (results.length < 100) {
        results = results.concat(original);
      }
      results = results.slice(0, 100);
    }
    
    // Extract spuIds
    const spuIds = results.map(i => Number(i.spuId || i.goodsId)).filter(id => !isNaN(id));
    
    // Chunking logic exactly like getSpuStatistics
    const numericSpuIds = spuIds;
    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < numericSpuIds.length; i += chunkSize) {
      chunks.push(numericSpuIds.slice(i, i + chunkSize));
    }

    const basePayload = {
      sellerStatusEnable: true,
      buyStatusEnable: true,
      region: "KR",
      language: "ko",
      timeZone: "Asia/Seoul",
      statisticsDataQry: {
        salesEnable: true,
        minPriceEnable: true,
        customCodeEnable: true,
        bidStatusEnable: true,
        applySourceEnable: true,
        channelInfoEnable: true,
        forFilingEnable: true
      }
    };

    let errorCount = 0;
    const promises = chunks.map(chunk => 
      client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", {
        ...basePayload,
        spuIds: chunk
      }).catch(err => {
        errorCount++;
        return null;
      })
    );

    const statsResults = await Promise.all(promises);
    
    let mergedData: any[] = [];
    let nullCount = 0;
    
    for (const res of statsResults) {
      if (!res) {
        nullCount++;
        continue;
      }
      const resData = Array.isArray(res?.data?.data) ? res.data.data :
                      Array.isArray(res?.data) ? res.data :
                      Array.isArray(res?.contents) ? res.contents : [];
                      
      mergedData = [...mergedData, ...resData];
    }
    
    return NextResponse.json({ 
       requestedSpus: spuIds.length,
       totalChunks: chunks.length,
       errorsCaught: errorCount,
       nullResponses: nullCount,
       totalMergedStats: mergedData.length,
       sampleMergedData: mergedData.slice(0, 2).map(m => m.spuSaleInfo || m.spuInfo || m)
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
