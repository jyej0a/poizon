"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSkuRecommendations } from "@/app/actions/recommendations";

const REC_FETCH_TIMEOUT_MS = 30_000;
const REC_FETCH_CONCURRENCY = 2;

/**
 * SKU 추천가 조회 큐.
 * 동시 2건, 30초 타임아웃. 취소된 SKU의 응답은 무시하고 로딩만 즉시 해제한다.
 * 완료 건은 프레임 단위로 모아 보드 전체 리렌더 횟수를 줄인다.
 */
export function useSkuRecommendationQueue() {
  const [skuRecommendations, setSkuRecommendations] = useState<Record<string, any>>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState<Record<string, boolean>>({});

  const cancelledRecsRef = useRef<Set<string>>(new Set());
  const skuRecommendationsRef = useRef<Record<string, any>>({});
  const loadingRecommendationsRef = useRef<Record<string, boolean>>({});
  const recFetchQueueRef = useRef<string[]>([]);
  const recActiveFetchesRef = useRef(0);
  const recPausedRef = useRef(false);
  const pumpRef = useRef<() => void>(() => {});

  const pendingRecsRef = useRef<Record<string, any>>({});
  const pendingLoadingRef = useRef<Record<string, boolean | null>>({});
  const flushRafRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    flushRafRef.current = null;
    const recs = pendingRecsRef.current;
    const loading = pendingLoadingRef.current;
    pendingRecsRef.current = {};
    pendingLoadingRef.current = {};

    const recKeys = Object.keys(recs);
    if (recKeys.length > 0) {
      const merged = { ...skuRecommendationsRef.current, ...recs };
      skuRecommendationsRef.current = merged;
      setSkuRecommendations(merged);
    }

    const loadingKeys = Object.keys(loading);
    if (loadingKeys.length > 0) {
      setLoadingRecommendations((prev) => {
        const next = { ...prev };
        for (const key of loadingKeys) {
          const value = loading[key];
          if (value) next[key] = true;
          else delete next[key];
        }
        loadingRecommendationsRef.current = next;
        return next;
      });
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushRafRef.current != null) return;
    flushRafRef.current = requestAnimationFrame(flushPending);
  }, [flushPending]);

  useEffect(() => {
    skuRecommendationsRef.current = skuRecommendations;
  }, [skuRecommendations]);

  useEffect(() => {
    loadingRecommendationsRef.current = loadingRecommendations;
  }, [loadingRecommendations]);

  const fetchRecommendation = useCallback(async (skuId: string | number) => {
    const key = String(skuId);
    if (!key) return;

    cancelledRecsRef.current.delete(key);
    pendingLoadingRef.current[key] = true;
    scheduleFlush();

    try {
      const res = await Promise.race([
        getSkuRecommendations(skuId),
        new Promise<{ success: false; error: string }>((resolve) => {
          window.setTimeout(
            () => resolve({ success: false, error: "추천가 조회 시간이 초과되었습니다." }),
            REC_FETCH_TIMEOUT_MS
          );
        }),
      ]);

      if (cancelledRecsRef.current.has(key)) return;
      if (res.success && res.data) {
        pendingRecsRef.current[key] = res.data;
      }
    } catch (e) {
      console.error("Failed to fetch recommendation", e);
    } finally {
      pendingLoadingRef.current[key] = false;
      scheduleFlush();
    }
  }, [scheduleFlush]);

  const pumpRecommendationQueue = useCallback(() => {
    if (recPausedRef.current) return;
    while (
      recActiveFetchesRef.current < REC_FETCH_CONCURRENCY &&
      recFetchQueueRef.current.length > 0
    ) {
      const key = recFetchQueueRef.current.shift();
      if (!key) continue;
      if (skuRecommendationsRef.current[key] || loadingRecommendationsRef.current[key]) continue;
      if (cancelledRecsRef.current.has(key)) continue;
      if (pendingRecsRef.current[key] || pendingLoadingRef.current[key]) continue;

      recActiveFetchesRef.current += 1;
      void fetchRecommendation(key).finally(() => {
        recActiveFetchesRef.current -= 1;
        pumpRef.current();
      });
    }
  }, [fetchRecommendation]);

  pumpRef.current = pumpRecommendationQueue;

  useEffect(() => {
    return () => {
      recFetchQueueRef.current = [];
      if (flushRafRef.current != null) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      Object.keys(loadingRecommendationsRef.current).forEach((key) => {
        cancelledRecsRef.current.add(key);
      });
    };
  }, []);

  const queueRecommendationFetch = useCallback(
    (skuId: string | number) => {
      const key = String(skuId);
      if (!key) return;
      if (recPausedRef.current) return;
      if (skuRecommendationsRef.current[key] || loadingRecommendationsRef.current[key]) return;
      if (pendingRecsRef.current[key] || pendingLoadingRef.current[key]) return;
      if (recFetchQueueRef.current.includes(key)) return;

      recFetchQueueRef.current.push(key);
      pumpRecommendationQueue();
    },
    [pumpRecommendationQueue]
  );

  const hydrateRecommendations = useCallback((recs: Record<string, any>) => {
    const entries = Object.entries(recs ?? {}).filter(([, value]) => value);
    if (entries.length === 0) return;
    const merged: Record<string, any> = { ...skuRecommendationsRef.current };
    entries.forEach(([key, value]) => {
      merged[key] = value;
    });
    skuRecommendationsRef.current = merged;
    setSkuRecommendations(merged);
  }, []);

  const pauseRecommendationQueue = useCallback(() => {
    recPausedRef.current = true;
    recFetchQueueRef.current = [];
  }, []);

  const resumeRecommendationQueue = useCallback(() => {
    recPausedRef.current = false;
    pumpRecommendationQueue();
  }, [pumpRecommendationQueue]);

  const cancelRecommendations = useCallback((skuIds: (string | number)[]) => {
    const keys = skuIds.map((id) => String(id)).filter(Boolean);
    if (keys.length === 0) return;
    keys.forEach((key) => cancelledRecsRef.current.add(key));
    recFetchQueueRef.current = recFetchQueueRef.current.filter((id) => !keys.includes(id));
    keys.forEach((key) => {
      delete pendingRecsRef.current[key];
      pendingLoadingRef.current[key] = false;
    });
    scheduleFlush();
  }, [scheduleFlush]);

  return {
    skuRecommendations,
    loadingRecommendations,
    queueRecommendationFetch,
    cancelRecommendations,
    hydrateRecommendations,
    pauseRecommendationQueue,
    resumeRecommendationQueue,
  };
}
