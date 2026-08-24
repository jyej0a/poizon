/**
 * `user_configs`의 POIZON 자격증명 → `PoizonClient`.
 *
 * Clerk에 의존하지 않으므로 Next 런타임 밖(백그라운드 워커)에서도 사용할 수 있다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PoizonClient } from "@/lib/api/poizon";

export async function createPoizonClientForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PoizonClient> {
  const { data: configData } = await supabase
    .from("user_configs")
    .select("poizon_app_key, poizon_app_secret, poizon_access_token")
    .eq("user_id", userId)
    .single();

  if (!configData?.poizon_app_key || !configData?.poizon_app_secret) {
    throw new Error("설정에서 Poizon API Key와 Secret을 먼저 등록해 주세요.");
  }

  return new PoizonClient({
    appKey: configData.poizon_app_key,
    appSecret: configData.poizon_app_secret,
    ...(configData.poizon_access_token ? { accessToken: configData.poizon_access_token } : {}),
  });
}
