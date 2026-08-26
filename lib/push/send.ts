import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVapidDetails } from "@/lib/push/config";
import type { PushSubscriptionRow, WebPushPayload } from "@/types/push";

let vapidReady = false;

function ensureVapid(): boolean {
  const details = getVapidDetails();
  if (!details) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
    vapidReady = true;
  }
  return true;
}

async function listSubscriptions(
  supabase: SupabaseClient,
  userId: string
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, user_agent")
    .eq("user_id", userId);

  if (error) {
    console.warn("[push] 구독 조회 실패:", error.message);
    return [];
  }
  return (data ?? []) as PushSubscriptionRow[];
}

async function deleteByEndpoint(supabase: SupabaseClient, endpoint: string) {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.warn("[push] 만료 구독 삭제 실패:", error.message);
  }
}

export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: WebPushPayload
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, removed: 0 };
  }

  const rows = await listSubscriptions(supabase, userId);
  if (rows.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
          { TTL: 60 * 60 * 12, urgency: "normal" }
        );
        sent += 1;
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await deleteByEndpoint(supabase, row.endpoint);
          removed += 1;
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[push] 발송 실패 (${row.endpoint.slice(0, 48)}…):`, message);
      }
    })
  );

  return { sent, removed };
}
