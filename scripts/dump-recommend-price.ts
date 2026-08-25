/**
 * 추천 입찰가 API(`recommend-bid/price`) 원시 응답 덤프.
 *
 * 사용:
 *   pnpm tsx --env-file=.env scripts/dump-recommend-price.ts
 *   pnpm tsx --env-file=.env scripts/dump-recommend-price.ts 1079098338
 *   pnpm tsx --env-file=.env scripts/dump-recommend-price.ts --articles=TLTCM26521,CW2288-111
 *
 * 자격증명은 `user_configs` 첫 행.
 */

import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";
import { fetchItemByArticleNumber } from "@/lib/api/poizon-search";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { PoizonClient } from "@/lib/api/poizon";

/** 문서 §8.2 재현 품번 TLTCM26521 블랙 KR100 */
const DEFAULT_SKU_ID = 1079098338;

function collectKeys(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return prefix ? [`${prefix}[]`] : [];
    return collectKeys(value[0], `${prefix}[]`);
  }
  const keys: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    keys.push(...collectKeys(child, path));
  }
  return keys;
}

function extractSkuIds(raw: any): number[] {
  let apiData = raw?.data || raw;
  if (Array.isArray(apiData)) apiData = apiData[0] || {};
  const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
  const list = apiData.skuInfoList || apiData.skuList || apiData.skus || spuInfo.skuList || [];
  return list
    .map((sku: any) => Number(sku.dwSkuId || sku.skuId || sku.regionSkuId))
    .filter((id: number) => Number.isFinite(id) && id > 0);
}

async function dumpSku(client: PoizonClient, skuId: number) {
  const payload = {
    skuId,
    biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
    region: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
  };
  const response = await client.request<Record<string, unknown>>(
    POIZON_CONSTANTS.ENDPOINTS.RECOMMEND_PRICE,
    payload
  );
  const data = (response?.data ?? {}) as Record<string, any>;
  const leak = data.leakInfos?.find(
    (row: any) => row.buyerRegion === "CN" || row.region === "CN"
  )?.leakPrice;
  return {
    skuId,
    leak,
    globalMinPrice: data.globalMinPrice,
    asiaMinPrice: data.asiaMinPrice,
    effectiveExposurePrice: data.effectiveExposurePrice,
    leakEqGlobal: leak === data.globalMinPrice,
    response,
  };
}

async function main() {
  const articleArg = process.argv.find((arg) => arg.startsWith("--articles="));
  const articles = articleArg
    ? articleArg
        .slice("--articles=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const skuArg = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  const skuId = skuArg ? Number(skuArg) : DEFAULT_SKU_ID;

  const supabase = getServiceRoleClient();
  const { data: config, error } = await supabase
    .from("user_configs")
    .select("user_id")
    .not("poizon_app_key", "is", null)
    .limit(1)
    .maybeSingle();

  if (error || !config?.user_id) {
    console.error("user_configs에서 POIZON 자격증명을 찾지 못했습니다.", error?.message);
    process.exit(1);
  }

  const client = await createPoizonClientForUser(supabase, config.user_id);

  if (articles.length > 0) {
    const rows: unknown[] = [];
    for (const article of articles) {
      const res = await fetchItemByArticleNumber(client, article);
      const allIds = extractSkuIds(res.data ?? res);
      const samples = [];
      for (const id of allIds.slice(0, 4)) {
        try {
          const dump = await dumpSku(client, id);
          samples.push({
            skuId: dump.skuId,
            leak: dump.leak,
            globalMinPrice: dump.globalMinPrice,
            asiaMinPrice: dump.asiaMinPrice,
            effectiveExposurePrice: dump.effectiveExposurePrice,
            leakEqGlobal: dump.leakEqGlobal,
          });
        } catch (error) {
          samples.push({
            skuId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      rows.push({ article, skuCount: allIds.length, samples });
    }
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  if (!Number.isFinite(skuId) || skuId <= 0) {
    console.error("skuId가 올바르지 않습니다.");
    process.exit(2);
  }

  const dump = await dumpSku(client, skuId);
  process.stdout.write(
    JSON.stringify(
      {
        skuId: dump.skuId,
        keyPaths: collectKeys(dump.response),
        summary: {
          leak: dump.leak,
          globalMinPrice: dump.globalMinPrice,
          asiaMinPrice: dump.asiaMinPrice,
          effectiveExposurePrice: dump.effectiveExposurePrice,
          leakEqGlobal: dump.leakEqGlobal,
        },
        response: dump.response,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
