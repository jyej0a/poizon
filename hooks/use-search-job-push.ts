"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePushSubscription,
  getPushPublicConfig,
  savePushSubscription,
  sendTestSearchJobPush,
} from "@/app/actions/push";

export type PushUiState =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "prompt"
  | "subscribed";

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function formatPushError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/push service not available/i.test(raw)) {
    return "이 브라우저는 푸시 서비스를 제공하지 않습니다. Chrome 또는 Edge에서 알림을 허용하세요.";
  }
  return raw;
}

export function useSearchJobPush() {
  const [state, setState] = useState<PushUiState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }

    const config = await getPushPublicConfig();
    if (!config.enabled || !config.publicKey) {
      setState("unconfigured");
      return;
    }

    await registerWorker();
    await navigator.serviceWorker.ready;

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/");
    const existing = await registration?.pushManager.getSubscription();
    if (Notification.permission === "granted" && existing) {
      const json = existing.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        await savePushSubscription(
          {
            endpoint: json.endpoint,
            expirationTime: json.expirationTime ?? null,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
          navigator.userAgent
        );
      }
      setState("subscribed");
      return;
    }

    setState("prompt");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const config = await getPushPublicConfig();
      if (!config.publicKey) {
        setState("unconfigured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "prompt");
        setMessage("알림이 허용되지 않았습니다.");
        return;
      }

      const registration = (await registerWorker()) ?? (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setMessage("구독 정보를 만들지 못했습니다.");
        return;
      }

      const saved = await savePushSubscription(
        {
          endpoint: json.endpoint,
          expirationTime: json.expirationTime ?? null,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        navigator.userAgent
      );
      if (!saved.success) {
        setMessage(saved.error ?? "구독 저장에 실패했습니다.");
        return;
      }
      setState("subscribed");
    } catch (error) {
      setMessage(formatPushError(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("prompt");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendTestSearchJobPush();
      setMessage(
        result.success
          ? "테스트 알림을 보냈습니다. 화면을 가리거나 다른 탭에 있어도 떠야 합니다."
          : result.error ?? "테스트 알림에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, message, enable, disable, sendTest };
}
