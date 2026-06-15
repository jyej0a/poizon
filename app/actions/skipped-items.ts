"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

// 체크된(Skip) SKU 목록 조회
export async function getSkippedItems() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) return { success: false, data: [], error: "사용자를 찾을 수 없습니다." };

    const { data, error } = await supabase
      .from("skipped_items")
      .select("sku_id, spu_id, article_number")
      .eq("user_id", user.id);

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("[getSkippedItems] Error:", error);
    return { success: false, data: [], error: error.message };
  }
}

// SKU 체크 (Skip 추가)
export async function addSkippedItems(items: { sku_id: string, spu_id?: string, article_number?: string }[]) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) throw new Error("사용자를 찾을 수 없습니다.");

    const upsertData = items.map(item => ({
      user_id: user.id,
      sku_id: String(item.sku_id),
      spu_id: item.spu_id ? String(item.spu_id) : null,
      article_number: item.article_number || null,
      skipped_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from("skipped_items")
      .upsert(upsertData, { onConflict: "user_id, sku_id" });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("[addSkippedItems] Error:", error);
    return { success: false, error: error.message };
  }
}

// SKU 체크 해제 (Skip 삭제)
export async function removeSkippedItems(skuIds: string[]) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) throw new Error("사용자를 찾을 수 없습니다.");

    const { error } = await supabase
      .from("skipped_items")
      .delete()
      .eq("user_id", user.id)
      .in("sku_id", skuIds.map(id => String(id)));

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("[removeSkippedItems] Error:", error);
    return { success: false, error: error.message };
  }
}
