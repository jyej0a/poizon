import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { PoizonClient } from '@/lib/api/poizon';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();

  if (!config) return NextResponse.json({ error: "No config" });

  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });
  const brandId = 1000444; // 코오롱스포츠
  const testRegions = [
    { language: "ko", region: "KR" },
    { language: "ko", region: "US" },
    { language: "en", region: "GLOBAL" },
    { language: "ko" }, // region 생략
    { language: "en" }
  ];

  const results: any = {};

  for (const params of testRegions) {
    const key = JSON.stringify(params);
    try {
      const spuPayload = {
        brandIdList: [brandId],
        pageNum: 1,
        pageSize: 3,
        ...params
      };
      const spuRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);
      
      const count = Array.isArray(spuRes?.data?.contents) ? spuRes.data.contents.length : 
                    Array.isArray(spuRes?.contents) ? spuRes.contents.length : 
                    Array.isArray(spuRes?.data?.list) ? spuRes.data.list.length : 0;
                    
      results[key] = { count, raw: spuRes?.data || spuRes };
    } catch (e: any) {
      results[key] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}
