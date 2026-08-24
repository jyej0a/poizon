"use server";

import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  loadMallWhitelist,
  searchNaverShoppingWithWhitelist,
  type NaverShoppingItem,
} from "@/lib/api/naver-shopping";

export async function getNaverShoppingResults(
  keyword: string
): Promise<{ success: boolean; data?: NaverShoppingItem[]; error?: string }> {
  if (!keyword) return { success: false, error: "키워드가 없습니다." };

  try {
    const supabase = createClerkSupabaseClient();
    const whitelist = await loadMallWhitelist(supabase);
    return await searchNaverShoppingWithWhitelist(keyword, whitelist);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
