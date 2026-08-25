/**
 * 주문 목록 API(`order/generic_list`) 원시 응답 덤프.
 *
 * 사용: pnpm tsx --env-file=.env scripts/dump-orders.ts
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

function formatWindow(end = new Date(), days = 7) {
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  return { start_created: fmt(start), end_created: fmt(end) };
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
    console.error("user_configs에서 POIZON 자격증명을 찾지 못했습니다.", error?.message);
    process.exit(1);
  }

  const client = await createPoizonClientForUser(supabase, config.user_id);
  const window = formatWindow();
  const results: Record<string, unknown> = { window };

  const payloads = [
    { name: "snake_all", body: { ...window, page_no: 1, page_size: 20, language: "ko", timeZone: "Asia/Seoul", order_by_create_time_desc: true } },
    { name: "snake_paid", body: { ...window, page_no: 1, page_size: 20, language: "ko", timeZone: "Asia/Seoul", order_status: "2000" } },
    { name: "camel_all", body: { startCreated: window.start_created, endCreated: window.end_created, pageNo: 1, pageSize: 20, language: "ko", timeZone: "Asia/Seoul" } },
  ];

  for (const attempt of payloads) {
    try {
      const response = await client.request<Record<string, unknown>>(
        POIZON_CONSTANTS.ENDPOINTS.ORDER_LIST,
        attempt.body
      );
      results[attempt.name] = {
        ok: true,
        keyPaths: collectKeys(response),
        code: (response as { code?: unknown }).code,
        sample: JSON.parse(JSON.stringify(response)).data ?? response,
      };
    } catch (err) {
      results[attempt.name] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const carrierPaths = [
    "/dop/api/v1/pop/api/v1/order/carrier/list",
    "/dop/api/v1/pop/api/v1/logistics/carriers",
    "/dop/api/v1/pop/api/v1/order/get-supported-carriers",
  ];
  for (const path of carrierPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        region: "KR",
      });
      results[`carrier:${path}`] = { ok: true, keyPaths: collectKeys(response), response };
      break;
    } catch (err) {
      results[`carrier:${path}`] = { ok: false, error: err instanceof Error ? err.message.slice(0, 240) : String(err) };
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
