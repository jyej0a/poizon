"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSourceOffers } from "@/app/actions/source-offers";
import type { SearchJobItemRecord } from "@/types/search-job";
import type { SourceOffer } from "@/types/source-offer";

/**
 * 검색 결과 품번의 외부 원가 오퍼 조회·모달.
 * 이미 있거나 로딩 중인 품번은 재요청하지 않는다.
 * 응답은 프레임 단위로 모아 보드 전체 리렌더 횟수를 줄인다.
 */
export function useSourceOffers() {
  const [sourceOffers, setSourceOffers] = useState<Record<string, SourceOffer[]>>({});
  const [loadingSourceOffers, setLoadingSourceOffers] = useState<Record<string, boolean>>({});
  const [selectedSourceOffers, setSelectedSourceOffers] = useState<SourceOffer[] | null>(null);
  const [sourceOfferModalArticleNumber, setSourceOfferModalArticleNumber] = useState("");
  const [isSourceOfferModalOpen, setIsSourceOfferModalOpen] = useState(false);

  const sourceOffersRef = useRef(sourceOffers);
  sourceOffersRef.current = sourceOffers;
  const loadingSourceOffersRef = useRef(loadingSourceOffers);
  loadingSourceOffersRef.current = loadingSourceOffers;
  const fetchGenerationRef = useRef(0);

  const pendingOffersRef = useRef<Record<string, SourceOffer[]>>({});
  const pendingLoadingRef = useRef<Record<string, boolean>>({});
  const flushRafRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    flushRafRef.current = null;
    const offers = pendingOffersRef.current;
    const loading = pendingLoadingRef.current;
    pendingOffersRef.current = {};
    pendingLoadingRef.current = {};

    const offerKeys = Object.keys(offers);
    if (offerKeys.length > 0) {
      setSourceOffers((prev) => {
        const next = { ...prev, ...offers };
        sourceOffersRef.current = next;
        return next;
      });
    }

    const loadingKeys = Object.keys(loading);
    if (loadingKeys.length > 0) {
      setLoadingSourceOffers((prev) => {
        const next = { ...prev, ...loading };
        loadingSourceOffersRef.current = next;
        return next;
      });
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushRafRef.current != null) return;
    flushRafRef.current = requestAnimationFrame(flushPending);
  }, [flushPending]);

  useEffect(() => {
    return () => {
      fetchGenerationRef.current += 1;
      if (flushRafRef.current != null) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
    };
  }, []);

  const fetchSourceOffersForArticle = useCallback(async (articleNumber: string) => {
    if (!articleNumber) return;
    const generation = fetchGenerationRef.current;
    pendingLoadingRef.current[articleNumber] = true;
    scheduleFlush();
    try {
      const res = await getSourceOffers(articleNumber);
      if (generation !== fetchGenerationRef.current) return;
      if (res.success && res.data) {
        pendingOffersRef.current[articleNumber] = res.data;
      }
    } catch (e) {
      console.error("Failed to fetch source offers", e);
    } finally {
      if (generation !== fetchGenerationRef.current) return;
      pendingLoadingRef.current[articleNumber] = false;
      scheduleFlush();
    }
  }, [scheduleFlush]);

  const triggerSourceOffersForSearchItems = useCallback(
    (searchItems: { articleNumber?: string }[]) => {
      const toFetch: string[] = [];
      const loadingPatch: Record<string, boolean> = {};
      searchItems.forEach((item) => {
        const articleNum = item.articleNumber;
        if (
          articleNum &&
          articleNum !== "N/A" &&
          !sourceOffersRef.current[articleNum] &&
          !loadingSourceOffersRef.current[articleNum] &&
          pendingLoadingRef.current[articleNum] !== true
        ) {
          loadingPatch[articleNum] = true;
          loadingSourceOffersRef.current[articleNum] = true;
          toFetch.push(articleNum);
        }
      });
      if (toFetch.length === 0) return;
      Object.assign(pendingLoadingRef.current, loadingPatch);
      scheduleFlush();
      toFetch.forEach((articleNum) => {
        void fetchSourceOffersForArticle(articleNum);
      });
    },
    [fetchSourceOffersForArticle, scheduleFlush]
  );

  const mergeJobSourceOffers = useCallback((jobItems: SearchJobItemRecord[]) => {
    setSourceOffers((prev) => {
      const next = { ...prev };
      jobItems.forEach((row) => {
        const rowOffers = row.payload?.sourceOffers;
        if (row.articleNumber && rowOffers && rowOffers.length > 0) {
          next[row.articleNumber] = rowOffers;
        }
      });
      sourceOffersRef.current = next;
      return next;
    });
  }, []);

  const openSourceOfferModal = useCallback((articleNumber: string) => {
    const items = sourceOffersRef.current[articleNumber];
    if (!items?.length) return;
    setSelectedSourceOffers(items);
    setSourceOfferModalArticleNumber(articleNumber);
    setIsSourceOfferModalOpen(true);
  }, []);

  return {
    sourceOffers,
    loadingSourceOffers,
    selectedSourceOffers,
    sourceOfferModalArticleNumber,
    isSourceOfferModalOpen,
    setIsSourceOfferModalOpen,
    triggerSourceOffersForSearchItems,
    mergeJobSourceOffers,
    openSourceOfferModal,
  };
}
