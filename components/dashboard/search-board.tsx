"use client";

import React, { useState, useEffect } from "react";
import { 
  Loader2, CheckCircle2, AlertCircle, X,
  Ban, Clock, Plus
} from "lucide-react";
import { getSkuSalesValue } from "@/lib/utils/sales-volume";
import {
  getChildSkuIds,
  resolveSkuId,
} from "@/lib/search/search-item";
import {
  COLUMN_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  parseNumber,
  type SortKey,
} from "@/lib/search/column-layout";
import {
  SEARCH_EXCLUDE_REVIEWED_KEY,
  SEARCH_EXCLUDE_SKIPPED_KEY,
  readSearchExcludePref,
  writeSearchExcludePref,
} from "@/lib/search/search-prefs";
import {
  isSpuFullySkipped,
  type SearchExclusionContext,
} from "@/lib/search/client-exclusion";
import { refreshSearchItemPrices } from "@/app/actions/search-jobs";
import type { SearchJobItemRecord } from "@/types/search-job";
import { executeBidding, getBidHistoryBySkuIds, type BidPayload, type ExistingBidInfo, type ExecuteBiddingMode } from "@/app/actions/bidding";
import { getSystemSettings } from "@/app/actions/settings";
import { addExcludedArticle } from "@/app/actions/excluded-articles";
import { usePoizonSearch, type SearchBoardVariant } from "@/hooks/use-poizon-search";
import { useSkuRecommendationQueue } from "@/hooks/use-sku-recommendation-queue";
import { useSourceOffers } from "@/hooks/use-source-offers";
import { exposureBidInputAmount } from "@/lib/utils/exposure-price";
import { getSkippedItems, addSkippedItems, removeSkippedItems } from "@/app/actions/skipped-items";
import { getItemStatuses, setItemHandled, setItemMemo, type ItemStatus } from "@/app/actions/item-status";
import { getSkuStatuses, getSkuStatusesBySpuIds, setSkuMemo, setSkuManualBidMarked, setSkuStockMarked, setSkuWatchPrice, setSkuHandled, setManySkuHandled } from "@/app/actions/sku-status";
import { getSkuLastActivity, type SkuActivity } from "@/lib/utils/sku-activity";
import { EMPTY_SKU_STATUS, type SkuStatus } from "@/types/sku-status";
import { calculateMargin, DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/utils/calculate-margin";
import { skuListPrice, skuOfferProfit } from "@/lib/search/sku-display";
import { isHighProfit } from "@/lib/utils/high-profit";
import { currentExposureAmount, isPriceWatchHit, parsePositiveWon } from "@/lib/utils/price-watch";
import { formatBidDate } from "@/lib/utils/poizon-listing";
import { isTransientActionError } from "@/lib/utils";
import { getBestSourceOfferPrice } from "@/lib/sourcing/source-offer-view";
import { MarginSettingsDialog } from "./margin-settings-dialog";
import { type BidDisplaySource, type BidStatusInfo } from "./bid-status-indicator";
import { type ReviewCheckState } from "./review-check-button";
import { type DisplayFilter, type WorkspaceView } from "./dashboard-view-tabs";
import { SearchBoardToolbar, toolbarBtn } from "./search-board-toolbar";
import { SearchBoardResultsTable } from "./search-board-results-table";
import {
  SearchBoardTableProvider,
  type SearchBoardTableContextValue,
} from "./search-board-table-context";
import { SourceOfferResultsDialog } from "./source-offer-results-dialog";

export function SearchBoard({
  variant = "live",
  jobId = null,
}: {
  variant?: SearchBoardVariant;
  jobId?: string | null;
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // 입찰가 액션용 State
  const [biddingPrices, setBiddingPrices] = useState<Record<string, string>>({});
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>({});
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const rowToggleSuppressRef = React.useRef<string | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 품번 제외용 State
  const [isExcludeModalOpen, setIsExcludeModalOpen] = useState(false);
  const [itemToExclude, setItemToExclude] = useState<{ articleNumber: string, title: string, idx: number } | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [isExcluding, setIsExcluding] = useState(false);

  // 열 너비 조절 기능
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({ ...DEFAULT_COLUMN_WIDTHS });

  // 정렬 상태 (숫자형 컬럼 클릭 정렬)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  // 비차단 인라인 피드백 (alert 대체)
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2200);
  };

  const setExcludeSkippedOnSearchPref = (value: boolean) => {
    setExcludeSkippedOnSearch(value);
    writeSearchExcludePref(SEARCH_EXCLUDE_SKIPPED_KEY, value);
  };

  const setExcludeReviewedOnSearchPref = (value: boolean) => {
    setExcludeReviewedOnSearch(value);
    writeSearchExcludePref(SEARCH_EXCLUDE_REVIEWED_KEY, value);
  };

  const mergeSearchExclusionContext = React.useCallback((ctx: SearchExclusionContext) => {
    if (Object.keys(ctx.itemStatuses).length > 0) {
      setItemStatuses((prev) => ({ ...prev, ...ctx.itemStatuses }));
    }
    if (Object.keys(ctx.skuStatuses).length > 0) {
      setSkuStatuses((prev) => ({ ...prev, ...ctx.skuStatuses }));
    }
    if (ctx.skippedSkuIds.size > 0) {
      setSkippedSkuIds((prev) => new Set([...prev, ...ctx.skippedSkuIds]));
    }
  }, []);

  const [skippedSkuIds, setSkippedSkuIds] = useState<Set<string>>(new Set());
  const [skippedAtBySku, setSkippedAtBySku] = useState<Record<string, string>>({});

  const [resizing, setResizing] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [bidHistoryBySku, setBidHistoryBySku] = useState<Record<string, BidStatusInfo>>({});
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("hierarchy");
  const [watchFocus, setWatchFocus] = useState(false);
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [excludeSkippedOnSearch, setExcludeSkippedOnSearch] = useState(() =>
    readSearchExcludePref(SEARCH_EXCLUDE_SKIPPED_KEY, true)
  );
  const [excludeReviewedOnSearch, setExcludeReviewedOnSearch] = useState(() =>
    readSearchExcludePref(SEARCH_EXCLUDE_REVIEWED_KEY, true)
  );
  const isFlatView = workspaceView !== "hierarchy";
  const isProfitableView = workspaceView === "profitable";

  const {
    skuRecommendations,
    loadingRecommendations,
    queueRecommendationFetch,
    cancelRecommendations,
    hydrateRecommendations,
  } = useSkuRecommendationQueue();

  const {
    sourceOffers,
    loadingSourceOffers,
    selectedSourceOffers,
    sourceOfferModalArticleNumber,
    isSourceOfferModalOpen,
    setIsSourceOfferModalOpen,
    triggerSourceOffersForSearchItems,
    mergeJobSourceOffers,
    openSourceOfferModal,
  } = useSourceOffers();

  const {
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
  } = usePoizonSearch({
    variant,
    jobId,
    excludeSkippedOnSearch,
    excludeReviewedOnSearch,
    mergeSearchExclusionContext,
    showFeedback,
    onSearchItems: triggerSourceOffersForSearchItems,
    mergeJobSourceOffers,
    mergeJobRecommendations: (jobItems: SearchJobItemRecord[]) => {
      const recs: Record<string, unknown> = {};
      jobItems.forEach((row) => {
        const map = row.payload?.skuRecommendations;
        if (!map) return;
        Object.assign(recs, map);
      });
      hydrateRecommendations(recs);
    },
  });

  interface DuplicateBidConflict {
    payload: BidPayload;
    existing: ExistingBidInfo;
    sizeInfo?: string;
  }
  const [duplicateBidModal, setDuplicateBidModal] = useState<{
    conflicts: DuplicateBidConflict[];
  } | null>(null);

  // 품번(SPU) 처리 상태/메모 (영구 저장)
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({});
  const [memoEditor, setMemoEditor] = useState<{ spuId: string; value: string } | null>(null);
  const [skuStatuses, setSkuStatuses] = useState<Record<string, SkuStatus>>({});
  const [skuMemoEditor, setSkuMemoEditor] = useState<{ skuId: string; spuId?: string; value: string } | null>(null);
  const [savingSkuMemo, setSavingSkuMemo] = useState<Record<string, boolean>>({});
  const [savingManualBid, setSavingManualBid] = useState<Record<string, boolean>>({});
  const savingManualBidRef = React.useRef<Record<string, boolean>>({});
  const manualBidSaveSeqRef = React.useRef<Record<string, number>>({});
  const [savingStockMarked, setSavingStockMarked] = useState<Record<string, boolean>>({});
  const savingStockMarkedRef = React.useRef<Record<string, boolean>>({});
  const stockMarkedSaveSeqRef = React.useRef<Record<string, number>>({});
  const [savingWatch, setSavingWatch] = useState<Record<string, boolean>>({});
  const savingWatchRef = React.useRef<Record<string, boolean>>({});
  const watchSaveSeqRef = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    savingManualBidRef.current = savingManualBid;
  }, [savingManualBid]);

  React.useEffect(() => {
    savingStockMarkedRef.current = savingStockMarked;
  }, [savingStockMarked]);

  React.useEffect(() => {
    savingWatchRef.current = savingWatch;
  }, [savingWatch]);

  const mergeSkuStatusFromServer = React.useCallback(
    (prev: Record<string, SkuStatus>, serverData: Record<string, SkuStatus>) => {
      const merged = { ...prev };
      for (const [id, status] of Object.entries(serverData)) {
        if (savingManualBidRef.current[id] || savingStockMarkedRef.current[id] || savingWatchRef.current[id]) continue;
        merged[id] = status;
      }
      return merged;
    },
    []
  );

  const defaultSkuStatus = (prev?: SkuStatus): SkuStatus => ({
    ...EMPTY_SKU_STATUS,
    ...prev,
  });

  useEffect(() => {
    const savedWidths = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (savedWidths) {
      try {
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(savedWidths) });
      } catch (e) {
        console.error("Failed to parse saved widths", e);
      }
    }
  }, []);

  const persistWidths = (widths: { [key: string]: number }) => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error("Failed to persist widths", e);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(column);
    
    const startX = e.pageX;
    const startWidth = columnWidths[column];
    let finalWidths = columnWidths;
    
    const minWidth = column === "manage" ? 150 : 60;
    const handleMouseMove = (updateEvent: MouseEvent) => {
      const newWidth = Math.max(minWidth, startWidth + (updateEvent.pageX - startX));
      setColumnWidths(prev => {
        finalWidths = { ...prev, [column]: newWidth };
        return finalWidths;
      });
    };
    
    const handleMouseUp = () => {
      setResizing(null);
      persistWidths(finalWidths); // 드래그 종료 시 자동 저장
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 헤더 더블클릭 시 해당 컬럼 기본 너비로 복원
  const resetColumnWidth = (column: string) => {
    if (DEFAULT_COLUMN_WIDTHS[column] === undefined) return;
    setColumnWidths(prev => {
      const next = { ...prev, [column]: DEFAULT_COLUMN_WIDTHS[column] };
      persistWidths(next);
      return next;
    });
  };

  // 모든 컬럼 너비 초기화
  const resetAllWidths = () => {
    const next = { ...DEFAULT_COLUMN_WIDTHS };
    setColumnWidths(next);
    persistWidths(next);
    showFeedback("열 너비를 기본값으로 초기화했습니다.");
  };

  // 정렬 토글 (오름차순 → 내림차순 → 해제)
  const toggleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const getSortValue = (key: SortKey, source: { item: any; sku?: any; naverPrice?: any; profit?: number }): number => {
    const { item, sku, naverPrice, profit } = source;
    switch (key) {
      case "avg": {
        if (sku) {
          const avgObj = sku.averagePrice;
          return parseNumber(avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0);
        }
        return parseNumber(item.avgPrice);
      }
      case "exposure": {
        if (sku) return parseNumber(sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price);
        return parseNumber(item.minPrice);
      }
      case "naver": {
        const np = naverPrice ?? getBestSourceOfferPrice(sourceOffers, item.articleNumber);
        return parseNumber(np);
      }
      case "profit": {
        if (profit !== undefined) return profit;
        const np = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
        const poizonPriceNum = parseNumber(item.minPrice);
        if (np && poizonPriceNum > 0 && systemSettings) {
          const { fee } = calculateMargin(poizonPriceNum, systemSettings);
          return poizonPriceNum - fee - Number(np);
        }
        return -Infinity;
      }
      case "salesChina": {
        if (sku) {
          return parseNumber(getSkuSalesValue(sku, item.skuStatsCN, "globalSoldNum30") ?? 0);
        }
        return parseNumber(item.salesVolume);
      }
      case "salesLocal": {
        if (sku) {
          return parseNumber(getSkuSalesValue(sku, item.skuStatsCN, "localSoldNum30") ?? 0);
        }
        return parseNumber(item.localSalesVolume);
      }
      default:
        return NaN;
    }
  };

  const applySort = <T,>(rows: T[], getValue: (row: T) => number): T[] => {
    if (!sortConfig) return rows;
    const dir = sortConfig.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const aValid = !isNaN(av) && isFinite(av);
      const bValid = !isNaN(bv) && isFinite(bv);
      // 값이 없는 행은 항상 뒤로 보냄
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return (av - bv) * dir;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, skippedRes] = await Promise.all([
          getSystemSettings(),
          getSkippedItems()
        ]);

        if (settingsRes.success && settingsRes.data) {
          setSystemSettings({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...settingsRes.data,
          });
        }

        if (skippedRes.success && skippedRes.data) {
          setSkippedSkuIds(new Set(skippedRes.data.map((item: any) => String(item.sku_id))));
          const atMap: Record<string, string> = {};
          skippedRes.data.forEach((item: any) => {
            if (item.skipped_at) atMap[String(item.sku_id)] = item.skipped_at;
          });
          setSkippedAtBySku(atMap);
        }
      } catch (e) {
        if (!isTransientActionError(e)) console.error("[search-board] settings/skipped load failed", e);
      }
    };
    fetchData();
  }, []);

  // 입찰 이력 동기화 (SKU 단위) — collectVisibleSkuIds / fetchBidHistory는 flattenedRows 정의 이후에 선언

  // 품번(SPU) 처리 상태/메모 + 옵션(SKU) 검토·메모·입찰표기 동기화
  const fetchAllItemAndSkuStatuses = React.useCallback(async (itemList: typeof items) => {
    const spuIds = itemList
      .map((item) => String(item.id).replace(/[^0-9]/g, ""))
      .filter(Boolean);
    if (spuIds.length === 0) return;

    try {
      const [itemRes, skuRes] = await Promise.all([
        getItemStatuses(spuIds),
        getSkuStatusesBySpuIds(spuIds),
      ]);

      if (itemRes.success && itemRes.data) {
        setItemStatuses((prev) => ({ ...prev, ...itemRes.data }));
      } else if (!itemRes.success) {
        showFeedback(`품번 상태 불러오기 실패: ${itemRes.error ?? "item_status 확인"}`);
      }
      if (skuRes.success && skuRes.data) {
        setSkuStatuses((prev) => mergeSkuStatusFromServer(prev, skuRes.data!));
      } else if (!skuRes.success) {
        showFeedback(`옵션 상태 불러오기 실패: ${skuRes.error ?? "sku_status 확인"}`);
      }
    } catch (e) {
      if (!isTransientActionError(e)) console.error("[search-board] item/sku status load failed", e);
    }
  }, [mergeSkuStatusFromServer]);

  useEffect(() => {
    if (items.length > 0) {
      void fetchAllItemAndSkuStatuses(items);
    }
  }, [items, fetchAllItemAndSkuStatuses]);

  const toggleRow = (id: string, skus?: any[]) => {
    // Flat 뷰에서는 아코디언이 필요 없음
    if (isFlatView) return;

    const rowKey = String(id);
    if (rowToggleSuppressRef.current === rowKey) return;

    const isNowExpanded = !expandedRows[rowKey];
    setExpandedRows(prev => ({ ...prev, [rowKey]: isNowExpanded }));

    if (isNowExpanded && skus && skus.length > 0) {
      skus.forEach((sku) => {
        queueRecommendationFetch(resolveSkuId(sku));
      });
    }
  };

  React.useEffect(() => {
    setBiddingPrices((prev) => {
      const next = { ...prev };
      let changed = false;

      items.forEach((item) => {
        (item.skuDetails || []).forEach((sku: any) => {
          const skuId = resolveSkuId(sku);
          if (!skuId) return;
          const fallback = skuListPrice(sku);
          const recAmount = exposureBidInputAmount(skuRecommendations[skuId]);
          const fallbackAmount = exposureBidInputAmount(undefined, fallback);
          const preferred = recAmount ?? fallbackAmount;
          if (!preferred) return;
          if (!next[skuId]) {
            next[skuId] = preferred;
            changed = true;
            return;
          }
          if (recAmount && fallbackAmount && next[skuId] === fallbackAmount && recAmount !== fallbackAmount) {
            next[skuId] = recAmount;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [skuRecommendations, items]);

  const handleToggleSkip = async (itemOrSku: any, isSku = false) => {
    // 1. 토글할 SKU ID 목록을 먼저 확정하옵니다.
    const skuIdsToToggle: string[] = isSku
      ? [resolveSkuId(itemOrSku)].filter(Boolean)
      : getChildSkuIds(itemOrSku);

    if (skuIdsToToggle.length === 0) {
      showFeedback(
        isSku
          ? "스킵할 옵션을 찾을 수 없습니다."
          : "스킵할 옵션이 없습니다. 검색 결과를 다시 불러와 주세요."
      );
      return;
    }

    // 2. 현재 상태를 확인하옵니다.
    const isCurrentlySkipped = isSku
      ? skippedSkuIds.has(resolveSkuId(itemOrSku))
      : skuIdsToToggle.every((id) => skippedSkuIds.has(id));

    // 3. [낙관적 업데이트] 서버 응답 전에 화면부터 즉시 바꾸어 마마를 기쁘게 해드립시다.
    setSkippedSkuIds(prev => {
      const next = new Set(prev);
      if (isCurrentlySkipped) {
        skuIdsToToggle.forEach(id => next.delete(id));
      } else {
        skuIdsToToggle.forEach(id => next.add(id));
      }
      return next;
    });
    setSkippedAtBySku(prev => {
      const next = { ...prev };
      const now = new Date().toISOString();
      if (isCurrentlySkipped) {
        skuIdsToToggle.forEach(id => delete next[id]);
      } else {
        skuIdsToToggle.forEach(id => { next[id] = now; });
      }
      return next;
    });

    try {
      let res: { success?: boolean; error?: string };
      if (isCurrentlySkipped) {
        res = await removeSkippedItems(skuIdsToToggle);
      } else {
        const itemsToSkip = isSku
          ? [{
              sku_id: skuIdsToToggle[0],
              spu_id: String(itemOrSku.parent?.id || ""),
              article_number: itemOrSku.parent?.articleNumber,
            }]
          : (itemOrSku.skuDetails || [])
              .map((sku: any) => ({
                sku_id: resolveSkuId(sku),
                spu_id: String(itemOrSku.id),
                article_number: itemOrSku.articleNumber,
              }))
              .filter((entry: { sku_id: string }) => !!entry.sku_id);

        res = await addSkippedItems(itemsToSkip);
      }

      if (!res?.success) {
        throw new Error(res?.error || "스킵 상태 저장에 실패했습니다.");
      }

      showFeedback(isCurrentlySkipped ? "스킵을 해제했습니다." : "이 품번의 옵션을 스킵했습니다.");
    } catch (error) {
      console.error("Failed to toggle skip", error);
      showFeedback(error instanceof Error ? error.message : "스킵 처리 중 오류가 발생했습니다.");
      // 실패 시 다시 원래대로 되돌려 정직한 장부를 유지하옵니다.
      setSkippedSkuIds(prev => {
        const next = new Set(prev);
        if (isCurrentlySkipped) {
          skuIdsToToggle.forEach(id => next.add(id));
        } else {
          skuIdsToToggle.forEach(id => next.delete(id));
        }
        return next;
      });
    }
  };

  const toggleSkuSelection = (skuId: string) => {
    setSelectedSkus(prev => ({ ...prev, [skuId]: !prev[skuId] }));
  };

  const handleRefreshSelectedPrices = async () => {
    const selectedItems = items.filter((item) =>
      getChildSkuIds(item).some((id) => selectedSkus[id])
    );
    if (selectedItems.length === 0) {
      showFeedback("가격을 갱신할 품번을 선택하세요.");
      return;
    }

    setIsRefreshingPrices(true);
    try {
      const res = await refreshSearchItemPrices({
        jobId: loadedJobId,
        items: selectedItems,
      });
      if (!res.success || !res.items) {
        showFeedback(res.error ?? "가격 갱신에 실패했습니다.");
        return;
      }

      mergeJobSourceOffers(res.items);
      const recs: Record<string, unknown> = {};
      res.items.forEach((row) => {
        const map = row.payload?.skuRecommendations;
        if (map) Object.assign(recs, map);
      });
      hydrateRecommendations(recs);

      const byId = new Map(res.items.map((row) => [String(row.payload.id), row.payload]));
      setItems((prev) => prev.map((item) => byId.get(String(item.id)) ?? item));
      showFeedback(`선택한 ${res.items.length}개 품번의 노출가·원가를 갱신했습니다.`);
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "가격 갱신 중 오류가 발생했습니다.");
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  const handleBiddingPriceChange = (skuId: string, value: string) => {
    const numStr = value.replace(/[^0-9]/g, "");
    setBiddingPrices(prev => ({ ...prev, [skuId]: numStr }));
  };

  // Flat 뷰(옵션 / 수익 옵션)용 행 계산
  const flattenedRows = React.useMemo(() => {
    if (!isFlatView) return [];

    const rows: any[] = [];
    items.forEach(item => {
      const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
      const cost = naverPrice ? Number(naverPrice) : null;
      const skus = item.skuDetails || [];

      skus.forEach(sku => {
        const skuPriceRaw = skuListPrice(sku);
        const computed = skuOfferProfit(
          skuRecommendations[sku.skuId],
          skuPriceRaw,
          cost,
          systemSettings
        );
        const profit = computed?.profit ?? -999999;

        // 수익 옵션: 원가 로딩 전이면 노출, 가격 확정 후 수익 ≤0이면 제외
        if (isProfitableView && cost && profit <= 0) return;

        rows.push({
          ...sku,
          parent: item,
          profit,
          naverPrice: cost,
          skuPrice: skuPriceRaw
        });
      });
    });
    return rows;
  }, [items, sourceOffers, isFlatView, isProfitableView, systemSettings, skuRecommendations]);

  // --- 카테고리 목록 추출 ---
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    const sortedCategories = Array.from(set).sort();
    return ["전체", ...sortedCategories];
  }, [items]);

  // --- 필터링된 목록 계산 ---
  // 품번이 검토완료(SPU 또는 전 SKU)인지 판정 — 입찰만으로는 미처리 필터에서 숨기지 않음
  const isItemProcessed = React.useCallback((item: any) => {
    const spuId = String(item.id).replace(/[^0-9]/g, "");
    const childSkuIds = getChildSkuIds(item);
    const allSkusReviewed =
      childSkuIds.length > 0 && childSkuIds.every((skuId: string) => !!skuStatuses[skuId]?.handled);
    return !!(itemStatuses[spuId]?.handled || allSkusReviewed);
  }, [itemStatuses, skuStatuses]);

  const getSpuReviewSummary = React.useCallback((item: any) => {
    const childSkuIds = getChildSkuIds(item);
    const spuKey = String(item.id).replace(/[^0-9]/g, "");
    const spuFlagHandled = itemStatuses[spuKey]?.handled ?? false;
    const handledCount = childSkuIds.filter((id: string) => skuStatuses[id]?.handled).length;
    const totalCount = childSkuIds.length;
    const allHandled = spuFlagHandled || (totalCount > 0 && handledCount === totalCount);
    const someHandled = !allHandled && handledCount > 0;
    const reviewState: ReviewCheckState = allHandled ? "all" : someHandled ? "partial" : "none";
    return { childSkuIds, spuKey, handledCount, totalCount, allHandled, someHandled, reviewState };
  }, [itemStatuses, skuStatuses]);

  const getSkuBidViews = React.useCallback((skuId: string, skuStatus?: SkuStatus) => {
    const systemBid = bidHistoryBySku[skuId] ?? null;
    const manualMarked = skuStatus?.manualBidMarked ?? false;
    const manualBid: BidStatusInfo | null = manualMarked
      ? {
          source: "manual" as BidDisplaySource,
          date: skuStatus?.manualBidDate || formatBidDate(new Date().toISOString()),
        }
      : null;
    return { systemBid, manualBid, manualMarked, hasAnyBid: !!systemBid || manualMarked };
  }, [bidHistoryBySku]);

  const getSpuBidSummary = React.useCallback((item: any) => {
    const childSkuIds = getChildSkuIds(item);
    let systemCount = 0;
    let manualCount = 0;
    const bids: Array<{ sizeInfo?: string; price?: number; date: string; source: BidDisplaySource }> = [];

    childSkuIds.forEach((skuId: string) => {
      const sku = (item.skuDetails || []).find((s: any) => resolveSkuId(s) === skuId);
      const status = skuStatuses[skuId];
      const { systemBid, manualBid } = getSkuBidViews(skuId, status);
      const propsRaw = sku?.regionSalePvInfoList || sku?.properties || [];
      const sizeInfo = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ") || systemBid?.sizeInfo;

      if (systemBid) {
        systemCount++;
        bids.push({ sizeInfo, price: systemBid.price, date: systemBid.date, source: "system" });
      } else if (status?.manualBidMarked) {
        manualCount++;
        bids.push({ sizeInfo, date: manualBid?.date ?? formatBidDate(new Date().toISOString()), source: "manual" });
      }
    });

    return { bidCount: systemCount + manualCount, systemCount, manualCount, totalCount: childSkuIds.length, bids };
  }, [bidHistoryBySku, skuStatuses, getSkuBidViews]);

  const passesDisplayFilter = React.useCallback((opts: {
    item: any;
    skuId?: string;
  }) => {
    const { item, skuId } = opts;
    if (displayFilter === "all") return true;

    if (displayFilter === "unprocessed") {
      return !isItemProcessed(item);
    }

    if (displayFilter === "hideReviewed") {
      if (skuId) {
        const spuKey = String(item.id).replace(/[^0-9]/g, "");
        if (itemStatuses[spuKey]?.handled || skuStatuses[skuId]?.handled) return false;
        return true;
      }
      return !isItemProcessed(item);
    }

    if (displayFilter === "hideSkipped") {
      if (skuId) return !skippedSkuIds.has(skuId);
      return !isSpuFullySkipped(item, skippedSkuIds);
    }

    return true;
  }, [displayFilter, isItemProcessed, itemStatuses, skuStatuses, skippedSkuIds]);

  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
      const categoryMatch = selectedCategory === "전체" || item.category === selectedCategory;
      if (!categoryMatch) return false;
      return passesDisplayFilter({ item });
    });
  }, [items, selectedCategory, passesDisplayFilter]);

  const filteredFlattenedRows = React.useMemo(() => {
    return flattenedRows.filter(row => {
      const categoryMatch = selectedCategory === "전체" || row.parent.category === selectedCategory;
      if (!categoryMatch) return false;
      const skuId = resolveSkuId(row);
      if (!passesDisplayFilter({ item: row.parent, skuId })) return false;
      if (!watchFocus) return true;
      return isPriceWatchHit(
        skuStatuses[skuId]?.watchPrice,
        currentExposureAmount(skuRecommendations[row.skuId], row.skuPrice)
      );
    });
  }, [flattenedRows, selectedCategory, passesDisplayFilter, watchFocus, skuStatuses, skuRecommendations]);

  // --- 정렬 적용 (요청: 사용자 중심 정렬) ---
  const sortedItems = React.useMemo(() => {
    if (!sortConfig) return filteredItems;
    return applySort(filteredItems, (item) => getSortValue(sortConfig.key, { item }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, sortConfig, sourceOffers, systemSettings]);

  const sortedFlattenedRows = React.useMemo(() => {
    if (!sortConfig) return filteredFlattenedRows;
    return applySort(filteredFlattenedRows, (row) =>
      getSortValue(sortConfig.key, { item: row.parent, sku: row, naverPrice: row.naverPrice, profit: row.profit })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFlattenedRows, sortConfig, sourceOffers, systemSettings, skuRecommendations]);

  const highProfitCount = React.useMemo(() => {
    if (!systemSettings) return 0;
    if (isFlatView) {
      return filteredFlattenedRows.reduce((n, row) => {
        const profit = skuOfferProfit(
          skuRecommendations[row.skuId],
          row.skuPrice,
          row.naverPrice,
          systemSettings
        );
        return n + (isHighProfit(profit?.profit, systemSettings) ? 1 : 0);
      }, 0);
    }
    let n = 0;
    for (const item of filteredItems) {
      const cost = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
      for (const sku of item.skuDetails || []) {
        const profit = skuOfferProfit(
          skuRecommendations[sku.skuId],
          skuListPrice(sku),
          cost,
          systemSettings
        );
        if (isHighProfit(profit?.profit, systemSettings)) n++;
      }
    }
    return n;
  }, [
    isFlatView,
    filteredFlattenedRows,
    filteredItems,
    sourceOffers,
    skuRecommendations,
    systemSettings,
  ]);

  const watchHitCount = React.useMemo(() => {
    const isHit = (skuId: string, skuPrice: string | number) =>
      isPriceWatchHit(
        skuStatuses[skuId]?.watchPrice,
        currentExposureAmount(skuRecommendations[skuId], skuPrice)
      );

    if (isFlatView) {
      return flattenedRows.reduce((n, row) => {
        const skuId = resolveSkuId(row);
        const categoryMatch = selectedCategory === "전체" || row.parent.category === selectedCategory;
        if (!categoryMatch) return n;
        if (!passesDisplayFilter({ item: row.parent, skuId })) return n;
        return n + (isHit(skuId, row.skuPrice) ? 1 : 0);
      }, 0);
    }

    let n = 0;
    for (const item of filteredItems) {
      for (const sku of item.skuDetails || []) {
        if (isHit(resolveSkuId(sku), skuListPrice(sku))) n++;
      }
    }
    return n;
  }, [
    isFlatView,
    flattenedRows,
    filteredItems,
    selectedCategory,
    passesDisplayFilter,
    skuStatuses,
    skuRecommendations,
  ]);

  const focusHighProfit = () => {
    setWatchFocus(false);
    setWorkspaceView("profitable");
    setSortConfig({ key: "profit", dir: "desc" });
  };

  const focusWatchHits = () => {
    if (watchFocus && workspaceView === "sku") {
      setWatchFocus(false);
      return;
    }
    setWorkspaceView("sku");
    setWatchFocus(true);
  };

  React.useEffect(() => {
    const idsToFetch: string[] = [];
    if (isFlatView) {
      sortedFlattenedRows.forEach((row) => {
        const id = resolveSkuId(row);
        if (id) idsToFetch.push(id);
      });
    } else {
      items.forEach((item) => {
        if (!expandedRows[item.id]) return;
        idsToFetch.push(...getChildSkuIds(item));
      });
    }
    idsToFetch.forEach((id) => queueRecommendationFetch(id));
  }, [isFlatView, sortedFlattenedRows, items, expandedRows, queueRecommendationFetch]);

  const collapseItemRow = React.useCallback((itemId: string | number) => {
    const rowKey = String(itemId);
    rowToggleSuppressRef.current = rowKey;
    window.setTimeout(() => {
      if (rowToggleSuppressRef.current === rowKey) {
        rowToggleSuppressRef.current = null;
      }
    }, 0);
    setExpandedRows((prev) => {
      if (!prev[rowKey]) return prev;
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  }, []);

  const focusNextUnreviewedRow = React.useCallback((currentItemId: string | number) => {
    const currentKey = String(currentItemId);
    const currentIdx = sortedItems.findIndex((it) => String(it.id) === currentKey);
    if (currentIdx < 0) return;

    const nextItem = sortedItems.slice(currentIdx + 1).find((it) => !isItemProcessed(it));
    if (!nextItem) return;

    requestAnimationFrame(() => {
      document
        .querySelector(`[data-spu-row="${CSS.escape(String(nextItem.id))}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [sortedItems, isItemProcessed]);

  // --- 전체 선택(select-all)용 현재 화면의 SKU ID 목록 ---
  const visibleSkuIds = React.useMemo(() => {
    if (isFlatView) {
      return sortedFlattenedRows.map((row) => String(row.skuId)).filter(Boolean);
    }
    return sortedItems.flatMap((item) => getChildSkuIds(item));
  }, [isFlatView, sortedFlattenedRows, sortedItems]);

  const selectedVisibleCount = visibleSkuIds.filter((id) => selectedSkus[id]).length;
  const allVisibleSelected = visibleSkuIds.length > 0 && selectedVisibleCount === visibleSkuIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const fetchBidHistory = React.useCallback(async () => {
    const skuIds = visibleSkuIds.map(Number).filter((id) => !isNaN(id) && id > 0);
    if (skuIds.length === 0) return;

    try {
      const res = await getBidHistoryBySkuIds(skuIds);
      if (res.success && res.data) {
        const historyMap: Record<string, BidStatusInfo> = {};
        res.data.forEach((entry: any) => {
          const key = String(entry.sku_id);
          if (!historyMap[key]) {
            historyMap[key] = {
              price: entry.bid_price,
              date: formatBidDate(entry.created_at),
              createdAt: entry.created_at,
              sizeInfo: entry.size_info || undefined,
              source: "system",
            };
          }
        });
        setBidHistoryBySku((prev) => ({ ...prev, ...historyMap }));
      }
    } catch (e) {
      if (!isTransientActionError(e)) console.error("[search-board] bid history load failed", e);
    }
  }, [visibleSkuIds]);

  const fetchSkuStatuses = React.useCallback(async () => {
    const skuIds = visibleSkuIds.map(Number).filter((id) => !isNaN(id) && id > 0);
    if (skuIds.length === 0) return;

    try {
      const res = await getSkuStatuses(skuIds);
      if (res.success && res.data) {
        setSkuStatuses((prev) => mergeSkuStatusFromServer(prev, res.data!));
      }
    } catch (e) {
      if (!isTransientActionError(e)) console.error("[search-board] sku status load failed", e);
    }
  }, [visibleSkuIds, mergeSkuStatusFromServer]);

  useEffect(() => {
    if (visibleSkuIds.length === 0) return;
    const timer = window.setTimeout(() => {
      void fetchBidHistory();
      void fetchSkuStatuses();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [visibleSkuIds.join(","), fetchBidHistory, fetchSkuStatuses]);

  const buildBidMemoLine = (price: number, date: string) =>
    `입찰완료 ₩${Number(price).toLocaleString()} (${date})`;

  const applyBidSuccessToState = (payloads: BidPayload[]) => {
    const today = formatBidDate(new Date().toISOString());
    const now = new Date().toISOString();

    setBidHistoryBySku((prev) => {
      const next = { ...prev };
      payloads.forEach((p) => {
        const key = String(p.skuId);
        next[key] = {
          price: Number(p.price),
          date: today,
          createdAt: now,
          sizeInfo: p.sizeInfo || resolveSkuSizeInfo(p.skuId),
          source: "system",
        };
      });
      return next;
    });

    setSkuStatuses((prev) => {
      const next = { ...prev };
      payloads.forEach((p) => {
        const key = String(p.skuId);
        const bidLine = buildBidMemoLine(Number(p.price), today);
        const existingMemo = prev[key]?.memo;
        const newMemo = existingMemo ? `${existingMemo}\n${bidLine}` : bidLine;
        next[key] = {
          ...defaultSkuStatus(prev[key]),
          handled: true,
          handledAt: now,
          handledDate: today,
          memo: newMemo,
          updatedAt: now,
        };
        void setSkuMemo(p.skuId, newMemo, p.spuId).catch(() => {});
        void setSkuHandled(p.skuId, true, p.spuId).catch(() => {});
      });
      return next;
    });

    fetchBidHistory();
  };

  const resolveSkuActivity = React.useCallback(
    (skuId: string, skuStatus?: SkuStatus): SkuActivity | null =>
      getSkuLastActivity({
        skuStatus,
        bidCreatedAt: bidHistoryBySku[skuId]?.createdAt ?? null,
        skippedAt: skippedAtBySku[skuId] ?? null,
      }),
    [bidHistoryBySku, skippedAtBySku]
  );

  const setManySelected = (skuIds: string[], value: boolean) => {
    setSelectedSkus((prev) => {
      const next = { ...prev };
      skuIds.forEach((id) => {
        if (value) next[id] = true;
        else delete next[id];
      });
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setManySelected(visibleSkuIds, !allVisibleSelected);
  };

  const [isBidding, setIsBidding] = useState(false);

  const formatBidFeedback = (results: Array<{ success?: boolean; alreadyListed?: boolean; message?: string }>, fallbackError?: string) => {
    const synced = results.filter((r) => r.success && r.alreadyListed);
    const created = results.filter((r) => r.success && !r.alreadyListed);
    const failed = results.filter((r) => !r.success);

    if (created.length > 0 && synced.length > 0) {
      return `${created.length}건 입찰 성공, ${synced.length}건은 실데이터에 이미 입찰 중(내 사이트 동기화 완료).`;
    }
    if (created.length > 0 && failed.length === 0) {
      return created.length === 1
        ? (created[0].message || "입찰 요청이 성공적으로 처리되었습니다.")
        : `${created.length}건의 입찰 요청이 성공적으로 처리되었습니다.`;
    }
    if (synced.length > 0 && failed.length === 0) {
      return synced.length === 1
        ? synced[0].message || "실데이터에 이미 입찰 중입니다. 내 사이트에 동기화했습니다."
        : `${synced.length}건은 실데이터에 이미 입찰 중입니다. 내 사이트에 동기화했습니다.`;
    }
    if (failed.length > 0) {
      const firstError = failed[0]?.message || fallbackError;
      return `${failed.length}건 입찰 실패. 대표 사유: ${firstError}`;
    }
    return fallbackError || "입찰 처리 결과를 확인할 수 없습니다.";
  };

  const runBidding = async (payloads: BidPayload[], mode: ExecuteBiddingMode = "normal") => {
    if (payloads.length === 0) return { success: true as const, data: [] };
    const enriched = payloads.map((p) => ({
      ...p,
      sellerBiddingNo: p.sellerBiddingNo,
      sizeInfo: p.sizeInfo || resolveSkuSizeInfo(p.skuId),
    }));
    const res = await executeBidding(enriched, { mode });
    const results = res.data || [];
    const duplicates = mode === "normal" ? results.filter((r) => r.needsDuplicateConfirm) : [];
    const succeeded = results.filter((r) => r.success);

    if (duplicates.length > 0) {
      const conflicts: DuplicateBidConflict[] = [];
      for (const r of duplicates) {
        const payload = payloads.find((p) => String(p.skuId) === String(r.skuId));
        if (!payload) continue;
        const existing = r.existingBid ?? {
          skuId: Number(payload.skuId),
          bidPrice: 0,
          bidDate: "",
          source: "poizon" as const,
        };
        conflicts.push({
          payload,
          existing,
          sizeInfo: existing.sizeInfo || resolveSkuSizeInfo(payload.skuId),
        });
      }
      if (conflicts.length > 0) setDuplicateBidModal({ conflicts });
    }

    if (succeeded.length > 0) {
      applyBidSuccessToState(
        payloads.filter((p) => succeeded.some((r) => String(r.skuId) === String(p.skuId)))
      );
    }

    if (!(duplicates.length > 0 && results.every((r) => r.needsDuplicateConfirm))) {
      showFeedback(formatBidFeedback(results, results[0]?.message || res.error));
    }
    return res;
  };

  const resolveSkuSizeInfo = (skuId: string | number): string | undefined => {
    for (const item of items) {
      const sku = (item.skuDetails || []).find((s: any) => resolveSkuId(s) === String(skuId));
      if (sku) {
        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
        return propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ") || undefined;
      }
    }
    if (isFlatView) {
      const row = flattenedRows.find((r: any) => String(r.skuId) === String(skuId));
      if (row) {
        const propsRaw = row.regionSalePvInfoList || row.properties || [];
        return propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ") || undefined;
      }
    }
    return undefined;
  };

  const splitPayloadsByExistingBids = (payloads: BidPayload[]) => {
    const conflicts: DuplicateBidConflict[] = [];
    const nonConflicts: BidPayload[] = [];

    for (const payload of payloads) {
      const history = bidHistoryBySku[String(payload.skuId)];
      if (history?.source === "system") {
        conflicts.push({
          payload,
          existing: {
            skuId: Number(payload.skuId),
            bidPrice: history.price ?? 0,
            bidDate: history.date,
            sizeInfo: history.sizeInfo,
            source: "local",
          },
          sizeInfo: resolveSkuSizeInfo(payload.skuId) || history.sizeInfo,
        });
      } else {
        nonConflicts.push(payload);
      }
    }

    return { conflicts, nonConflicts };
  };

  const handleDuplicateConfirm = async (action: "forceRetry" | "updatePrice") => {
    if (!duplicateBidModal) return;
    const { conflicts } = duplicateBidModal;
    setDuplicateBidModal(null);
    setIsBidding(true);

    try {
      for (const conflict of conflicts) {
        const { payload, existing } = conflict;
        const enriched: BidPayload = {
          ...payload,
          sellerBiddingNo: existing.sellerBiddingNo,
          sizeInfo: conflict.sizeInfo || existing.sizeInfo,
        };

        if (action === "updatePrice") {
          if (existing.bidPrice === payload.price) continue;
          await runBidding([enriched], "updatePrice");
        } else {
          await runBidding([enriched], "forceRetry");
        }
      }
    } catch (err: any) {
      showFeedback(
        isTransientActionError(err)
          ? "입찰 요청 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : `오류: ${err.message}`
      );
    } finally {
      setIsBidding(false);
    }
  };

  const handleSingleBid = async (skuId: string | number, spuId: string | number) => {
    const priceStr = biddingPrices[String(skuId)];
    const price = Number(priceStr);
    if (!priceStr || !Number.isFinite(price) || price <= 0) return;

    setIsBidding(true);
    try {
      const payload: BidPayload = { skuId: String(skuId), spuId, price };
      const { conflicts, nonConflicts } = splitPayloadsByExistingBids([payload]);

      if (conflicts.length > 0) {
        setDuplicateBidModal({ conflicts });
        return;
      }

      await runBidding(nonConflicts);
    } catch (err: any) {
      showFeedback(
        isTransientActionError(err)
          ? "입찰 요청 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : `오류: ${err.message}`
      );
    } finally {
      setIsBidding(false);
    }
  };

  const handleBatchBid = async () => {
    const selectedIds = Object.keys(selectedSkus).filter(id => selectedSkus[id]);
    if (selectedIds.length === 0) return;

    // skuId → spuId 매핑 (입찰 이력/처리완료 표시를 위해 spuId 동반)
    const skuToSpu = new Map<string, string>();
    items.forEach((item) => {
      const sId = String(item.id).replace(/[^0-9]/g, "");
      (item.skuDetails || []).forEach((sku: any) => {
        const skuId = resolveSkuId(sku);
        if (skuId) skuToSpu.set(skuId, sId);
      });
    });

    const payloads: BidPayload[] = [];
    for (const skuId of selectedIds) {
      const priceStr = biddingPrices[skuId];
      if (priceStr && Number(priceStr) > 0) {
        const spuId = skuToSpu.get(String(skuId));
        payloads.push({ skuId, price: Number(priceStr), ...(spuId ? { spuId } : {}) });
      }
    }

    if (payloads.length === 0) {
      showFeedback("선택된 옵션 중 입찰가가 입력된 항목이 없습니다.");
      return;
    }

    setIsBidding(true);
    try {
      const { conflicts, nonConflicts } = splitPayloadsByExistingBids(payloads);

      if (nonConflicts.length > 0) {
        await runBidding(nonConflicts);
        setSelectedSkus((prev) => {
          const next = { ...prev };
          nonConflicts.forEach((p) => delete next[String(p.skuId)]);
          return next;
        });
      }

      if (conflicts.length > 0) {
        setDuplicateBidModal({ conflicts });
        return;
      }

      if (nonConflicts.length > 0) {
        setSelectedSkus({});
      }
    } catch (err: any) {
      showFeedback(
        isTransientActionError(err)
          ? "입찰 요청 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : `오류: ${err.message}`
      );
    } finally {
      setIsBidding(false);
    }
  };

  // 품번(SPU) 검토완료 토글 — 전체 옵션 연동, UI 즉시 반영
  const toggleItemHandled = (item: any) => {
    const { spuKey, childSkuIds, allHandled } = getSpuReviewSummary(item);
    if (!spuKey) return;
    const next = !allHandled;
    const prevSpuHandled = itemStatuses[spuKey]?.handled ?? false;
    const prevSkuHandled = Object.fromEntries(
      childSkuIds.map((id) => [id, skuStatuses[id]?.handled ?? false])
    );

    if (next) {
      cancelRecommendations(childSkuIds);
      collapseItemRow(item.id);
      focusNextUnreviewedRow(item.id);
    }

    const now = new Date().toISOString();
    setItemStatuses(prev => ({
      ...prev,
      [spuKey]: { handled: next, memo: prev[spuKey]?.memo ?? null, updatedAt: now },
    }));
    setSkuStatuses(prev => {
      const nextState = { ...prev };
      childSkuIds.forEach((id) => {
        nextState[id] = {
          ...defaultSkuStatus(prev[id]),
          handled: next,
          handledAt: next ? now : null,
          handledDate: next ? formatBidDate(now) : null,
        };
      });
      return nextState;
    });

    void setItemHandled(spuKey, next, { articleNumber: item.articleNumber, title: item.title }).then((res) => {
      if (!res.success) {
        setItemStatuses(prev => ({
          ...prev,
          [spuKey]: {
            handled: prevSpuHandled,
            memo: prev[spuKey]?.memo ?? null,
            updatedAt: prev[spuKey]?.updatedAt ?? null,
          },
        }));
        showFeedback(`처리 상태 저장 실패: ${res.error ?? "테이블 미생성 여부를 확인하세요."}`);
      }
    });

    if (childSkuIds.length > 0) {
      void setManySkuHandled(childSkuIds, next, spuKey).then((res) => {
        if (!res.success) {
          setSkuStatuses(prev => {
            const rolled = { ...prev };
            childSkuIds.forEach((id) => {
              rolled[id] = { ...defaultSkuStatus(prev[id]), handled: prevSkuHandled[id] ?? false };
            });
            return rolled;
          });
          showFeedback(`옵션 검토 상태 저장 실패: ${res.error ?? "sku_status.handled 컬럼을 확인하세요."}`);
        }
      });
    }
  };

  const toggleSkuHandled = (skuId: string, spuId: string, childSkuIds: string[], item?: any) => {
    const current = skuStatuses[skuId]?.handled ?? false;
    const next = !current;
    const prevSpuHandled = itemStatuses[spuId]?.handled ?? false;

    setSkuStatuses(prev => ({
      ...prev,
      [skuId]: {
        ...defaultSkuStatus(prev[skuId]),
        handled: next,
        handledAt: next ? new Date().toISOString() : null,
        handledDate: next ? formatBidDate(new Date().toISOString()) : null,
      },
    }));

    const newHandledCount = childSkuIds.filter((id) =>
      id === skuId ? next : (skuStatuses[id]?.handled ?? false)
    ).length;
    const allNow = childSkuIds.length > 0 && newHandledCount === childSkuIds.length;

    setItemStatuses(prev => ({
      ...prev,
      [spuId]: { handled: allNow, memo: prev[spuId]?.memo ?? null, updatedAt: allNow ? new Date().toISOString() : prev[spuId]?.updatedAt ?? null },
    }));

    if (allNow && item) {
      cancelRecommendations(childSkuIds);
      collapseItemRow(item.id);
      focusNextUnreviewedRow(item.id);
    }

    void setSkuHandled(skuId, next, spuId).then((res) => {
      if (!res.success) {
        setSkuStatuses(prev => ({
          ...prev,
          [skuId]: { ...defaultSkuStatus(prev[skuId]), handled: current },
        }));
        showFeedback(`옵션 검토 상태 저장 실패: ${res.error ?? "sku_status.handled 컬럼을 확인하세요."}`);
      }
    });

    if (allNow !== prevSpuHandled) {
      void setItemHandled(spuId, allNow, {
        articleNumber: item?.articleNumber,
        title: item?.title,
      }).then((res) => {
        if (!res.success) {
          setItemStatuses(prev => ({
            ...prev,
            [spuId]: {
              handled: prevSpuHandled,
              memo: prev[spuId]?.memo ?? null,
              updatedAt: prev[spuId]?.updatedAt ?? null,
            },
          }));
        }
      });
    }
  };

  // 메모 저장
  const handleSaveMemo = async (item: any) => {
    if (!memoEditor) return;
    const spuId = memoEditor.spuId;
    const value = memoEditor.value.trim();
    const prevMemo = itemStatuses[spuId]?.memo ?? null;

    setItemStatuses(prev => ({
      ...prev,
      [spuId]: { handled: prev[spuId]?.handled ?? false, memo: value || null, updatedAt: new Date().toISOString() },
    }));
    setMemoEditor(null);

    const res = await setItemMemo(spuId, value, { articleNumber: item.articleNumber, title: item.title });
    if (!res.success) {
      setItemStatuses(prev => ({
        ...prev,
        [spuId]: { handled: prev[spuId]?.handled ?? false, memo: prevMemo, updatedAt: prev[spuId]?.updatedAt ?? null },
      }));
      showFeedback(`메모 저장 실패: ${res.error ?? "테이블 미생성 여부를 확인하세요."}`);
    } else {
      showFeedback("메모를 저장했습니다.");
    }
  };

  const handleSaveSkuMemo = async (skuId: string, spuId?: string) => {
    if (!skuMemoEditor || skuMemoEditor.skuId !== skuId) return;
    const value = skuMemoEditor.value.trim();
    const prevMemo = skuStatuses[skuId]?.memo ?? null;

    setSkuStatuses((prev) => ({
      ...prev,
      [skuId]: {
        ...defaultSkuStatus(prev[skuId]),
        memo: value || null,
      },
    }));
    setSkuMemoEditor(null);
    setSavingSkuMemo((prev) => ({ ...prev, [skuId]: true }));

    const res = await setSkuMemo(skuId, value, spuId);
    if (!res.success) {
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: { ...defaultSkuStatus(prev[skuId]), memo: prevMemo },
      }));
      showFeedback(`옵션 메모 저장 실패: ${res.error ?? "sku_status 테이블을 확인하세요."}`);
    }
    setSavingSkuMemo((prev) => {
      const next = { ...prev };
      delete next[skuId];
      return next;
    });
  };

  const handleToggleSkuManualBid = async (skuId: string, spuId?: string) => {
    if (savingManualBidRef.current[skuId]) return;

    const seq = (manualBidSaveSeqRef.current[skuId] ?? 0) + 1;
    manualBidSaveSeqRef.current[skuId] = seq;

    let next!: boolean;
    let snapshot: SkuStatus | undefined;

    setSkuStatuses((prev) => {
      snapshot = prev[skuId] ? { ...prev[skuId] } : undefined;
      const current = prev[skuId]?.manualBidMarked ?? false;
      next = !current;
      const now = new Date().toISOString();
      return {
        ...prev,
        [skuId]: {
          ...defaultSkuStatus(prev[skuId]),
          manualBidMarked: next,
          manualBidDate: next ? formatBidDate(now) : null,
          manualBidAt: next ? now : null,
          updatedAt: now,
        },
      };
    });

    savingManualBidRef.current = { ...savingManualBidRef.current, [skuId]: true };
    setSavingManualBid((prev) => ({ ...prev, [skuId]: true }));

    const res = await setSkuManualBidMarked(skuId, next, spuId);

    if (manualBidSaveSeqRef.current[skuId] !== seq) return;

    if (!res.success) {
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: snapshot ?? defaultSkuStatus(),
      }));
      showFeedback(`수동 입찰 표기 실패: ${res.error ?? "sku_status 테이블을 확인하세요."}`);
    } else {
      const now = new Date().toISOString();
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: {
          ...defaultSkuStatus(prev[skuId]),
          manualBidMarked: next,
          manualBidDate: next ? formatBidDate(now) : null,
          manualBidAt: next ? now : null,
          updatedAt: now,
        },
      }));
      showFeedback(next ? "입찰 완료로 수동 표기했습니다." : "수동 입찰 표기를 해제했습니다.");
    }

    const { [skuId]: _, ...restSaving } = savingManualBidRef.current;
    savingManualBidRef.current = restSaving;
    setSavingManualBid((prev) => {
      const n = { ...prev };
      delete n[skuId];
      return n;
    });
  };

  const handleToggleSkuStockMarked = async (skuId: string, spuId?: string) => {
    if (savingStockMarkedRef.current[skuId]) return;

    const seq = (stockMarkedSaveSeqRef.current[skuId] ?? 0) + 1;
    stockMarkedSaveSeqRef.current[skuId] = seq;

    let next!: boolean;
    let snapshot: SkuStatus | undefined;

    setSkuStatuses((prev) => {
      snapshot = prev[skuId] ? { ...prev[skuId] } : undefined;
      const current = prev[skuId]?.stockMarked ?? false;
      next = !current;
      const now = new Date().toISOString();
      return {
        ...prev,
        [skuId]: {
          ...defaultSkuStatus(prev[skuId]),
          stockMarked: next,
          stockMarkedDate: next ? formatBidDate(now) : null,
          stockMarkedAt: next ? now : null,
          updatedAt: now,
        },
      };
    });

    savingStockMarkedRef.current = { ...savingStockMarkedRef.current, [skuId]: true };
    setSavingStockMarked((prev) => ({ ...prev, [skuId]: true }));

    const res = await setSkuStockMarked(skuId, next, spuId);

    if (stockMarkedSaveSeqRef.current[skuId] !== seq) return;

    if (!res.success) {
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: snapshot ?? defaultSkuStatus(),
      }));
      showFeedback(`재고 보유 표기 실패: ${res.error ?? "sku_status 테이블을 확인하세요."}`);
    } else {
      const now = new Date().toISOString();
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: {
          ...defaultSkuStatus(prev[skuId]),
          stockMarked: next,
          stockMarkedDate: next ? formatBidDate(now) : null,
          stockMarkedAt: next ? now : null,
          updatedAt: now,
        },
      }));
      showFeedback(next ? "재고 보유로 표기했습니다." : "재고 보유 표기를 해제했습니다.");
    }

    const { [skuId]: _, ...restSaving } = savingStockMarkedRef.current;
    savingStockMarkedRef.current = restSaving;
    setSavingStockMarked((prev) => {
      const n = { ...prev };
      delete n[skuId];
      return n;
    });
  };

  const handleToggleSkuWatch = async (skuId: string, spuId?: string, skuPrice?: string | number) => {
    if (savingWatchRef.current[skuId]) return;

    const currentWatch = skuStatuses[skuId]?.watchPrice ?? null;
    const watching = currentWatch != null && currentWatch > 0;
    const nextPrice = watching
      ? null
      : parsePositiveWon(biddingPrices[skuId]) ??
        currentExposureAmount(skuRecommendations[skuId], skuPrice);

    if (!watching && nextPrice == null) {
      showFeedback("노출가가 있어야 알림을 걸 수 있습니다");
      return;
    }

    const seq = (watchSaveSeqRef.current[skuId] ?? 0) + 1;
    watchSaveSeqRef.current[skuId] = seq;

    let snapshot: SkuStatus | undefined;
    const now = new Date().toISOString();

    setSkuStatuses((prev) => {
      snapshot = prev[skuId] ? { ...prev[skuId] } : undefined;
      return {
        ...prev,
        [skuId]: {
          ...defaultSkuStatus(prev[skuId]),
          watchPrice: nextPrice,
          watchAt: nextPrice != null ? now : null,
          updatedAt: now,
        },
      };
    });

    savingWatchRef.current = { ...savingWatchRef.current, [skuId]: true };
    setSavingWatch((prev) => ({ ...prev, [skuId]: true }));

    const res = await setSkuWatchPrice(skuId, nextPrice, spuId);

    if (watchSaveSeqRef.current[skuId] !== seq) return;

    if (!res.success) {
      setSkuStatuses((prev) => ({
        ...prev,
        [skuId]: snapshot ?? defaultSkuStatus(),
      }));
      showFeedback(`가격 알림 저장 실패: ${res.error ?? "sku_status.watch_price 컬럼을 확인하세요."}`);
    } else {
      showFeedback(
        nextPrice != null
          ? `가격 알림 ₩${nextPrice.toLocaleString()} 이하로 걸었습니다.`
          : "가격 알림을 해제했습니다."
      );
    }

    const { [skuId]: _, ...restWatch } = savingWatchRef.current;
    savingWatchRef.current = restWatch;
    setSavingWatch((prev) => {
      const n = { ...prev };
      delete n[skuId];
      return n;
    });
  };

  const removeItem = (indexToRemove: number) => {
    setItems(items.filter((_, idx) => idx !== indexToRemove));
  };

  const handleExcludeSubmit = async () => {
    if (!itemToExclude) return;
    setIsExcluding(true);
    try {
      const res = await addExcludedArticle(itemToExclude.articleNumber, itemToExclude.title, excludeReason);
      if (res.success) {
        setExcludedArticles(prev => [...prev, itemToExclude.articleNumber]);
        removeItem(itemToExclude.idx);
        setIsExcludeModalOpen(false);
      } else {
        showFeedback(`제외 처리 실패: ${res.error}`);
      }
    } catch (e: any) {
      showFeedback(`오류: ${e.message}`);
    } finally {
      setIsExcluding(false);
    }
  };


  const tableCtx: SearchBoardTableContextValue = {
    columnWidths,
    resizing,
    sortConfig,
    workspaceView,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAllVisible,
    handleResizeStart,
    resetColumnWidth,
    toggleSort,
    selectedSkus,
    skuStatuses,
    itemStatuses,
    skippedSkuIds,
    skuRecommendations,
    loadingRecommendations,
    biddingPrices,
    sourceOffers,
    loadingSourceOffers,
    systemSettings,
    isBidding,
    expandedRows,
    skuMemoEditor,
    memoEditor,
    savingManualBid,
    savingStockMarked,
    savingWatch,
    savingSkuMemo,
    getSkuBidViews,
    getSpuBidSummary,
    getSpuReviewSummary,
    resolveSkuActivity,
    toggleSkuSelection,
    handleToggleSkuManualBid,
    handleToggleSkuStockMarked,
    handleToggleSkuWatch,
    toggleSkuHandled,
    handleToggleSkip,
    handleSaveSkuMemo,
    handleBiddingPriceChange,
    handleSingleBid,
    openSourceOfferModal,
    setSkuMemoEditor,
    setMemoEditor,
    handleSaveMemo,
    toggleItemHandled,
    setManySelected,
    toggleRow,
    removeItem,
    openExclude: (target) => {
      setItemToExclude(target);
      setExcludeReason("");
      setIsExcludeModalOpen(true);
    },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Unified workspace card */}
      <div className="flex-1 min-h-0 glass-panel border border-border/60 rounded-xl flex flex-col overflow-hidden">
        <SearchBoardToolbar
          variant={variant}
          searchType={searchType}
          onSearchTypeChange={setSearchType}
          keyword={keyword}
          onKeywordChange={setKeyword}
          isInputFocused={isInputFocused}
          onInputFocusChange={setIsInputFocused}
          searchHistory={searchHistory}
          onSearchHistoryChange={setSearchHistory}
          isLoading={isLoading}
          isEnqueuing={isEnqueuing}
          onSearch={() => { void handleSearch(1); }}
          onHistorySearch={(entry) => {
            setSearchType(entry.type);
            setKeyword(entry.keyword);
            setIsInputFocused(false);
            void handleSearch(1, false, { keyword: entry.keyword, type: entry.type });
          }}
          onBackgroundSearch={() => { void handleBackgroundSearch(); }}
          onStopSearch={stopSearch}
          canStopSearch={isSearchInFlight || isLoadingMore}
          jobKeyword={lastBrandKeyword}
          error={error}
          workspaceView={workspaceView}
          onWorkspaceViewChange={setWorkspaceView}
          displayFilter={displayFilter}
          onDisplayFilterChange={setDisplayFilter}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          resultCount={isFlatView ? filteredFlattenedRows.length : filteredItems.length}
          highProfitCount={highProfitCount}
          onHighProfitFocus={focusHighProfit}
          watchHitCount={watchHitCount}
          watchFocus={watchFocus}
          onWatchFocus={focusWatchHits}
          hasVisibleRows={(isFlatView ? filteredFlattenedRows : filteredItems).length > 0}
          selectedSkuCount={Object.values(selectedSkus).filter(Boolean).length}
          isBidding={isBidding}
          onBatchBid={() => { void handleBatchBid(); }}
          onRefreshSelectedPrices={() => { void handleRefreshSelectedPrices(); }}
          isRefreshingPrices={isRefreshingPrices}
          onMergeActedItems={() => { void handleMergeActedItems(); }}
          overflowOpen={overflowOpen}
          onOverflowOpenChange={setOverflowOpen}
          excludeSkippedOnSearch={excludeSkippedOnSearch}
          onExcludeSkippedChange={setExcludeSkippedOnSearchPref}
          excludeReviewedOnSearch={excludeReviewedOnSearch}
          onExcludeReviewedChange={setExcludeReviewedOnSearchPref}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onOpenMarginSettings={() => setIsSettingsOpen(true)}
          onResetColumnWidths={resetAllWidths}
          canClearList={items.length > 0}
          onClearList={() => {
            if (!window.confirm("현재 검색 결과를 모두 비울까요?")) return;
            clearSearchResults();
            setSelectedSkus({});
            setExpandedRows({});
            setWatchFocus(false);
            showFeedback("워크스페이스 목록을 비웠습니다.");
            setOverflowOpen(false);
          }}
        />
        {variant === "live" && brandHint && brandHint.page > 0 && (
          <div className="shrink-0 px-4 py-1.5 border-b border-border/40 bg-background/40 backdrop-blur-md flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock size={12} className="text-primary/70" />
            이전에 <span className="font-bold text-foreground">{brandHint.page}페이지</span>까지 탐색했습니다
            {brandHint.total > 0 && <span className="opacity-60">(전체 {brandHint.total.toLocaleString()}개)</span>}
            <span className="opacity-50">— 대량은 백그라운드로 이어서 모으세요.</span>
          </div>
        )}

        <SearchBoardTableProvider value={tableCtx}>
          <SearchBoardResultsTable
            isFlatView={isFlatView}
            itemsCount={items.length}
            filteredEmpty={
              (!isFlatView && filteredItems.length === 0) ||
              (isFlatView && filteredFlattenedRows.length === 0)
            }
            sortedFlattenedRows={sortedFlattenedRows}
            sortedItems={sortedItems}
          />
        </SearchBoardTableProvider>

        {/* 브랜드 '더 불러오기' (누적 탐색) */}
        {searchType === "brand" && totalCount > 0 && items.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-background/45 backdrop-blur-md flex items-center justify-between gap-4 text-xs">
            <div className="text-muted-foreground">
              총 <span className="font-bold text-foreground">{totalCount.toLocaleString()}</span>개 중{" "}
              <span className="font-bold text-primary">{items.length.toLocaleString()}</span>개 불러옴
              <span className="opacity-60"> ({brandLastApiPage}페이지까지)</span>
            </div>
            {brandLastApiPage > 0 && brandLastApiPage * pageSize < totalCount && !loadedJobId ? (
              <button
                onClick={handleLoadMore}
                disabled={isLoading || isLoadingMore}
                className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40`}
              >
                {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                더 불러오기 (다음 {pageSize}개)
              </button>
            ) : loadedJobId ? (
              <span className="text-muted-foreground/70 font-medium">
                더 모으려면 백그라운드를 다시 거세요
              </span>
            ) : (
              <span className="text-muted-foreground/70 font-medium">전체 불러옴 완료</span>
            )}
          </div>
        )}
      </div>

      {/* Naver Search Results Dialog */}
      <SourceOfferResultsDialog
        isOpen={isSourceOfferModalOpen}
        onClose={() => setIsSourceOfferModalOpen(false)}
        items={selectedSourceOffers}
        articleNumber={sourceOfferModalArticleNumber}
      />

      {/* Margin Settings Dialog */}
      <MarginSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialData={systemSettings}
        onSuccess={(newData) => setSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...newData })}
      />

      {/* Duplicate Bid Confirmation Modal */}
      {duplicateBidModal && (
        <div className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b bg-muted/30">
              <div className="flex items-center gap-3 text-amber-500 mb-1">
                <AlertCircle size={20} />
                <h3 className="font-bold text-lg text-foreground">중복 입찰 확인</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                아래 옵션은 이미 입찰 중입니다. 계속 진행하시겠습니까?
              </p>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {duplicateBidModal.conflicts.map((conflict, i) => {
                const samePrice = conflict.existing.bidPrice === conflict.payload.price;
                return (
                  <div key={i} className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {conflict.sizeInfo || conflict.existing.sizeInfo || `SKU ${conflict.payload.skuId}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        SKUID: {conflict.payload.skuId}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-background rounded-md p-2 border border-secondary/20">
                        <p className="text-muted-foreground font-semibold mb-0.5">기존 입찰</p>
                        <p className="font-bold">₩{conflict.existing.bidPrice.toLocaleString()}</p>
                        <p className="text-muted-foreground">{conflict.existing.bidDate}</p>
                        {conflict.existing.quantity != null && (
                          <p className="text-muted-foreground">수량: {conflict.existing.quantity}</p>
                        )}
                      </div>
                      <div className="bg-background rounded-md p-2 border border-primary/20">
                        <p className="text-muted-foreground font-semibold mb-0.5">요청 입찰</p>
                        <p className="font-bold text-primary">₩{conflict.payload.price.toLocaleString()}</p>
                        {samePrice && (
                          <p className="text-amber-600 text-[10px] font-semibold mt-1">동일 가격</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {duplicateBidModal.conflicts.every(
                (c) => c.existing.bidPrice === c.payload.price
              ) && (
                <p className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5">
                  동일 옵션·동일 가격은 실데이터에서 중복 입찰이 거부됩니다. 입찰 관리에서 수량을 변경하거나 가격을 수정해 주세요.
                </p>
              )}
            </div>
            <div className="p-4 border-t flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setDuplicateBidModal(null)}
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
              >
                취소
              </button>
              <button
                onClick={() => handleDuplicateConfirm("forceRetry")}
                disabled={isBidding}
                className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-bold hover:bg-secondary/80 disabled:opacity-40"
              >
                그대로 입찰 시도
              </button>
              <button
                onClick={() => handleDuplicateConfirm("updatePrice")}
                disabled={
                  isBidding ||
                  duplicateBidModal.conflicts.every(
                    (c) => c.existing.bidPrice === c.payload.price
                  )
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-40"
              >
                가격 변경 재입찰
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclude Article Modal */}
      {isExcludeModalOpen && itemToExclude && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-[420px] rounded-2xl shadow-xl border overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-muted/30">
              <div className="flex items-center gap-3 text-orange-500 mb-1">
                <Ban size={20} />
                <h3 className="font-bold text-lg text-foreground">품번 영구 제외</h3>
              </div>
              <p className="text-sm text-muted-foreground">이 품번은 앞으로 검색 결과에 표시되지 않사옵니다.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-1">제외할 품번</p>
                <div className="text-sm font-bold bg-secondary/20 p-2 rounded-md">{itemToExclude.articleNumber}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1 block">제외 사유</label>
                <textarea 
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="예: 한국 미판매 상품, 마진율 저조 등"
                  className="w-full text-sm p-3 bg-secondary/10 border border-secondary/30 rounded-lg min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setIsExcludeModalOpen(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground">취소</button>
              <button onClick={handleExcludeSubmit} disabled={isExcluding} className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                {isExcluding ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                영구 제외하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비차단 인라인 피드백 토스트 (alert 대체) */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200">
          <div className="flex items-center gap-2 bg-slate-900/88 backdrop-blur-xl text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl border border-white/10 max-w-[90vw]">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate">{feedback}</span>
            <button onClick={() => setFeedback(null)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity shrink-0">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
