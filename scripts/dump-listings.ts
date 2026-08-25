/**
 * 입찰 목록 API(`retrieve-bid/general-type-bidding-list`) 원시 응답 덤프.
 *
 * 사용: pnpm dump:listings
 */

import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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

async function main() {
  const supabase = getServiceRoleClient();
  const { data: config, error } = await supabase
    .from("user_configs")
    .select("user_id")
    .not("poizon_app_key", "is", null)
    .limit(1)
    .maybeSingle();
  if (error || !config?.user_id) {
    console.error("자격증명 없음", error?.message);
    process.exit(1);
  }
  const client = await createPoizonClientForUser(supabase, config.user_id);
  const results: Record<string, unknown> = {};

  const attempts: { name: string; path: string; body: Record<string, unknown> }[] = [
    {
      name: "active",
      path: POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      body: {
        language: "ko",
        timeZone: "Asia/Seoul",
        region: "KR",
        biddingType: 20,
        saleType: 0,
        tradeStatus: 2,
        exclusiveStartOffsetId: 0,
        pageSize: 20,
      },
    },
    {
      name: "cancelled",
      path: POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      body: {
        language: "ko",
        timeZone: "Asia/Seoul",
        region: "KR",
        tradeStatus: 1,
        exclusiveStartOffsetId: 0,
        pageSize: 5,
      },
    },
    {
      name: "sold_out",
      path: POIZON_CONSTANTS.ENDPOINTS.LISTING_LIST,
      body: {
        language: "ko",
        timeZone: "Asia/Seoul",
        region: "KR",
        tradeStatus: 3,
        exclusiveStartOffsetId: 0,
        pageSize: 5,
      },
    },
    {
      name: "legacy_listing_list",
      path: "/dop/api/v1/pop/api/v1/listing/list",
      body: { pageNo: 1, pageSize: 20, region: "KR", language: "ko" },
    },
  ];

  for (const attempt of attempts) {
    try {
      const response = await client.request<Record<string, unknown>>(attempt.path, attempt.body);
      const data = (response as { data?: unknown }).data ?? response;
      results[attempt.name] = {
        ok: true,
        keyPaths: collectKeys(response),
        sample: data,
      };
    } catch (err) {
      results[attempt.name] = {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 400) : String(err),
      };
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
