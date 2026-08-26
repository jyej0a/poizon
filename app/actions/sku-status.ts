"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { formatBidDate } from "@/lib/utils/poizon-listing";
import type { SkuStatus } from "@/types/sku-status";

async function getUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("로그인이 필요합니다.");

  const supabase = getServiceRoleClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (error || !user) throw new Error("사용자를 찾을 수 없습니다.");
  return { supabase, userInternalId: user.id as string };
}

function rowToSkuStatus(row: any): SkuStatus {
  return {
    memo: row.memo ?? null,
    manualBidMarked: !!row.manual_bid_marked,
    manualBidDate: row.manual_bid_at ? formatBidDate(row.manual_bid_at) : null,
    manualBidAt: row.manual_bid_at ?? null,
    stockMarked: !!row.stock_marked,
    stockMarkedDate: row.stock_marked_at ? formatBidDate(row.stock_marked_at) : null,
    stockMarkedAt: row.stock_marked_at ?? null,
    handled: !!row.handled,
    handledDate: row.handled_at ? formatBidDate(row.handled_at) : null,
    handledAt: row.handled_at ?? null,
    watchPrice: row.watch_price != null ? Number(row.watch_price) : null,
    watchAt: row.watch_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

const SKU_STATUS_SELECT =
  "sku_id, memo, manual_bid_marked, manual_bid_at, stock_marked, stock_marked_at, handled, handled_at, watch_price, watch_at, updated_at";

/** 배열 upsert만 `columns`를 붙여 보낸 컬럼만 ON CONFLICT UPDATE 한다. 단건 객체는 빠진 컬럼이 null/기본값으로 덮인다. */
const SKU_STATUS_UPSERT = {
  onConflict: "user_id, sku_id",
  defaultToNull: false,
} as const;

const IN_CHUNK_SIZE = 120;

async function fetchSkuStatusRows(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userInternalId: string,
  filter: { column: "sku_id" | "spu_id"; ids: number[] }
) {
  const map: Record<string, SkuStatus> = {};
  const { column, ids } = filter;
  if (ids.length === 0) return map;

  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("sku_status")
      .select(SKU_STATUS_SELECT)
      .eq("user_id", userInternalId)
      .in(column, chunk);

    if (error) throw error;
    (data || []).forEach((row: any) => {
      map[String(row.sku_id)] = rowToSkuStatus(row);
    });
  }

  return map;
}

export async function getSkuStatuses(skuIds?: (string | number)[]) {
  try {
    const { supabase, userInternalId } = await getUserId();

    if (skuIds && skuIds.length > 0) {
      const ids = skuIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
      const map = await fetchSkuStatusRows(supabase, userInternalId, { column: "sku_id", ids });
      return { success: true, data: map };
    }

    const { data, error } = await supabase
      .from("sku_status")
      .select(SKU_STATUS_SELECT)
      .eq("user_id", userInternalId);

    if (error) throw error;

    const map: Record<string, SkuStatus> = {};
    (data || []).forEach((row: any) => {
      map[String(row.sku_id)] = rowToSkuStatus(row);
    });

    return { success: true, data: map };
  } catch (error: any) {
    console.error("[getSkuStatuses] Error:", error);
    return { success: false, data: {} as Record<string, SkuStatus>, error: error.message };
  }
}

/** 품번(SPU) 단위로 옵션 상태 일괄 조회 — 새로고침 후 검토완료 복원용 */
export async function getSkuStatusesBySpuIds(spuIds?: (string | number)[]) {
  try {
    const { supabase, userInternalId } = await getUserId();
    if (!spuIds || spuIds.length === 0) return { success: true, data: {} as Record<string, SkuStatus> };

    const ids = spuIds
      .map((id) => Number(String(id).replace(/[^0-9]/g, "")))
      .filter((id) => !isNaN(id) && id > 0);

    const map = await fetchSkuStatusRows(supabase, userInternalId, { column: "spu_id", ids });
    return { success: true, data: map };
  } catch (error: any) {
    console.error("[getSkuStatusesBySpuIds] Error:", error);
    return { success: false, data: {} as Record<string, SkuStatus>, error: error.message };
  }
}

export async function setSkuMemo(
  skuId: string | number,
  memo: string,
  spuId?: string | number | null
) {
  try {
    const { supabase, userInternalId } = await getUserId();

    const { error } = await supabase.from("sku_status").upsert(
      [
        {
          user_id: userInternalId,
          sku_id: Number(skuId),
          spu_id: spuId ? Number(spuId) : null,
          memo: memo || null,
          updated_at: new Date().toISOString(),
        },
      ],
      SKU_STATUS_UPSERT
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setSkuMemo] Error:", error);
    return { success: false, error: error.message };
  }
}

/** 옵션(SKU) 입찰 여부 수동 표기 토글 */
export async function setSkuManualBidMarked(
  skuId: string | number,
  marked: boolean,
  spuId?: string | number | null
) {
  try {
    const { supabase, userInternalId } = await getUserId();
    const now = new Date().toISOString();

    const { error } = await supabase.from("sku_status").upsert(
      [
        {
          user_id: userInternalId,
          sku_id: Number(skuId),
          spu_id: spuId ? Number(spuId) : null,
          manual_bid_marked: marked,
          manual_bid_at: marked ? now : null,
          updated_at: now,
        },
      ],
      SKU_STATUS_UPSERT
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setSkuManualBidMarked] Error:", error);
    return { success: false, error: error.message };
  }
}

/** 옵션(SKU) 재고 보유 수동 표기 토글 */
export async function setSkuStockMarked(
  skuId: string | number,
  marked: boolean,
  spuId?: string | number | null
) {
  try {
    const { supabase, userInternalId } = await getUserId();
    const now = new Date().toISOString();

    const { error } = await supabase.from("sku_status").upsert(
      [
        {
          user_id: userInternalId,
          sku_id: Number(skuId),
          spu_id: spuId ? Number(spuId) : null,
          stock_marked: marked,
          stock_marked_at: marked ? now : null,
          updated_at: now,
        },
      ],
      SKU_STATUS_UPSERT
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setSkuStockMarked] Error:", error);
    return { success: false, error: error.message };
  }
}

/** 옵션(SKU) 검토완료 토글 */
export async function setSkuHandled(
  skuId: string | number,
  handled: boolean,
  spuId?: string | number | null
) {
  try {
    const { supabase, userInternalId } = await getUserId();
    const now = new Date().toISOString();

    const { error } = await supabase.from("sku_status").upsert(
      [
        {
          user_id: userInternalId,
          sku_id: Number(skuId),
          spu_id: spuId ? Number(spuId) : null,
          handled,
          handled_at: handled ? now : null,
          updated_at: now,
        },
      ],
      SKU_STATUS_UPSERT
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setSkuHandled] Error:", error);
    return { success: false, error: error.message };
  }
}

/** 여러 옵션(SKU) 검토완료 일괄 설정 */
export async function setManySkuHandled(
  skuIds: (string | number)[],
  handled: boolean,
  spuId?: string | number | null
) {
  if (skuIds.length === 0) return { success: true };
  try {
    const { supabase, userInternalId } = await getUserId();
    const now = new Date().toISOString();

    const rows = skuIds.map((skuId) => ({
      user_id: userInternalId,
      sku_id: Number(skuId),
      spu_id: spuId ? Number(spuId) : null,
      handled,
      handled_at: handled ? now : null,
      updated_at: now,
    }));

    const { error } = await supabase.from("sku_status").upsert(rows, SKU_STATUS_UPSERT);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setManySkuHandled] Error:", error);
    return { success: false, error: error.message };
  }
}

/** 옵션(SKU) 가격 알림. price가 null이면 해제 */
export async function setSkuWatchPrice(
  skuId: string | number,
  price: number | null,
  spuId?: string | number | null
) {
  try {
    const { supabase, userInternalId } = await getUserId();
    const now = new Date().toISOString();
    const watchPrice = price != null && Number.isFinite(price) && price > 0 ? Math.round(price) : null;

    const { error } = await supabase.from("sku_status").upsert(
      [
        {
          user_id: userInternalId,
          sku_id: Number(skuId),
          spu_id: spuId ? Number(spuId) : null,
          watch_price: watchPrice,
          watch_at: watchPrice != null ? now : null,
          watch_notified_at: null,
          watch_checked_at: null,
          updated_at: now,
        },
      ],
      SKU_STATUS_UPSERT
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setSkuWatchPrice] Error:", error);
    return { success: false, error: error.message };
  }
}
