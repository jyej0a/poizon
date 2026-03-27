"use server";

import { searchNaverShopping, type NaverShoppingItem } from "@/lib/api/naver-shopping";

export async function getNaverShoppingResults(keyword: string): Promise<{ success: boolean; data?: NaverShoppingItem[]; error?: string }> {
  if (!keyword) return { success: false, error: "키워드가 없습니다." };
  
  try {
    return await searchNaverShopping(keyword);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
