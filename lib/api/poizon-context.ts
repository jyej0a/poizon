import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { PoizonClient } from "@/lib/api/poizon";
import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";

export interface PoizonContext {
  /** `users.id` (Supabase UUID) — bid_history 등 소유자 컬럼에 사용 */
  userId: string;
  clerkId: string;
  client: PoizonClient;
}

/**
 * `users` + `user_configs` 조회 지점을 한 곳으로 모은다.
 *
 * `cache`는 Server Component 렌더 패스 안에서만 메모이제이션된다. Server Action에서 호출되면
 * React가 요청 컨텍스트를 찾지 못해 그대로 통과시키므로(에러는 아님) 액션 간 재사용은 없다.
 * 액션마다 DB 왕복 2회가 남는 문제는 워커가 잡 시작 시 자격증명을 1회 로드하는 구조로 해소한다.
 */
const loadPoizonContext = cache(async (clerkId: string): Promise<PoizonContext> => {
  const supabase = getServiceRoleClient();

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (!user) {
    throw new Error("사용자 동기화 정보가 없습니다.");
  }

  return {
    userId: user.id,
    clerkId,
    client: await createPoizonClientForUser(supabase, user.id),
  };
});

export async function getPoizonContext(): Promise<PoizonContext> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized: Please log in first.");
  }
  return loadPoizonContext(clerkId);
}
