/**
 * auto-follow-bidding/list 페이로드 변형 프로브.
 * 사용: pnpm tsx --env-file=.env scripts/probe-follow.ts
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

function summarizeError(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 240);
}

async function main() {
  const supabase = getServiceRoleClient();
  const { data: config } = await supabase
    .from("user_configs")
    .select("user_id")
    .not("poizon_app_key", "is", null)
    .limit(1)
    .maybeSingle();
  if (!config?.user_id) process.exit(1);
  const client = await createPoizonClientForUser(supabase, config.user_id);
  const results: Record<string, unknown> = {};

  const listBodies: { name: string; body: Record<string, unknown> }[] = [
    { name: "minimal", body: { language: "ko", timeZone: "Asia/Seoul" } },
    { name: "region", body: { language: "ko", timeZone: "Asia/Seoul", region: "KR" } },
    { name: "page_snake", body: { language: "ko", timeZone: "Asia/Seoul", page_no: 1, page_size: 20 } },
    { name: "page_camel", body: { language: "ko", timeZone: "Asia/Seoul", pageNum: 1, pageSize: 20, region: "KR" } },
    { name: "offset", body: { language: "ko", timeZone: "Asia/Seoul", exclusiveStartOffsetId: 0, pageSize: 20 } },
    { name: "biddingType", body: { language: "ko", timeZone: "Asia/Seoul", biddingType: 20, saleType: 0, region: "KR" } },
  ];

  for (const attempt of listBodies) {
    try {
      const response = await client.request<Record<string, unknown>>(
        POIZON_CONSTANTS.ENDPOINTS.AUTO_FOLLOW_LIST,
        attempt.body
      );
      results[`list:${attempt.name}`] = { ok: true, keys: collectKeys(response), data: response.data ?? response };
      break;
    } catch (err) {
      results[`list:${attempt.name}`] = { ok: false, error: summarizeError(err) };
    }
  }

  const extraPaths = [
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/close",
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/stop",
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/delete",
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/cancel-bidding",
  ];
  for (const path of extraPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        biddingNo: "0",
        sellerBiddingNo: "0",
      });
      results[`extra:${path}`] = { ok: true, data: response.data ?? response };
    } catch (err) {
      results[`extra:${path}`] = { ok: false, error: summarizeError(err) };
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
