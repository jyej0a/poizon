/**
 * 가격 워치 백그라운드 점검.
 * 구독이 있는 계정의 watch_price SKU만 약 5분마다 노출가를 조회하고,
 * 도달 시 Web Push를 1회 보낸다. 노출가가 목표를 다시 넘으면 재무장.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";
import { fetchSkuRecommendPrice } from "@/lib/api/recommend-price";
import { mapWithConcurrency } from "@/lib/api/retry";
import { buildPriceWatchPushPayload } from "@/lib/push/payload";
import { sendPushToUser } from "@/lib/push/send";
import { currentExposureAmount, isPriceWatchHit } from "@/lib/utils/price-watch";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SKUS_PER_TICK = 20;
const RECOMMEND_CONCURRENCY = 3;

interface WatchRow {
  user_id: string;
  sku_id: number;
  watch_price: number;
  watch_notified_at: string | null;
}

export interface PriceWatchTickResult {
  checked: number;
  notified: number;
  rearmed: number;
}

async function listSubscribedUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("push_subscriptions").select("user_id");
  if (error) {
    console.warn("[price-watch] 구독 조회 실패:", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((row) => String(row.user_id)))];
}

export async function runPriceWatchTick(
  supabase: SupabaseClient,
  onLog: (message: string) => void = () => {}
): Promise<PriceWatchTickResult> {
  const empty = { checked: 0, notified: 0, rearmed: 0 };
  const userIds = await listSubscribedUserIds(supabase);
  if (userIds.length === 0) return empty;

  const { data, error } = await supabase
    .from("sku_status")
    .select("user_id, sku_id, watch_price, watch_notified_at, watch_checked_at")
    .in("user_id", userIds)
    .not("watch_price", "is", null)
    .gt("watch_price", 0)
    .order("watch_checked_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) {
    onLog(`가격 워치 조회 실패: ${error.message}`);
    return empty;
  }

  const dueCutoff = Date.now() - CHECK_INTERVAL_MS;
  const rows = ((data ?? []) as (WatchRow & { watch_checked_at: string | null })[])
    .filter((row) => {
      if (row.watch_checked_at == null) return true;
      const t = new Date(row.watch_checked_at).getTime();
      return Number.isFinite(t) && t < dueCutoff;
    })
    .slice(0, MAX_SKUS_PER_TICK);
  if (rows.length === 0) return empty;

  const byUser = new Map<string, WatchRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  let checked = 0;
  let notified = 0;
  let rearmed = 0;

  for (const [userId, watches] of byUser) {
    let poizon;
    try {
      poizon = await createPoizonClientForUser(supabase, userId);
    } catch (err) {
      onLog(
        `가격 워치 자격증명 없음 (${userId.slice(0, 8)}…): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      const now = new Date().toISOString();
      await supabase
        .from("sku_status")
        .update({ watch_checked_at: now })
        .eq("user_id", userId)
        .in(
          "sku_id",
          watches.map((row) => row.sku_id)
        );
      continue;
    }

    const outcomes = await mapWithConcurrency(watches, RECOMMEND_CONCURRENCY, async (row) => {
      const now = new Date().toISOString();
      let exposure: number | null = null;
      try {
        const rec = await fetchSkuRecommendPrice(poizon, row.sku_id);
        exposure = currentExposureAmount(rec, undefined);
      } catch {
        exposure = null;
      }

      const hit = isPriceWatchHit(row.watch_price, exposure);
      const alreadyNotified = Boolean(row.watch_notified_at);
      const patch: { watch_checked_at: string; watch_notified_at?: string | null } = {
        watch_checked_at: now,
      };

      if (hit && !alreadyNotified && exposure != null) {
        const result = await sendPushToUser(
          supabase,
          userId,
          buildPriceWatchPushPayload({
            skuId: row.sku_id,
            watchPrice: row.watch_price,
            exposure,
          })
        );
        if (result.sent > 0) {
          patch.watch_notified_at = now;
        }
      } else if (!hit && alreadyNotified) {
        patch.watch_notified_at = null;
      }

      await supabase
        .from("sku_status")
        .update(patch)
        .eq("user_id", userId)
        .eq("sku_id", row.sku_id);

      return {
        notified: Boolean(hit && !alreadyNotified && patch.watch_notified_at),
        rearmed: Boolean(!hit && alreadyNotified),
      };
    });

    checked += outcomes.length;
    notified += outcomes.filter((item) => item.notified).length;
    rearmed += outcomes.filter((item) => item.rearmed).length;
  }

  if (checked > 0) {
    onLog(`가격 워치 ${checked}건 점검, 푸시 ${notified}건, 재무장 ${rearmed}건`);
  }

  return { checked, notified, rearmed };
}
