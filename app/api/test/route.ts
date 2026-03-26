import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { PoizonClient } from '@/lib/api/poizon';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();

  if (!config) return NextResponse.json({ error: "No config" });

  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });
  
  const testQueries = ["Nike", "kolonSports", "코오롱", "나이키"];
  const results: any = {};

  for (const q of testQueries) {
    try {
      // 1. name search (언어: ko, en 둘다)
      const resKo = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name", {
        name: q, language: "ko", exactMatch: false, pageSize: 5, pageNum: 1
      });
      const resEn = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name", {
        name: q, language: "en", exactMatch: false, pageSize: 5, pageNum: 1
      });

      results[q] = { ko: resKo, en: resEn };
    } catch (e: any) {
      results[q] = { error: e.message };
    }
  }

  return NextResponse.json(results);
}
