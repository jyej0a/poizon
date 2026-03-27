import { NextResponse } from 'next/server';
import { PoizonClient } from '@/lib/api/poizon';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient({ appKey: config.poizon_app_key, appSecret: config.poizon_app_secret });

  try {
    const response = await client.request<any>(
        "/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-article-number", 
        {
          articleNumber: "JKJJS25122", 
          region: "KR",
          sellerStatusEnable: false,
          buyStatusEnable: false
        }
    );
    return NextResponse.json({
      res: response,
      keys: Object.keys(response.data || {}),
      isArray: Array.isArray(response.data)
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
