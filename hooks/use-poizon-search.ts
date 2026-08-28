"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";
import {
  enqueueSearchJob,
  getActedSearchJobItems,
  getSearchJobDetail,
} from "@/app/actions/search-jobs";
import { getExcludedArticles } from "@/app/actions/excluded-articles";
import { useSearchJobsRefresh } from "@/components/providers/search-jobs-provider";
import {
  applyStatsToItemData,
  brandItemKey,
  buildStatsMaps,
  extractBrandResultsFromResponse,
  getSpuKeyFromItem,
  pushSearchItemFromRaw,
} from "@/lib/search/search-item";
import { getBrandProgress, saveBrandProgress, type BrandProgress } from "@/lib/search/brand-progress";
import {
  addSearchHistory,
  readSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/search/search-history";
import {
  applySearchExclusionFilters,
  filterItemsBySearchExclusion,
  loadSearchExclusionContext,
  type SearchExclusionContext,
  type SearchExclusionOptions,
} from "@/lib/search/client-exclusion";
import {
  SEARCH_JOB_BRAND_PAGE_SIZE,
  SEARCH_JOB_MAX_ITEMS,
  type SearchJobItemRecord,
} from "@/types/search-job";

export type SearchBoardVariant = "live" | "job";

export interface UsePoizonSearchOptions {
  variant?: SearchBoardVariant;
  /** 검색 작업 보드에서만 사용. 라이브 조회는 읽지 않는다. */
  jobId?: string | null;
  excludeSkippedOnSearch: boolean;
  excludeReviewedOnSearch: boolean;
  mergeSearchExclusionContext: (ctx: SearchExclusionContext) => void;
  showFeedback: (msg: string) => void;
  onSearchItems: (items: any[]) => void;
  mergeJobSourceOffers: (jobItems: SearchJobItemRecord[]) => void;
  mergeJobRecommendations: (jobItems: SearchJobItemRecord[]) => void;
}

/**
 * 품번/브랜드 검색, 백그라운드 잡 등록, 잡 결과 로드(job variant), 브랜드 더 보기.
 * live와 job은 인스턴스를 분리해 items를 공유하지 않는다.
 */
export function usePoizonSearch(options: UsePoizonSearchOptions) {
  const variant = options.variant ?? "live";
  const refreshJobs = useSearchJobsRefresh();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const searchRunIdRef = useRef(0);

  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<"article" | "brand">("article");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchInFlight, setIsSearchInFlight] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [lastBrandKeyword, setLastBrandKeyword] = useState("");
  const [brandLastApiPage, setBrandLastApiPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [cachedBrandId, setCachedBrandId] = useState<number | string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [brandHint, setBrandHint] = useState<BrandProgress | null>(null);
  const [excludedArticles, setExcludedArticles] = useState<string[]>([]);

  useEffect(() => {
    if (searchType !== "brand" || !keyword.trim()) {
      setBrandHint(null);
      return;
    }
    setBrandHint(getBrandProgress(keyword));
  }, [keyword, searchType]);

  useEffect(() => {
    setSearchHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    return () => {
      searchRunIdRef.current += 1;
    };
  }, []);

  const handleBackgroundSearch = async () => {
    const searchKeyword = keyword.trim();
    if (!searchKeyword) return;

    setIsEnqueuing(true);
    setError(null);
    try {
      const res = await enqueueSearchJob({
        type: searchType,
        keyword: searchKeyword,
        options: {
          pageSize: SEARCH_JOB_BRAND_PAGE_SIZE,
          maxItems: SEARCH_JOB_MAX_ITEMS,
          ...(searchType === "brand" ? { brandPage: 1 } : {}),
        },
      });

      if (!res.success) {
        setError(res.error ?? "백그라운드 검색 등록에 실패했습니다.");
        return;
      }

      setSearchHistory(addSearchHistory(searchKeyword, searchType));
      setKeyword("");
      optionsRef.current.showFeedback(
        "백그라운드 수집을 등록했습니다. 손 안 댄 품번을 최대 500개까지 모읍니다."
      );
      void refreshJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsEnqueuing(false);
    }
  };

  const jobId = options.jobId ?? null;
  useEffect(() => {
    if (variant !== "job") return;
    if (!jobId || loadedJobId === jobId) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getSearchJobDetail(jobId);
        if (cancelled) return;

        if (!res.success || !res.job || !res.items) {
          setError(res.error ?? "검색 작업 결과를 불러오지 못했습니다.");
          return;
        }

        optionsRef.current.mergeJobRecommendations(res.items);
        optionsRef.current.mergeJobSourceOffers(res.items);
        setItems(res.items.map((row) => row.payload));
        setSearchType(res.job.type);
        setLastBrandKeyword(res.job.keyword);
        setTotalCount(res.job.options.brandTotal ?? res.items.length);

        if (res.job.type === "brand") {
          setBrandLastApiPage(res.job.options.brandPage ?? 1);
          if (res.job.options.brandId != null) setCachedBrandId(res.job.options.brandId);
        }

        setLoadedJobId(jobId);
        optionsRef.current.showFeedback(
          `검색 작업 결과 ${res.items.length}건을 불러왔습니다.`
        );
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [variant, jobId, loadedJobId]);

  const handleSearch = async (
    page: number = 1,
    isBrandLoadMore = false,
    override?: { keyword?: string; type?: "article" | "brand" }
  ) => {
    const {
      excludeSkippedOnSearch,
      excludeReviewedOnSearch,
      mergeSearchExclusionContext,
      showFeedback,
      onSearchItems,
    } = optionsRef.current;

    const activeType = override?.type ?? searchType;
    const searchKeyword = (page === 1 && !isBrandLoadMore)
      ? (override?.keyword ?? keyword).trim()
      : lastBrandKeyword;
    if (!searchKeyword) return;

    if (page === 1 && !isBrandLoadMore) {
      setSearchHistory(addSearchHistory(searchKeyword, activeType));
    }

    const runId = ++searchRunIdRef.current;
    const stale = () => runId !== searchRunIdRef.current;

    setIsLoading(true);
    setIsSearchInFlight(true);
    setError(null);

    try {
      if (activeType === "article") {
        const newItems: any[] = [];
        const searchTerms = searchKeyword.split(",").map(k => k.trim()).filter(k => k.length > 0);

        const searchPromises = searchTerms.map(term => searchPoizonItems(term));
        const searchResults = await Promise.all(searchPromises);
        if (stale()) return;

        const validItemDataList: { data: any, term: string }[] = [];
        const spuIdsForStats: number[] = [];

        searchResults.forEach((res, index) => {
          if (res.success && res.data) {
            let itemData = res.data.data || res.data;
            if (Array.isArray(itemData)) itemData = itemData[0];

            if (itemData) {
              validItemDataList.push({ data: itemData, term: searchTerms[index] });
              const sId = Number(itemData.spuInfo?.spuId || itemData.spuId || itemData.goodsId);
              if (sId) spuIdsForStats.push(sId);
            }
          }
        });

        if (spuIdsForStats.length > 0) {
          const [statsResKR, statsResCN] = await Promise.all([
            getSpuStatistics(spuIdsForStats, ["KR"]),
            getSpuStatistics(spuIdsForStats, ["CN"]),
          ]);
          if (stale()) return;

          const { statsMapKR, statsMapCN } = buildStatsMaps(statsResKR, statsResCN);

          validItemDataList.forEach((itemEntry) => {
            applyStatsToItemData(itemEntry.data, statsMapKR, statsMapCN);
          });
        }

        validItemDataList.forEach(itemEntry => {
          pushSearchItemFromRaw(itemEntry.data, newItems, itemEntry.term);
        });

        const curExcludedRes = await getExcludedArticles();
        if (stale()) return;
        const curExcluded = curExcludedRes.success && curExcludedRes.data ? curExcludedRes.data.map((r: any) => r.article_number) : [];
        setExcludedArticles(curExcluded);
        const filteredItems = newItems.filter(item => !curExcluded.includes(item.articleNumber));

        const itemKey = (it: any) => String(it.id ?? it.articleNumber);
        const seenInBatch = new Set<string>();
        const uniqueNewItems = filteredItems.filter((it) => {
          const key = itemKey(it);
          if (seenInBatch.has(key)) return false;
          seenInBatch.add(key);
          return true;
        });

        const exclusion = await applySearchExclusionFilters(uniqueNewItems, {
          excludeSkipped: excludeSkippedOnSearch,
          excludeReviewed: excludeReviewedOnSearch,
        });
        if (stale()) return;
        mergeSearchExclusionContext(exclusion);

        if (exclusion.excludedCount > 0) {
          const labels = [
            excludeSkippedOnSearch ? "스킵" : null,
            excludeReviewedOnSearch ? "검토완료" : null,
          ].filter(Boolean);
          showFeedback(`${exclusion.excludedCount}건 검색에서 제외 (${labels.join(", ")})`);
        }

        if (exclusion.items.length > 0) {
          onSearchItems(exclusion.items);
          setItems(prev => {
            const newKeys = new Set(exclusion.items.map(itemKey));
            const newArticles = new Set(exclusion.items.map((it) => it.articleNumber));
            const remainingPrev = prev.filter(
              (p) => !newKeys.has(itemKey(p)) && !newArticles.has(p.articleNumber)
            );
            return [...exclusion.items, ...remainingPrev];
          });
          setKeyword("");
        } else if (uniqueNewItems.length > 0 && exclusion.excludedCount === 0) {
          showFeedback("추가할 신규 품번이 없습니다.");
        }
      } else {
        const isLoadMore = isBrandLoadMore;
        const apiPage = isLoadMore ? brandLastApiPage + 1 : 1;
        const sameBrand = searchKeyword.trim().toLowerCase() === lastBrandKeyword.trim().toLowerCase();
        const brandIdToUse = isLoadMore || sameBrand ? cachedBrandId : null;
        const exclusionOptions: SearchExclusionOptions = {
          excludeSkipped: excludeSkippedOnSearch,
          excludeReviewed: excludeReviewedOnSearch,
        };

        const res = await searchPoizonByBrand(searchKeyword, apiPage, pageSize, brandIdToUse);
        if (stale()) return;
        if (!res.success || !res.data) {
          setError(res.error || "검색 무효");
          return;
        }

        if (res.brandId != null) setCachedBrandId(res.brandId);

        const results = extractBrandResultsFromResponse(res.data);
        if (results.length === 0) {
          if (isLoadMore) {
            showFeedback("더 이상 불러올 상품이 없습니다.");
          } else {
            setError("검색 결과가 없습니다.");
            setItems([]);
            setBrandLastApiPage(0);
          }
          setLastBrandKeyword(searchKeyword);
          saveBrandProgress(searchKeyword, {
            page: apiPage,
            brandId: res.brandId ?? cachedBrandId,
            total: res.total || totalCount,
          });
          return;
        }

        const spuIds = results.map((item: any) => item.spuId || item.goodsId).filter(Boolean);
        let enrichedResults = results;
        if (spuIds.length > 0) {
          const [statsResKR, statsResCN] = await Promise.all([
            getSpuStatistics(spuIds, ["KR"]),
            getSpuStatistics(spuIds, ["CN"]),
          ]);
          if (stale()) return;
          const { statsMapKR, statsMapCN } = buildStatsMaps(statsResKR, statsResCN);
          enrichedResults = results.map((item) => {
            const merged = { ...item };
            applyStatsToItemData(merged, statsMapKR, statsMapCN);
            return merged;
          });
        }

        const newItems: any[] = [];
        for (const item of enrichedResults) {
          pushSearchItemFromRaw(item, newItems, searchKeyword);
        }

        const curExcludedRes = await getExcludedArticles();
        if (stale()) return;
        const curExcluded =
          curExcludedRes.success && curExcludedRes.data
            ? curExcludedRes.data.map((r: any) => r.article_number)
            : [];
        setExcludedArticles(curExcluded);

        const seenBrandKeys = new Set<string>();
        const uniqueBrandItems = newItems.filter((it) => {
          if (curExcluded.includes(it.articleNumber)) return false;
          const key = brandItemKey(it);
          if (seenBrandKeys.has(key)) return false;
          seenBrandKeys.add(key);
          return true;
        });

        const spuKeys = [...new Set(uniqueBrandItems.map(getSpuKeyFromItem).filter(Boolean))];
        const exclusionCtx = await loadSearchExclusionContext(exclusionOptions, spuKeys);
        if (stale()) return;
        const { items: itemsToAdd, excludedCount } = filterItemsBySearchExclusion(
          uniqueBrandItems,
          exclusionOptions,
          exclusionCtx
        );
        mergeSearchExclusionContext(exclusionCtx);

        if (excludedCount > 0) {
          const labels = [
            excludeSkippedOnSearch ? "스킵" : null,
            excludeReviewedOnSearch ? "검토완료" : null,
          ].filter(Boolean);
          showFeedback(`${excludedCount}건 검색에서 제외 (${labels.join(", ")})`);
        }

        if (itemsToAdd.length > 0) {
          onSearchItems(itemsToAdd);
        }

        setBrandLastApiPage(apiPage);
        setTotalCount(res.total || 0);
        setLastBrandKeyword(searchKeyword);
        saveBrandProgress(searchKeyword, {
          page: apiPage,
          brandId: res.brandId ?? cachedBrandId,
          total: res.total || 0,
        });

        if (isLoadMore) {
          setItems((prev) => {
            const existingKeys = new Set(prev.map(brandItemKey));
            const appended = itemsToAdd.filter((it) => !existingKeys.has(brandItemKey(it)));
            return [...prev, ...appended];
          });
        } else {
          setItems(itemsToAdd);
          setKeyword("");
        }
      }
    } catch (err: any) {
      if (!stale()) setError(err.message);
    } finally {
      if (!stale()) {
        setIsLoading(false);
        setIsSearchInFlight(false);
      }
    }
  };

  const stopSearch = useCallback(() => {
    searchRunIdRef.current += 1;
    setIsLoading(false);
    setIsLoadingMore(false);
    setIsSearchInFlight(false);
  }, []);

  const handleLoadMore = async () => {
    if (isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      await handleSearch(1, true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleMergeActedItems = async () => {
    const searchKeyword = (lastBrandKeyword || keyword).trim();
    if (!searchKeyword) {
      optionsRef.current.showFeedback("합칠 검색어가 없습니다. 결과 보기로 불러오거나 브랜드를 입력하세요.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await getActedSearchJobItems({
        type: searchType,
        keyword: searchKeyword,
      });
      if (!res.success) {
        setError(res.error ?? "손댄 품번을 불러오지 못했습니다.");
        return;
      }

      const incoming = res.items;
      if (incoming.length === 0) {
        optionsRef.current.showFeedback("같은 검색어로 손댄 품번이 없습니다.");
        return;
      }

      optionsRef.current.mergeJobSourceOffers(incoming);
      optionsRef.current.mergeJobRecommendations(incoming);

      const existingKeys = new Set(items.map(brandItemKey));
      const extra = incoming
        .map((row) => row.payload)
        .filter((item) => {
          const key = brandItemKey(item);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

      if (extra.length > 0) {
        setItems((prev) => [...extra, ...prev]);
      }

      optionsRef.current.showFeedback(
        extra.length > 0
          ? `손댄 품번 ${extra.length}건을 목록에 합쳤습니다. 가격이 오래됐으면 선택 후 갱신하세요.`
          : "손댄 품번은 이미 목록에 있습니다."
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearchResults = () => {
    setItems([]);
    setError(null);
    setTotalCount(0);
    setBrandLastApiPage(0);
    setLoadedJobId(null);
  };

  return {
    keyword,
    setKeyword,
    searchType,
    setSearchType,
    searchHistory,
    setSearchHistory,
    isLoading,
    isSearchInFlight,
    isEnqueuing,
    items,
    setItems,
    error,
    pageSize,
    setPageSize,
    brandLastApiPage,
    totalCount,
    isLoadingMore,
    brandHint,
    setExcludedArticles,
    handleSearch,
    stopSearch,
    handleBackgroundSearch,
    handleLoadMore,
    handleMergeActedItems,
    clearSearchResults,
    loadedJobId,
    lastBrandKeyword,
  };
}
