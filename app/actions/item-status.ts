"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export interface ItemStatus {
  handled: boolean;
  memo: string | null;
  updatedAt: string | null;
}

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

/**
 * 품번(SPU) 단위 처리 상태/메모 조회.
 * @param spuIds 조회할 SPU ID 목록 (생략 시 전체)
 * @returns { [spuId]: { handled, memo } }
 */
export async function getItemStatuses(spuIds?: (string | number)[]) {
  try {
    const { supabase, userInternalId } = await getUserId();

    let query = supabase
      .from("item_status")
      .select("spu_id, handled, memo, updated_at")
      .eq("user_id", userInternalId);

    if (spuIds && spuIds.length > 0) {
      query = query.in("spu_id", spuIds.map((id) => String(id)));
    }

    const { data, error } = await query;
    if (error) throw error;

    const map: Record<string, ItemStatus> = {};
    (data || []).forEach((row: any) => {
      map[String(row.spu_id)] = {
        handled: !!row.handled,
        memo: row.memo ?? null,
        updatedAt: row.updated_at ?? null,
      };
    });

    return { success: true, data: map };
  } catch (error: any) {
    // 테이블 미생성 등 상황에서도 UI가 깨지지 않도록 빈 맵 반환
    console.error("[getItemStatuses] Error:", error);
    return { success: false, data: {} as Record<string, ItemStatus>, error: error.message };
  }
}

interface ItemMeta {
  articleNumber?: string;
  title?: string;
}

/**
 * 품번 처리 완료 여부 토글/설정 (upsert).
 */
export async function setItemHandled(
  spuId: string | number,
  handled: boolean,
  meta: ItemMeta = {}
) {
  try {
    const { supabase, userInternalId } = await getUserId();

    const { error } = await supabase.from("item_status").upsert(
      [
        {
          user_id: userInternalId,
          spu_id: String(spuId),
          ...(meta.articleNumber != null ? { article_number: meta.articleNumber } : {}),
          ...(meta.title != null ? { title: meta.title } : {}),
          handled,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id, spu_id", defaultToNull: false }
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setItemHandled] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 품번 메모 저장 (upsert).
 */
export async function setItemMemo(
  spuId: string | number,
  memo: string,
  meta: ItemMeta = {}
) {
  try {
    const { supabase, userInternalId } = await getUserId();

    const { error } = await supabase.from("item_status").upsert(
      [
        {
          user_id: userInternalId,
          spu_id: String(spuId),
          ...(meta.articleNumber != null ? { article_number: meta.articleNumber } : {}),
          ...(meta.title != null ? { title: meta.title } : {}),
          memo: memo || null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id, spu_id", defaultToNull: false }
    );

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[setItemMemo] Error:", error);
    return { success: false, error: error.message };
  }
}
