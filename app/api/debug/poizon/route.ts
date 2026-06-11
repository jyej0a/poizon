import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { PoizonClient } from "@/lib/api/poizon";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
    
    if (!config) {
      return NextResponse.json({ error: "No user config found" });
    }

    const client = new PoizonClient({
      appKey: config.poizon_app_key,
      appSecret: config.poizon_app_secret,
    });

    const spuId = 36774957;

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

    const skuRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", {
      ...basePayload,
      spuIds: [spuId]
    }).catch(e => e.message);

    const skuId = 1067515046;
    const recRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/recommend-bidding", {
      skuIds: [skuId],
      region: "KR"
    }).catch(e => e.message);

    return NextResponse.json({ skuRes, recRes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

