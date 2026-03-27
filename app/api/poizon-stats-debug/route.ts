
import { NextResponse } from 'next/server';
import { getSpuStatistics } from '@/app/actions/poizon';

export async function GET() {
  const articleNumber = "JKJJS25122";
  try {
    const { getPoizonClient } = await import('@/app/actions/poizon');
    const client = await getPoizonClient();
    const payload = { 
       articleNumber,
       region: "KR", language: "ko", 
       statisticsDataQry: { salesEnable: true, minPriceEnable: true } 
    };

    const results = {
      basic_spu: await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", payload),
      spu_stats: await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-statistics", payload).catch(e => ({ error: e.message })),
      sku_stats: await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/sku-statistics", payload).catch(e => ({ error: e.message })),
    };
    
    // Save to file
    const fs = await import('fs');
    fs.writeFileSync('/tmp/poizon_raw_debug.json', JSON.stringify(results, null, 2));

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
