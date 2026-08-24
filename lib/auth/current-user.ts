import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Clerk 세션 → `public.users.id`.
 * POIZON 자격증명이 필요 없는 액션(잡 목록 조회 등)에서 사용한다.
 */
export async function getCurrentUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("로그인이 필요합니다.");

  const supabase = getServiceRoleClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !user) throw new Error("사용자를 찾을 수 없습니다.");
  return { supabase, userId: user.id as string, clerkId };
}
