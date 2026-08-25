/**
 * 운송사·QC·자동 재입찰 엔드포인트 실데이터 프로브.
 * 사용: pnpm tsx --env-file=.env scripts/probe-remaining.ts
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
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, " ").slice(0, 220);
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

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const list = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.ORDER_LIST, {
      start_created: fmt(start),
      end_created: fmt(end),
      page_no: 1,
      page_size: 5,
      language: "ko",
      timeZone: "Asia/Seoul",
      order_by_create_time_desc: true,
    });
    const data = (list.data ?? list) as Record<string, unknown>;
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const sample = orders[0] as Record<string, unknown> | undefined;
    results.orderList = {
      ok: true,
      total: data.total_results,
      count: orders.length,
      sampleKeys: sample ? collectKeys(sample) : [],
      sample: sample
        ? {
            order_no: sample.order_no,
            order_status: sample.order_status,
            identifyType: sample.identifyType ?? sample.identify_type,
            onlineIdentifyStatus: sample.onlineIdentifyStatus ?? sample.online_identify_status,
            poundage_percent: sample.poundage_percent,
            poundage_detail: sample.poundage_detail,
            amount: sample.amount,
            pay_amount: sample.pay_amount,
          }
        : null,
    };
  } catch (err) {
    results.orderList = { ok: false, error: summarizeError(err) };
  }

  const carrierPaths = [
    "/dop/api/v1/pop/api/v1/order/supported-carriers",
    "/dop/api/v1/pop/api/v1/logistics/supported-carriers",
    "/dop/api/v1/pop/api/v1/order/carriers",
    "/dop/api/v1/pop/api/v1/order/carrier/list",
    "/dop/api/v1/pop/api/v1/logistics/carriers",
    "/dop/api/v1/pop/api/v1/order/get-supported-carriers",
    "/dop/api/v1/pop/api/v1/common/carrier/list",
    "/dop/api/v1/pop/api/v1/fulfillment/carriers",
    "/dop/api/v1/pop/api/v1/order/express/company",
    "/dop/api/v1/pop/api/v1/order/express/carriers",
  ];
  for (const path of carrierPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        region: "KR",
      });
      results[`carrier:${path}`] = { ok: true, keys: collectKeys(response), data: response.data ?? response };
      break;
    } catch (err) {
      results[`carrier:${path}`] = { ok: false, error: summarizeError(err) };
    }
  }

  const qcPaths = [
    "/dop/api/v1/pop/api/v1/order/qc",
    "/dop/api/v1/pop/api/v1/order/qc_result",
    "/dop/api/v1/pop/api/v1/order/query-qc-result",
    "/dop/api/v1/pop/api/v1/order/queryQcResult",
    "/dop/api/v1/pop/api/v1/order/identify/result",
    "/dop/api/v1/pop/api/v1/order/quality-check",
    "/dop/api/v1/pop/api/v1/order/inspect/result",
  ];
  const sampleNo =
    ((results.orderList as { sample?: { order_no?: string } } | undefined)?.sample?.order_no as string | undefined) ||
    "0";
  for (const path of qcPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        order_no: sampleNo,
        orderNo: sampleNo,
      });
      results[`qc:${path}`] = { ok: true, keys: collectKeys(response), data: response.data ?? response };
      break;
    } catch (err) {
      results[`qc:${path}`] = { ok: false, error: summarizeError(err) };
    }
  }

  try {
    const response = await client.request<Record<string, unknown>>(POIZON_CONSTANTS.ENDPOINTS.AUTO_FOLLOW_LIST, {
      language: "ko",
      timeZone: "Asia/Seoul",
      region: "KR",
      pageNum: 1,
      pageSize: 20,
    });
    results.autoFollowList = { ok: true, keys: collectKeys(response), data: response.data ?? response };
  } catch (err) {
    results.autoFollowList = { ok: false, error: summarizeError(err) };
  }

  const followSubmitPaths = [
    "/dop/api/v1/pop/api/v1/follow-bidding/submit",
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/submit",
  ];
  for (const path of followSubmitPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        biddingNo: "0",
        sellerBiddingNo: "0",
        lowestPrice: 1000,
        followType: 3,
        autoSwitch: false,
        countryCode: "KR",
        currency: "KRW",
      });
      results[`followSubmit:${path}`] = { ok: true, data: response };
    } catch (err) {
      results[`followSubmit:${path}`] = { ok: false, error: summarizeError(err) };
    }
  }

  const followCancelPaths = [
    "/dop/api/v1/pop/api/v1/follow-bidding/cancel",
    "/dop/api/v1/pop/api/v1/auto-follow-bidding/cancel",
  ];
  for (const path of followCancelPaths) {
    try {
      const response = await client.request<Record<string, unknown>>(path, {
        language: "ko",
        timeZone: "Asia/Seoul",
        biddingNo: "0",
        sellerBiddingNo: "0",
      });
      results[`followCancel:${path}`] = { ok: true, data: response };
    } catch (err) {
      results[`followCancel:${path}`] = { ok: false, error: summarizeError(err) };
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
