"use client";

import { useCallback, useRef, useState } from "react";
import { getSourceOffers } from "@/app/actions/source-offers";
import type { SearchJobItemRecord } from "@/types/search-job";
import type { SourceOffer } from "@/types/source-offer";

/**
 * 검색 결과 품번의 외부 원가 오퍼 조회·모달.
 * 이미 있거나 로딩 중인 품번은 재요청하지 않는다.
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

  const fetchSourceOffersForArticle = useCallback(async (articleNumber: string) => {
    if (!articleNumber) return;
    setLoadingSourceOffers((prev) => ({ ...prev, [articleNumber]: true }));
    try {
      const res = await getSourceOffers(articleNumber);
      if (res.success && res.data) {
        setSourceOffers((prev) => ({ ...prev, [articleNumber]: res.data }));
      }
    } catch (e) {
      console.error("Failed to fetch source offers", e);
    } finally {
      setLoadingSourceOffers((prev) => ({ ...prev, [articleNumber]: false }));
    }
  }, []);

  const triggerSourceOffersForSearchItems = useCallback(
    (searchItems: { articleNumber?: string }[]) => {
      searchItems.forEach((item) => {
        const articleNum = item.articleNumber;
        if (
          articleNum &&
          articleNum !== "N/A" &&
          !sourceOffersRef.current[articleNum] &&
          !loadingSourceOffersRef.current[articleNum]
        ) {
          void fetchSourceOffersForArticle(articleNum);
        }
      });
    },
    [fetchSourceOffersForArticle]
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
