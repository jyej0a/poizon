import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const USER_ID_TTL_MS = 60_000;

type CacheEntry = { userId: string; expiresAt: number };

const userIdByClerkId = new Map<string, CacheEntry>();

/**
 * Clerk 세션 → `public.users.id`.
 * POIZON 자격증명이 필요 없는 액션(잡 목록 조회 등)에서 사용한다.
 *
 * `users.id`는 세션 동안 바뀌지 않으므로 짧게 캐시한다.
 * 로그인·클릭·폴링마다 같은 행을 조회하지 않게 한다.
 */
export async function getCurrentUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("로그인이 필요합니다.");

  const supabase = getServiceRoleClient();
  const now = Date.now();
  const hit = userIdByClerkId.get(clerkId);
  if (hit && hit.expiresAt > now) {
    return { supabase, userId: hit.userId, clerkId };
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !user) throw new Error("사용자를 찾을 수 없습니다.");

  const userId = user.id as string;
  userIdByClerkId.set(clerkId, { userId, expiresAt: now + USER_ID_TTL_MS });
  return { supabase, userId, clerkId };
}
