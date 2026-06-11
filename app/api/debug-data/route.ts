import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
    if (!config) return NextResponse.json({ error: "No config" }, { status: 500 });

    const client = new PoizonClient({
      appKey: config.poizon_app_key,
      appSecret: config.poizon_app_secret,
      accessToken: config.poizon_access_token
    });

    const keyword = "TLTCM26601";
    const spuId = 36774957;
    const sku95 = 1067515046;
    const sku100 = 1067515047;

    const results: any = {
      description: "Final deep search for 8 and 12 in KR region data",
      matches: { sku95_8: [], sku100_12: [], search_list_matches: [] }
    };

    // 재귀 검색 함수
    function deepSearch(obj: any, target: number, path: string = ""): string[] {
      const paths: string[] = [];
      if (!obj || typeof obj !== 'object') return paths;
      for (const key in obj) {
        const val = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        if (val === target) paths.push(currentPath);
        else if (typeof val === 'object') paths.push(...deepSearch(val, target, currentPath));
      }
      return paths;
    }

    // 1. 검색 목록 (Search List) 결과부터 확인 (가장 가벼움)
    const searchRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-article-number", {
      articleNumber: keyword,
      region: "KR",
      language: "ko"
    });
    results.matches.search_list_matches.push(...deepSearch(searchRes, 8));
    results.matches.search_list_matches.push(...deepSearch(searchRes, 12));

    await new Promise(r => setTimeout(r, 3000));

    // 2. 상세 통계 확인
    const statsRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu-ids", {
      spuIds: [spuId],
      region: "KR",
      language: "ko",
      statisticsDataQry: { salesEnable: true, minPriceEnable: true, bidStatusEnable: true }
    });

    if (statsRes.data?.[0]) {
      const skus = statsRes.data[0].skuInfoList || statsRes.data[0].skuSaleInfos || [];
      const s95 = skus.find((s: any) => s.skuId === sku95);
      const s100 = skus.find((s: any) => s.skuId === sku100);
      if (s95) results.matches.sku95_8.push(...deepSearch(s95, 8));
      if (s100) results.matches.sku100_12.push(...deepSearch(s100, 12));
    }

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
