"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getVapidPublicKey } from "@/lib/push/config";
import { buildSearchJobPushPayload } from "@/lib/push/payload";
import { sendPushToUser } from "@/lib/push/send";
import type { PushSubscriptionPayload } from "@/types/push";

export async function getPushPublicConfig(): Promise<{
  enabled: boolean;
  publicKey: string | null;
}> {
  const publicKey = getVapidPublicKey();
  return { enabled: Boolean(publicKey), publicKey };
}

export async function savePushSubscription(
  subscription: PushSubscriptionPayload,
  userAgent?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = subscription.endpoint?.trim();
    const p256dh = subscription.keys?.p256dh?.trim();
    const auth = subscription.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) {
      return { success: false, error: "구독 정보가 올바르지 않습니다." };
    }

    const { supabase, userId } = await getCurrentUserId();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deletePushSubscription(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = endpoint.trim();
    if (!trimmed) return { success: false, error: "구독 주소가 없습니다." };

    const { supabase, userId } = await getCurrentUserId();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", trimmed);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendTestSearchJobPush(): Promise<{
  success: boolean;
  sent?: number;
  error?: string;
}> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const result = await sendPushToUser(
      supabase,
      userId,
      buildSearchJobPushPayload({
        id: "test",
        keyword: "테스트",
        itemCount: 0,
        status: "done",
      })
    );
    if (result.sent === 0) {
      return {
        success: false,
        sent: 0,
        error: "저장된 구독이 없거나 VAPID 키가 없습니다. 알림 허용 후 다시 시도하세요.",
      };
    }
    return { success: true, sent: result.sent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
