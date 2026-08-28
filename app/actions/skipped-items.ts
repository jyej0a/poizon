"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";

export async function getSkippedItems() {
  try {
    const { supabase, userId } = await getCurrentUserId();

    const { data, error } = await supabase
      .from("skipped_items")
      .select("sku_id, spu_id, article_number, skipped_at")
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("[getSkippedItems] Error:", error);
    return { success: false, data: [], error: error.message };
  }
}

export async function addSkippedItems(items: { sku_id: string, spu_id?: string, article_number?: string }[]) {
  try {
    const { supabase, userId } = await getCurrentUserId();

    const upsertData = items.map(item => ({
      user_id: userId,
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

export async function removeSkippedItems(skuIds: string[]) {
  try {
    const { supabase, userId } = await getCurrentUserId();

    const { error } = await supabase
      .from("skipped_items")
      .delete()
      .eq("user_id", userId)
      .in("sku_id", skuIds.map(id => String(id)));

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("[removeSkippedItems] Error:", error);
    return { success: false, error: error.message };
  }
}
