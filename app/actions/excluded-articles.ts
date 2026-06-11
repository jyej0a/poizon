"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

// 제외된 품번 목록 조회
export async function getExcludedArticles() {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    const supabase = getServiceRoleClient();

    // 1. Clerk ID로 내부 users 테이블의 id 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      return { success: false, data: [], error: "사용자를 찾을 수 없습니다." };
    }

    // 2. 해당 유저의 제외 목록 조회
    const { data, error } = await supabase
      .from("excluded_articles")
      .select("*")
      .eq("user_id", user.id)
      .order("excluded_at", { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("[getExcludedArticles] Error:", error);
    return { success: false, data: [], error: error.message };
  }
}

// 품번 제외 추가
export async function addExcludedArticle(articleNumber: string, title?: string, reason?: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    const supabase = getServiceRoleClient();

    // 1. Clerk ID로 내부 users 테이블의 id 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    // 2. 제외 목록에 추가 (upsert로 중복 방지)
    const { error } = await supabase
      .from("excluded_articles")
      .upsert({
        user_id: user.id,
        article_number: articleNumber,
        title: title || null,
        reason: reason || null,
        excluded_at: new Date().toISOString()
      }, { onConflict: "user_id, article_number" });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error("[addExcludedArticle] Error:", error);
    return { success: false, error: error.message };
  }
}

// 품번 제외 해제 (복원)
export async function removeExcludedArticle(articleNumber: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    const supabase = getServiceRoleClient();

    // 1. Clerk ID로 내부 users 테이블의 id 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userError || !user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    // 2. 제외 목록에서 삭제
    const { error } = await supabase
      .from("excluded_articles")
      .delete()
      .eq("user_id", user.id)
      .eq("article_number", articleNumber);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error("[removeExcludedArticle] Error:", error);
    return { success: false, error: error.message };
  }
}
