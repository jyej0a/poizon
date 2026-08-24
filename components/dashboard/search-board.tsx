"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Search, Loader2, Gavel, ImageIcon, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, Settings2, RotateCcw, X,
  Trash2, Ban, Copy, Check, Clock, ArrowUp, ArrowDown, ChevronsUpDown,
  Plus, StickyNote, Save, EyeOff, Eye, Inbox
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";
import { enqueueSearchJob, getSearchJobDetail } from "@/app/actions/search-jobs";
import { getSourceOffers } from "@/app/actions/source-offers";
import { useSearchJobs } from "@/components/providers/search-jobs-provider";
import { formatSalesVolume, getSkuSalesValue } from "@/lib/utils/sales-volume";
import {
  applyStatsToItemData,
  brandItemKey,
  buildSearchItem,
  buildStatsMaps,
  extractBrandResultsFromResponse,
  getSpuKeyFromItem,
  resolveSkuId,
} from "@/lib/search/search-item";
import { executeBidding, getExistingBidsForSkus, getBidHistoryBySkuIds, type BidPayload, type ExistingBidInfo, type ExecuteBiddingMode } from "@/app/actions/bidding";
import { getSkuRecommendations } from "@/app/actions/recommendations";
import { getSystemSettings } from "@/app/actions/settings";
import { getExcludedArticles, addExcludedArticle } from "@/app/actions/excluded-articles";
import { getSkippedItems, addSkippedItems, removeSkippedItems } from "@/app/actions/skipped-items";
import { getItemStatuses, setItemHandled, setItemMemo, type ItemStatus } from "@/app/actions/item-status";
import { getSkuStatuses, getSkuStatusesBySpuIds, setSkuMemo, setSkuManualBidMarked, setSkuStockMarked, setSkuHandled, setManySkuHandled } from "@/app/actions/sku-status";
import { formatActivityLine, getSkuLastActivity, getSpuLastActivity, type SkuActivity } from "@/lib/utils/sku-activity";
import { getSkuRowVisualState, getSpuRowVisualState } from "@/lib/utils/sku-row-visual";
import { EMPTY_SKU_STATUS, type SkuStatus } from "@/types/sku-status";
import { calculateMargin, type SystemSettings } from "@/lib/utils/calculate-margin";
import { formatBidDate } from "@/lib/utils/poizon-listing";
import { isTransientActionError } from "@/lib/utils";
import type { SourceOffer } from "@/types/source-offer";
import { getBestSourceOffer, getBestSourceOfferPrice } from "@/lib/sourcing/source-offer-view";
import { MarginSettingsDialog } from "./margin-settings-dialog";
import { BidStatusIndicator, SpuBidSummary, type BidDisplaySource, type BidStatusInfo } from "./bid-status-indicator";
import { SkuRowManageCell } from "./sku-row-manage-cell";
import { StockStatusIndicator } from "./stock-status-indicator";
import { ReviewCheckButton, type ReviewCheckState } from "./review-check-button";
import { DashboardViewTabs } from "./dashboard-view-tabs";
import { SourceOfferPriceCell } from "./source-offer-price-cell";
import { SourceOfferResultsDialog } from "./source-offer-results-dialog";

function getChildSkuIds(item: { skuDetails?: any[] } | null | undefined): string[] {
  const ids = (item?.skuDetails || []).map(resolveSkuId).filter(Boolean);
  return [...new Set(ids)];
}

/** 옵션 전체가 스킵된 품번인지 (검색 단계 제외용) */
function isSpuFullySkipped(item: { skuDetails?: any[] }, skippedSkuIds: Set<string>): boolean {
  const childSkuIds = getChildSkuIds(item);
  if (childSkuIds.length === 0) return false;
  return childSkuIds.every((id) => skippedSkuIds.has(id));
}

/** SPU 또는 전 옵션이 검토완료인지 (검색 단계 제외용) */
function isSpuReviewed(
  item: { id?: string | number; skuDetails?: any[] },
  itemStatuses: Record<string, ItemStatus>,
  skuStatuses: Record<string, SkuStatus>
): boolean {
  const spuKey = getSpuKeyFromItem(item);
  if (!spuKey) return false;
  const childSkuIds = getChildSkuIds(item);
  const allSkusReviewed =
    childSkuIds.length > 0 && childSkuIds.every((skuId) => !!skuStatuses[skuId]?.handled);
  return !!(itemStatuses[spuKey]?.handled || allSkusReviewed);
}

function formatExposurePrice(
  rec: any,
  fallbackPrice: string | number | undefined
): string {
  const exposurePr = rec?.leakInfos?.find(
    (l: any) => l.buyerRegion === "CN" || l.region === "CN"
  )?.leakPrice;
  const displayPr = exposurePr ?? rec?.globalMinPrice ?? fallbackPrice;
  if (displayPr == null || displayPr === "" || displayPr === "—") return "—";
  if (typeof displayPr === "number") return `₩${displayPr.toLocaleString()}`;
  const numStr = String(displayPr).replace(/[^0-9]/g, "");
  return numStr ? `₩${Number(numStr).toLocaleString()}` : String(displayPr);
}

function resolveExposurePriceValue(
  rec: any,
  fallbackPrice: string | number | undefined
): string | number {
  const exposurePr = rec?.leakInfos?.find(
    (l: any) => l.buyerRegion === "CN" || l.region === "CN"
  )?.leakPrice;
  return exposurePr ?? rec?.globalMinPrice ?? fallbackPrice ?? "—";
}

const DEFAULT_COLUMN_WIDTHS: { [key: string]: number } = {
  info: 340,
  avg: 100,
  naver: 110,
  exposure: 120,
  profit: 100,
  salesChina: 90,
  salesLocal: 90,
  bid: 200,
  manage: 156,
  skip: 60,
};

const COLUMN_STORAGE_KEY = "poizon_dashboard_widths_v4";
const BRAND_PROGRESS_KEY = "poizon_brand_progress";

interface BrandProgress {
  page: number;
  brandId: number | string | null;
  total: number;
}

function readBrandProgress(): Record<string, BrandProgress> {
  try {
    const raw = localStorage.getItem(BRAND_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBrandProgress(brand: string, progress: BrandProgress) {
  try {
    const all = readBrandProgress();
    all[brand.trim().toLowerCase()] = progress;
    localStorage.setItem(BRAND_PROGRESS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to persist brand progress", e);
  }
}

function getBrandProgress(brand: string): BrandProgress | null {
  const all = readBrandProgress();
  return all[brand.trim().toLowerCase()] ?? null;
}

// --- 최근 검색 기록 (localStorage, 서버 부하 0) ---
const SEARCH_HISTORY_KEY = "poizon_search_history";
const SEARCH_HISTORY_LIMIT = 10;
const SEARCH_EXCLUDE_SKIPPED_KEY = "poizon_search_exclude_skipped";
const SEARCH_EXCLUDE_REVIEWED_KEY = "poizon_search_exclude_reviewed";

function readSearchExcludePref(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
}

function writeSearchExcludePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

interface SearchExclusionOptions {
  excludeSkipped: boolean;
  excludeReviewed: boolean;
}

interface SearchExclusionContext {
  skippedSkuIds: Set<string>;
  itemStatuses: Record<string, ItemStatus>;
  skuStatuses: Record<string, SkuStatus>;
}

async function loadSearchExclusionContext(
  options: SearchExclusionOptions,
  spuIds: string[] = []
): Promise<SearchExclusionContext> {
  if (!options.excludeSkipped && !options.excludeReviewed) {
    return { skippedSkuIds: new Set(), itemStatuses: {}, skuStatuses: {} };
  }

  const [skippedRes, itemStatusRes, skuStatusRes] = await Promise.all([
    options.excludeSkipped ? getSkippedItems() : Promise.resolve({ success: true, data: [] as any[] }),
    options.excludeReviewed && spuIds.length > 0
      ? getItemStatuses(spuIds)
      : Promise.resolve({ success: true, data: {} as Record<string, ItemStatus> }),
    options.excludeReviewed && spuIds.length > 0
      ? getSkuStatusesBySpuIds(spuIds)
      : Promise.resolve({ success: true, data: {} as Record<string, SkuStatus> }),
  ]);

  return {
    skippedSkuIds: new Set<string>(
      (skippedRes.success && skippedRes.data ? skippedRes.data : []).map((row: { sku_id: string }) =>
        String(row.sku_id)
      )
    ),
    itemStatuses:
      itemStatusRes.success && itemStatusRes.data ? itemStatusRes.data : ({} as Record<string, ItemStatus>),
    skuStatuses:
      skuStatusRes.success && skuStatusRes.data ? skuStatusRes.data : ({} as Record<string, SkuStatus>),
  };
}

function filterItemsBySearchExclusion(
  items: any[],
  options: SearchExclusionOptions,
  ctx: SearchExclusionContext
): { items: any[]; excludedCount: number } {
  if (!options.excludeSkipped && !options.excludeReviewed) {
    return { items, excludedCount: 0 };
  }

  let excludedCount = 0;
  const kept = items.filter((item) => {
    if (options.excludeSkipped && isSpuFullySkipped(item, ctx.skippedSkuIds)) {
      excludedCount += 1;
      return false;
    }
    if (options.excludeReviewed && isSpuReviewed(item, ctx.itemStatuses, ctx.skuStatuses)) {
      excludedCount += 1;
      return false;
    }
    return true;
  });

  return { items: kept, excludedCount };
}

function pushSearchItemFromRaw(rawData: any, targetArray: any[], term: string) {
  const item = buildSearchItem(rawData, term);
  if (item) targetArray.push(item);
}

async function applySearchExclusionFilters(
  items: any[],
  options: SearchExclusionOptions
): Promise<{
  items: any[];
  excludedCount: number;
  itemStatuses: Record<string, ItemStatus>;
  skuStatuses: Record<string, SkuStatus>;
  skippedSkuIds: Set<string>;
}> {
  const spuIds = [...new Set(items.map(getSpuKeyFromItem).filter(Boolean))];
  const ctx = await loadSearchExclusionContext(options, spuIds);
  const { items: kept, excludedCount } = filterItemsBySearchExclusion(items, options, ctx);
  return {
    items: kept,
    excludedCount,
    itemStatuses: ctx.itemStatuses,
    skuStatuses: ctx.skuStatuses,
    skippedSkuIds: ctx.skippedSkuIds,
  };
}

interface SearchHistoryEntry {
  keyword: string;
  type: "article" | "brand";
  ts: number;
}

function readSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: any) => e && typeof e.keyword === "string" && (e.type === "article" || e.type === "brand"))
      .sort((a: SearchHistoryEntry, b: SearchHistoryEntry) => b.ts - a.ts);
  } catch {
    return [];
  }
}

function writeSearchHistory(entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error("Failed to persist search history", e);
  }
}

function addSearchHistory(keyword: string, type: "article" | "brand"): SearchHistoryEntry[] {
  const trimmed = keyword.trim();
  if (!trimmed) return readSearchHistory();
  const key = trimmed.toLowerCase();
  // 동일 검색어 + 타입 조합은 중복 제거 후 최상단으로 이동
  const others = readSearchHistory().filter(
    (e) => !(e.keyword.trim().toLowerCase() === key && e.type === type)
  );
  const next = [{ keyword: trimmed, type, ts: Date.now() }, ...others].slice(0, SEARCH_HISTORY_LIMIT);
  writeSearchHistory(next);
  return next;
}

function removeSearchHistory(keyword: string, type: "article" | "brand"): SearchHistoryEntry[] {
  const key = keyword.trim().toLowerCase();
  const next = readSearchHistory().filter(
    (e) => !(e.keyword.trim().toLowerCase() === key && e.type === type)
  );
  writeSearchHistory(next);
  return next;
}

function clearSearchHistory(): SearchHistoryEntry[] {
  writeSearchHistory([]);
  return [];
}

// 정렬 가능한 숫자형 컬럼의 값 추출기
type SortKey = "avg" | "exposure" | "naver" | "profit" | "salesChina" | "salesLocal";

function parseNumber(value: any): number {
  if (value === null || value === undefined) return NaN;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? NaN : num;
}

export function SearchBoard() {
  const searchParams = useSearchParams();
  const { refresh: refreshJobs } = useSearchJobs();

  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<"article" | "brand">("article");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // 입찰가 액션용 State
  const [biddingPrices, setBiddingPrices] = useState<Record<string, string>>({});
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>({});

  // 추천 입찰가 데이터용 State
  const [skuRecommendations, setSkuRecommendations] = useState<Record<string, any>>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState<Record<string, boolean>>({});
  // 진행 중인 세부 옵션(SKU) 추천가 수집을 즉시 취소하기 위한 레지스트리.
  // (서버 액션 자체는 끝까지 실행되더라도, 취소된 SKU의 응답은 무시하고 로딩 표시를 즉시 해제한다.)
  const cancelledRecsRef = React.useRef<Set<string>>(new Set());
  const skuRecommendationsRef = React.useRef<Record<string, any>>({});
  const loadingRecommendationsRef = React.useRef<Record<string, boolean>>({});
  const recFetchQueueRef = React.useRef<string[]>([]);
  const recActiveFetchesRef = React.useRef(0);
  const rowToggleSuppressRef = React.useRef<string | null>(null);
  const REC_FETCH_TIMEOUT_MS = 30_000;
  const REC_FETCH_CONCURRENCY = 2;

  const [pageSize, setPageSize] = useState(50);
  const [lastBrandKeyword, setLastBrandKeyword] = useState("");

  // 페이징 관련 State
  const [brandLastApiPage, setBrandLastApiPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // 외부 원가 오퍼 및 마진용 State
  const [sourceOffers, setSourceOffers] = useState<Record<string, SourceOffer[]>>({});
  const [loadingSourceOffers, setLoadingSourceOffers] = useState<Record<string, boolean>>({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const [selectedSourceOffers, setSelectedSourceOffers] = useState<SourceOffer[] | null>(null);
  const [sourceOfferModalArticleNumber, setSourceOfferModalArticleNumber] = useState<string>("");
  const [isSourceOfferModalOpen, setIsSourceOfferModalOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 품번 제외용 State
  const [excludedArticles, setExcludedArticles] = useState<string[]>([]);
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
  const [showOnlyProfitable, setShowOnlyProfitable] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [excludeSkippedOnSearch, setExcludeSkippedOnSearch] = useState(() =>
    readSearchExcludePref(SEARCH_EXCLUDE_SKIPPED_KEY, true)
  );
  const [excludeReviewedOnSearch, setExcludeReviewedOnSearch] = useState(() =>
    readSearchExcludePref(SEARCH_EXCLUDE_REVIEWED_KEY, true)
  );

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
  const [showOnlyUnprocessed, setShowOnlyUnprocessed] = useState(false);
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

  React.useEffect(() => {
    savingManualBidRef.current = savingManualBid;
  }, [savingManualBid]);

  React.useEffect(() => {
    savingStockMarkedRef.current = savingStockMarked;
  }, [savingStockMarked]);

  const mergeSkuStatusFromServer = React.useCallback(
    (prev: Record<string, SkuStatus>, serverData: Record<string, SkuStatus>) => {
      const merged = { ...prev };
      for (const [id, status] of Object.entries(serverData)) {
        if (savingManualBidRef.current[id] || savingStockMarkedRef.current[id]) continue;
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

  // 브랜드 '더 불러오기' (누적 탐색) 관련 State
  const [cachedBrandId, setCachedBrandId] = useState<number | string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [brandHint, setBrandHint] = useState<BrandProgress | null>(null);

  // 브랜드명 입력 시, 이전 탐색 진행 위치 안내
  useEffect(() => {
    if (searchType !== "brand" || !keyword.trim()) {
      setBrandHint(null);
      return;
    }
    setBrandHint(getBrandProgress(keyword));
  }, [keyword, searchType]);

  useEffect(() => {
    const savedWidths = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (savedWidths) {
      try {
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(savedWidths) });
      } catch (e) {
        console.error("Failed to parse saved widths", e);
      }
    }
    setSearchHistory(readSearchHistory());
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
          setSystemSettings(settingsRes.data as any);
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
    // 알짜배기 목록(Flattened) 모드에서는 아코디언이 필요 없사옵니다.
    if (showOnlyProfitable) return;

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
    setBiddingPrices(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(skuRecommendations).forEach(skuId => {
        if (!next[skuId]) {
          const rec = skuRecommendations[skuId];
          const exposurePr = rec?.leakInfos?.find((l: any) => (l.buyerRegion === "CN" || l.region === "CN"))?.leakPrice ?? rec?.globalMinPrice;
          if (exposurePr) {
            next[skuId] = String(exposurePr);
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [skuRecommendations]);

  React.useEffect(() => {
    skuRecommendationsRef.current = skuRecommendations;
  }, [skuRecommendations]);

  React.useEffect(() => {
    loadingRecommendationsRef.current = loadingRecommendations;
  }, [loadingRecommendations]);

  // 지정한 SKU들의 진행 중 추천가 수집을 즉시 중단(취소)한다.
  const cancelRecommendations = (skuIds: (string | number)[]) => {
    const keys = skuIds.map((id) => String(id)).filter(Boolean);
    if (keys.length === 0) return;
    keys.forEach((key) => cancelledRecsRef.current.add(key));
    recFetchQueueRef.current = recFetchQueueRef.current.filter((id) => !keys.includes(id));
    setLoadingRecommendations((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const fetchRecommendation = async (skuId: string | number) => {
    const key = String(skuId);
    if (!key) return;

    cancelledRecsRef.current.delete(key);
    setLoadingRecommendations((prev) => ({ ...prev, [key]: true }));

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
        setSkuRecommendations((prev) => ({ ...prev, [key]: res.data }));
      }
    } catch (e: any) {
      console.error("Failed to fetch recommendation", e);
    } finally {
      setLoadingRecommendations((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const pumpRecommendationQueue = React.useCallback(() => {
    while (
      recActiveFetchesRef.current < REC_FETCH_CONCURRENCY &&
      recFetchQueueRef.current.length > 0
    ) {
      const key = recFetchQueueRef.current.shift();
      if (!key) continue;
      if (skuRecommendationsRef.current[key] || loadingRecommendationsRef.current[key]) continue;
      if (cancelledRecsRef.current.has(key)) continue;

      recActiveFetchesRef.current += 1;
      void fetchRecommendation(key).finally(() => {
        recActiveFetchesRef.current -= 1;
        pumpRecommendationQueue();
      });
    }
  }, []);

  const queueRecommendationFetch = React.useCallback(
    (skuId: string | number) => {
      const key = String(skuId);
      if (!key) return;
      if (skuRecommendationsRef.current[key] || loadingRecommendationsRef.current[key]) return;
      if (recFetchQueueRef.current.includes(key)) return;

      recFetchQueueRef.current.push(key);
      pumpRecommendationQueue();
    },
    [pumpRecommendationQueue]
  );

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

  const handleBiddingPriceChange = (skuId: string, value: string) => {
    const numStr = value.replace(/[^0-9]/g, "");
    setBiddingPrices(prev => ({ ...prev, [skuId]: numStr }));
  };

  const getMargin = (priceStr?: string, cost?: number) => {
    if (!priceStr || !systemSettings) return null;
    const price = Number(priceStr);
    if (!price || price <= 0) return null;
    const margin = calculateMargin(price, systemSettings);
    
    // 최저 오퍼 원가가 제공되면 실제 정산 이익을 계산합니다.
    const actualProfit = cost ? margin.netProfit - cost : margin.netProfit;
    const actualRate = cost ? (actualProfit / cost) * 100 : margin.marginRate;

    return {
      ...margin,
      actualProfit,
      actualRate: parseFloat(actualRate.toFixed(2))
    };
  };

  const calculateNet = (priceStr?: string, cost?: number) => {
    const margin = getMargin(priceStr, cost);
    return margin ? margin.actualProfit : null;
  };

  // 알짜배기 목록(Flattened View)을 위한 계산 로직
  const flattenedRows = React.useMemo(() => {
    if (!showOnlyProfitable) return [];
    
    const rows: any[] = [];
    items.forEach(item => {
      const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
      const skus = item.skuDetails || [];
      
      skus.forEach(sku => {
        const skuPriceRaw = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "0";
        const skuPriceNum = Number(String(skuPriceRaw).replace(/[^0-9]/g, ""));
        
        let profit = -999999;
        if (naverPrice && skuPriceNum > 0 && systemSettings) {
          const { fee } = calculateMargin(skuPriceNum, systemSettings);
          profit = skuPriceNum - fee - Number(naverPrice);
        }

        // 필터 로직: 
        // 1. 원가 오퍼 로딩 중이면 일단 노출 (아무것도 안 뜨면 안 되기에)
        // 2. 가격이 있는데 수익이 0 이하이면 제외
        if (naverPrice && profit <= 0) return;

        rows.push({
          ...sku,
          parent: item,
          profit,
          naverPrice: naverPrice ? Number(naverPrice) : null,
          skuPrice: skuPriceRaw
        });
      });
    });
    return rows;
  }, [items, sourceOffers, showOnlyProfitable, systemSettings]);

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

  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
      const categoryMatch = selectedCategory === "전체" || item.category === selectedCategory;
      if (!categoryMatch) return false;

      // '미처리 상품만 보기': 검토완료된 품번만 숨김
      if (showOnlyUnprocessed && isItemProcessed(item)) return false;

      if (showOnlyProfitable) {
        // 기존 수익 상품 필터 로직
        const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
        const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
        if (naverPrice && !isNaN(poizonPriceNum) && poizonPriceNum > 0 && systemSettings) {
          const { fee } = calculateMargin(poizonPriceNum, systemSettings);
          const profit = poizonPriceNum - fee - Number(naverPrice);
          return profit > 0;
        }
        return false;
      }
      return true;
    });
  }, [items, selectedCategory, showOnlyProfitable, showOnlyUnprocessed, isItemProcessed, sourceOffers, systemSettings]);

  const filteredFlattenedRows = React.useMemo(() => {
    return flattenedRows.filter(row => {
      const categoryMatch = selectedCategory === "전체" || row.parent.category === selectedCategory;
      if (!categoryMatch) return false;
      if (showOnlyUnprocessed && isItemProcessed(row.parent)) return false;
      return true;
    });
  }, [flattenedRows, selectedCategory, showOnlyUnprocessed, isItemProcessed]);

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
  }, [filteredFlattenedRows, sortConfig, sourceOffers, systemSettings]);

  React.useEffect(() => {
    const idsToFetch: string[] = [];
    if (showOnlyProfitable) {
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
  }, [showOnlyProfitable, sortedFlattenedRows, items, expandedRows, queueRecommendationFetch]);

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
    if (showOnlyProfitable) {
      return sortedFlattenedRows.map((row) => String(row.skuId)).filter(Boolean);
    }
    return sortedItems.flatMap((item) => getChildSkuIds(item));
  }, [showOnlyProfitable, sortedFlattenedRows, sortedItems]);

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
    const enriched = payloads.map((p) => ({
      ...p,
      sellerBiddingNo: p.sellerBiddingNo,
      sizeInfo: p.sizeInfo || resolveSkuSizeInfo(p.skuId),
    }));
    const res = await executeBidding(enriched, { mode });
    if (res.success) {
      showFeedback(formatBidFeedback(res.data || [], res.error));
      applyBidSuccessToState(payloads);
    } else {
      showFeedback(formatBidFeedback(res.data || [], res.data?.[0]?.message || res.error));
      if (res.data?.some((r) => r.success)) applyBidSuccessToState(payloads.filter((p) => res.data?.find((r) => String(r.skuId) === String(p.skuId) && r.success)));
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
    if (showOnlyProfitable) {
      const row = flattenedRows.find((r: any) => String(r.skuId) === String(skuId));
      if (row) {
        const propsRaw = row.regionSalePvInfoList || row.properties || [];
        return propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ") || undefined;
      }
    }
    return undefined;
  };

  const splitPayloadsByExistingBids = async (payloads: BidPayload[]) => {
    const existingRes = await getExistingBidsForSkus(payloads.map((p) => p.skuId));
    const conflicts: DuplicateBidConflict[] = [];
    const nonConflicts: BidPayload[] = [];

    for (const payload of payloads) {
      const existing = existingRes.data?.[String(payload.skuId)];
      if (existing) {
        conflicts.push({
          payload,
          existing,
          sizeInfo: resolveSkuSizeInfo(payload.skuId) || existing.sizeInfo,
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
    if (!priceStr) return;
    const price = Number(priceStr);
    
    setIsBidding(true);
    try {
      const payload: BidPayload = { skuId, spuId, price };
      const { conflicts, nonConflicts } = await splitPayloadsByExistingBids([payload]);

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
      const { conflicts, nonConflicts } = await splitPayloadsByExistingBids(payloads);

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

  /**
   * 검색을 백그라운드 잡으로 등록한다. 화면을 닫아도 서버에서 계속 진행되고,
   * 완료 후 '검색 작업'에서 결과를 한 번에 불러온다.
   */
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
          pageSize,
          excludeSkipped: excludeSkippedOnSearch,
          excludeReviewed: excludeReviewedOnSearch,
          ...(searchType === "brand" ? { brandPage: 1 } : {}),
        },
      });

      if (!res.success) {
        setError(res.error ?? "백그라운드 검색 등록에 실패했습니다.");
        return;
      }

      setSearchHistory(addSearchHistory(searchKeyword, searchType));
      setKeyword("");
      showFeedback("백그라운드 검색을 등록했습니다. '검색 작업'에서 진행 상황을 볼 수 있습니다.");
      void refreshJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsEnqueuing(false);
    }
  };

  // `/dashboard?job=<id>`로 진입하면 완료된 잡의 결과를 작업 공간에 그대로 올린다.
  const jobIdParam = searchParams.get("job");
  useEffect(() => {
    if (!jobIdParam || loadedJobId === jobIdParam) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getSearchJobDetail(jobIdParam);
        if (cancelled) return;

        if (!res.success || !res.job || !res.items) {
          setError(res.error ?? "검색 작업 결과를 불러오지 못했습니다.");
          return;
        }

        setItems(res.items.map((row) => row.payload));

        // 외부 원가 오퍼는 잡 실행 시점에 이미 수집됐으므로 재조회하지 않는다
        setSourceOffers((prev) => {
          const next = { ...prev };
          res.items!.forEach((row) => {
            const rowOffers = row.payload?.sourceOffers;
            if (row.articleNumber && rowOffers && rowOffers.length > 0) {
              next[row.articleNumber] = rowOffers;
            }
          });
          return next;
        });

        // 브랜드 잡은 '더 보기'가 이어지도록 진행 위치를 복원한다
        if (res.job.type === "brand") {
          setLastBrandKeyword(res.job.keyword);
          setBrandLastApiPage(res.job.options.brandPage ?? 1);
          if (res.job.options.brandId != null) setCachedBrandId(res.job.options.brandId);
        }

        setLoadedJobId(jobIdParam);
        showFeedback(`검색 작업 결과 ${res.items.length}건을 불러왔습니다.`);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobIdParam, loadedJobId]);

  const handleSearch = async (page: number = 1, isBrandLoadMore = false) => {
    const searchKeyword = (page === 1 && !isBrandLoadMore) ? keyword.trim() : lastBrandKeyword;
    if (!searchKeyword) return;

    if (page === 1 && !isBrandLoadMore) {
      setSearchHistory(addSearchHistory(searchKeyword, searchType));
    }

    setIsLoading(true);
    setError(null);

    try {
      const newItems: any[] = [];
      
      if (searchType === "article") {
        const searchTerms = searchKeyword.split(",").map(k => k.trim()).filter(k => k.length > 0);
        
        // 1. 모든 품번을 병렬로 동시 검색 (속도 개선 1)
        const searchPromises = searchTerms.map(term => searchPoizonItems(term));
        const searchResults = await Promise.all(searchPromises);
        
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

        // 2. 통계 정보 일괄 요청 (KR + CN: 중국 시장 판매량은 CN 우선, 실패 시 KR 폴백)
        if (spuIdsForStats.length > 0) {
          const [statsResKR, statsResCN] = await Promise.all([
            getSpuStatistics(spuIdsForStats, ["KR"]),
            getSpuStatistics(spuIdsForStats, ["CN"]),
          ]);

          const { statsMapKR, statsMapCN } = buildStatsMaps(statsResKR, statsResCN);

          validItemDataList.forEach((itemEntry) => {
            applyStatsToItemData(itemEntry.data, statsMapKR, statsMapCN);
          });
        }

        // 3. 파싱 (원가 오퍼·스킵/검토 제외는 필터 이후 처리)
        validItemDataList.forEach(itemEntry => {
          pushSearchItemFromRaw(itemEntry.data, newItems, itemEntry.term);
        });
        
        const curExcludedRes = await getExcludedArticles();
        const curExcluded = curExcludedRes.success && curExcludedRes.data ? curExcludedRes.data.map((r: any) => r.article_number) : [];
        setExcludedArticles(curExcluded);
        const filteredItems = newItems.filter(item => !curExcluded.includes(item.articleNumber));

        // 이번 검색 결과 자체의 중복(콤마 입력 중복 등) 제거
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
        mergeSearchExclusionContext(exclusion);

        if (exclusion.excludedCount > 0) {
          const labels = [
            excludeSkippedOnSearch ? "스킵" : null,
            excludeReviewedOnSearch ? "검토완료" : null,
          ].filter(Boolean);
          showFeedback(`${exclusion.excludedCount}건 검색에서 제외 (${labels.join(", ")})`);
        }

        if (exclusion.items.length > 0) {
          triggerSourceOffersForSearchItems(exclusion.items);
          // 워크스페이스 누적은 유지하되, 동일 품번/SPU는 최신 결과로 갱신(중복 방지)
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
          triggerSourceOffersForSearchItems(itemsToAdd);
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
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 브랜드 '더 불러오기' (다음 페이지 누적)
  const handleLoadMore = async () => {
    if (isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      await handleSearch(1, true);
    } finally {
      setIsLoadingMore(false);
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

  const fetchSourceOffersForArticle = async (articleNumber: string) => {
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
  };

  const triggerSourceOffersForSearchItems = (searchItems: any[]) => {
    searchItems.forEach((item) => {
      const articleNum = item.articleNumber;
      if (
        articleNum &&
        articleNum !== "N/A" &&
        !sourceOffers[articleNum] &&
        !loadingSourceOffers[articleNum]
      ) {
        void fetchSourceOffersForArticle(articleNum);
      }
    });
  };

  const openSourceOfferModal = (articleNumber: string) => {
    const items = sourceOffers[articleNumber];
    if (!items?.length) return;
    setSelectedSourceOffers(items);
    setSourceOfferModalArticleNumber(articleNumber);
    setIsSourceOfferModalOpen(true);
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

  const toolbarBtn =
    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors";
  const toolbarBtnOutline = `${toolbarBtn} border border-border bg-background hover:bg-secondary/60 text-foreground`;
  const toolbarBtnGhost = `${toolbarBtn} border border-transparent hover:bg-secondary/60 text-muted-foreground`;

  // 컬럼 너비 리사이즈 핸들 (적중 영역 확대 + 더블클릭 초기화)
  const ResizeHandle = ({ column }: { column: string }) => (
    <div
      onMouseDown={(e) => handleResizeStart(e, column)}
      onDoubleClick={(e) => { e.stopPropagation(); resetColumnWidth(column); }}
      onClick={(e) => e.stopPropagation()}
      title="드래그하여 너비 조절 · 더블클릭 시 기본값 복원"
      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 flex justify-center group/resize"
    >
      <div className="w-px h-full bg-transparent group-hover/resize:bg-primary/60 transition-colors" />
    </div>
  );

  // 정렬 가능한 숫자형 헤더 (클릭 시 정렬 토글, 표시기 포함)
  const SortIcon = ({ column }: { column: SortKey }) => {
    const active = sortConfig?.key === column;
    if (!active) return <ChevronsUpDown size={11} className="opacity-30 shrink-0" />;
    return sortConfig?.dir === "asc"
      ? <ArrowUp size={11} className="text-primary shrink-0" />
      : <ArrowDown size={11} className="text-primary shrink-0" />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Unified workspace card */}
      <div className="flex-1 min-h-0 bg-card border border-border/60 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Unified workspace toolbar with inline search */}
        <div className={`shrink-0 px-4 py-3 border-b border-border/40 transition-colors ${isInputFocused ? "bg-primary/[0.02]" : "bg-muted/30"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
              Search
            </span>
            <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex bg-secondary/40 p-0.5 rounded-lg shrink-0 h-8">
              <button onClick={() => setSearchType("article")} className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${searchType === "article" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>품번</button>
              <button onClick={() => setSearchType("brand")} className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${searchType === "brand" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>브랜드</button>
            </div>
            <div className={`relative h-8 transition-all duration-300 ease-out ${isInputFocused ? "w-72 md:w-96" : "w-48 md:w-56"}`}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(1)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder={searchType === "article" ? "품번 (콤마 구분) 입력 후 조회" : "브랜드명 입력 후 조회"}
                className="w-full h-8 pl-8 pr-3 bg-background border border-border/60 rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-shadow"
              />
              {isInputFocused && searchHistory.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/60 rounded-lg shadow-lg overflow-hidden"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/30">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <Clock size={11} /> 최근 검색
                    </span>
                    <button
                      onClick={() => setSearchHistory(clearSearchHistory())}
                      className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                    >
                      전체 삭제
                    </button>
                  </div>
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {searchHistory.map((entry) => (
                      <li key={`${entry.type}:${entry.keyword}`}>
                        <div className="group flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors">
                          <button
                            onClick={() => {
                              setSearchType(entry.type);
                              setKeyword(entry.keyword);
                              setIsInputFocused(false);
                              handleSearch(1);
                            }}
                            className="flex-1 flex items-center gap-2 min-w-0 text-left"
                          >
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                entry.type === "article"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {entry.type === "article" ? "품번" : "브랜드"}
                            </span>
                            <span className="flex-1 truncate text-xs text-foreground">{entry.keyword}</span>
                          </button>
                          <button
                            onClick={() => setSearchHistory(removeSearchHistory(entry.keyword, entry.type))}
                            className="shrink-0 p-0.5 rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="이 기록 삭제"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0 pl-0.5">
              <label
                className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                title="모든 옵션이 스킵된 품번은 검색 결과에 포함하지 않습니다"
              >
                <Checkbox
                  checked={excludeSkippedOnSearch}
                  onCheckedChange={(checked) => setExcludeSkippedOnSearchPref(checked === true)}
                  className="h-3.5 w-3.5"
                />
                스킵 제외
              </label>
              <label
                className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                title="검토완료된 품번은 검색 결과에 포함하지 않습니다"
              >
                <Checkbox
                  checked={excludeReviewedOnSearch}
                  onCheckedChange={(checked) => setExcludeReviewedOnSearchPref(checked === true)}
                  className="h-3.5 w-3.5"
                />
                검토완료 제외
              </label>
            </div>
            <button
              onClick={() => handleSearch(1)}
              disabled={isLoading || !keyword.trim()}
              className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0`}
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              조회
            </button>
            <button
              onClick={handleBackgroundSearch}
              disabled={isEnqueuing || !keyword.trim()}
              title="서버에서 검색을 진행합니다. 창을 닫아도 계속되며 '검색 작업'에서 결과를 확인합니다."
              className={`${toolbarBtn} border border-border/60 bg-background hover:bg-secondary/60 disabled:opacity-40 shrink-0`}
            >
              {isEnqueuing ? <Loader2 size={13} className="animate-spin" /> : <Inbox size={13} />}
              백그라운드
            </button>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
              {showOnlyProfitable ? flattenedRows.length : items.length} 건
            </span>
            {error && (
              <div className="hidden lg:flex items-center gap-1.5 text-destructive font-medium text-xs truncate">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}
          </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                View
              </span>
              <DashboardViewTabs
                showOnlyProfitable={showOnlyProfitable}
                showOnlyUnprocessed={showOnlyUnprocessed}
                onChange={({ profitable, unprocessed }) => {
                  setShowOnlyProfitable(profitable);
                  setShowOnlyUnprocessed(unprocessed);
                }}
              />
            </div>
          {/* Right: view config + filters + actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border/50">
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">조회수</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value={50}>50개</option>
                  <option value={100}>100개</option>
                  <option value={200}>200개</option>
                </select>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">분류</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${toolbarBtnOutline} h-8 min-w-[72px] cursor-pointer`}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                if (!window.confirm("현재 검색 결과를 모두 비울까요?")) return;
                setItems([]);
                setSelectedSkus({});
                setExpandedRows({});
                setError(null);
                setTotalCount(0);
                setBrandLastApiPage(0);
                showFeedback("워크스페이스 목록을 비웠습니다.");
              }}
              disabled={items.length === 0}
              title="검색 결과 목록을 모두 비웁니다"
              className={`${toolbarBtnOutline} text-muted-foreground hover:text-destructive disabled:opacity-30`}
            >
              <Trash2 size={13} /> 목록 비우기
            </button>
            <button onClick={resetAllWidths} title="열 너비를 기본값으로 초기화" className={`${toolbarBtnOutline} text-muted-foreground hover:text-foreground`}>
              <RotateCcw size={13} /> 너비 초기화
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className={toolbarBtnGhost}>
              <Settings2 size={13} /> 마진
            </button>
            <button
              onClick={handleBatchBid}
              disabled={(showOnlyProfitable ? filteredFlattenedRows : filteredItems).length === 0 || Object.values(selectedSkus).filter(Boolean).length === 0 || isBidding}
              className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30`}
            >
              <Gavel size={13} /> 일괄 입찰
            </button>
          </div>
          </div>
        </div>
        {/* Brand exploration hint */}
        {brandHint && brandHint.page > 0 && (
          <div className="shrink-0 px-4 py-1.5 border-b border-border/40 bg-secondary/[0.03] flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock size={12} className="text-primary/70" />
            이전에 <span className="font-bold text-foreground">{brandHint.page}페이지</span>까지 탐색했습니다
            {brandHint.total > 0 && <span className="opacity-60">(전체 {brandHint.total.toLocaleString()}개)</span>}
            <span className="opacity-50">— 조회 후 &lsquo;더 불러오기&rsquo;로 이어서 탐색하세요.</span>
          </div>
        )}

        <div className="overflow-x-auto flex-1 custom-scrollbar w-full">
          <table className={`w-full text-[13px] text-left whitespace-nowrap table-fixed border-collapse ${resizing ? 'cursor-col-resize select-none' : ''}`}>
            <thead className="text-[11px] text-muted-foreground bg-muted/20 sticky top-0 z-20 border-b border-border/40 uppercase font-semibold tracking-wide">
              <tr className="h-10 align-middle">
                <th style={{ width: `${columnWidths.manage}px` }} className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-muted/30">
                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      aria-label="현재 목록의 모든 옵션 선택"
                      size="sm"
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAllVisible}
                    />
                    <span>관리</span>
                  </div>
                  <ResizeHandle column="manage" />
                </th>

                <th style={{ width: `${columnWidths.info}px` }} className="relative group/header px-2 align-middle border-r border-secondary/10">
                  <span>{showOnlyProfitable ? "알짜 수익 상품 (SKU)" : "중국 시장 정보"}</span>
                  <ResizeHandle column="info" />
                </th>
                
                <th
                  style={{ width: `${columnWidths.avg}px` }}
                  onClick={() => toggleSort("avg")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-primary/[0.02] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">30일 거래가 <SortIcon column="avg" /></span>
                    <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">(전 세계 평균)</span>
                  </div>
                  <ResizeHandle column="avg" />
                </th>
                
                <th
                  style={{ width: `${columnWidths.exposure}px` }}
                  onClick={() => toggleSort("exposure")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-orange-500/[0.02] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">중국 노출가 <SortIcon column="exposure" /></span>
                    <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">판매자 센터 기준</span>
                  </div>
                  <ResizeHandle column="exposure" />
                </th>

                <th
                  style={{ width: `${columnWidths.naver}px` }}
                  onClick={() => toggleSort("naver")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-emerald-500/[0.03] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">최저 오퍼/원가 <SortIcon column="naver" /></span>
                  </div>
                  <ResizeHandle column="naver" />
                </th>

                <th
                  style={{ width: `${columnWidths.profit}px` }}
                  onClick={() => toggleSort("profit")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-blue-500/[0.04] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">순수익 <SortIcon column="profit" /></span>
                    <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">(노출가-수수료-원가)</span>
                  </div>
                  <ResizeHandle column="profit" />
                </th>
                
                <th
                  style={{ width: `${columnWidths.salesChina}px` }}
                  onClick={() => toggleSort("salesChina")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-primary/[0.02] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">30일 판매량 <SortIcon column="salesChina" /></span>
                    <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">(중국)</span>
                  </div>
                  <ResizeHandle column="salesChina" />
                </th>

                <th
                  style={{ width: `${columnWidths.salesLocal}px` }}
                  onClick={() => toggleSort("salesLocal")}
                  className="relative group/header px-1 text-center align-middle border-r border-secondary/10 bg-primary/[0.04] cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <div className="flex flex-col items-center justify-center leading-[1.15]">
                    <span className="flex items-center gap-1">30일 판매량 <SortIcon column="salesLocal" /></span>
                    <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">(현지 판매자)</span>
                  </div>
                  <ResizeHandle column="salesLocal" />
                </th>

                <th style={{ width: `${columnWidths.bid}px` }} className="relative group/header px-1 text-center align-middle">
                  <span>나의 입찰 제안</span>
                  <ResizeHandle column="bid" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {(!showOnlyProfitable && filteredItems.length === 0) || (showOnlyProfitable && filteredFlattenedRows.length === 0) ? (
                <tr><td colSpan={9} className="py-16 text-center text-muted-foreground/70 text-sm">
                  {items.length === 0 ? "검색을 시작해 주세요." : "해당 분류나 수익 조건에 맞는 상품이 목록에 없습니다."}
                </td></tr>
              ) : showOnlyProfitable ? (
                // --- 마마를 위한 알짜배기 목록 (Flattened Mode) ---
                sortedFlattenedRows.map((row, idx) => {
                  const item = row.parent;
                  const sku = row;
                  const rec = skuRecommendations[sku.skuId];
                  const isLoadingRec = loadingRecommendations[sku.skuId];
                  const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                  const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                  const bidPrice = biddingPrices[sku.skuId];
                  const naverPrice = row.naverPrice;
                  const naverItem = getBestSourceOffer(sourceOffers, item.articleNumber);
                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isSkipped = skippedSkuIds.has(resolveSkuId(sku));
                  const skuKey = resolveSkuId(sku);
                  const skuStatus = skuStatuses[skuKey];
                  const { systemBid, manualBid } = getSkuBidViews(skuKey, skuStatus);
                  const spuIdKey = String(item.id).replace(/[^0-9]/g, "");
                  const childSkuIds = getChildSkuIds(item);
                  const isSkuHandled = skuStatus?.handled ?? false;
                  const rowVisual = getSkuRowVisualState({
                    hasSystemBid: !!systemBid,
                    hasManualBid: !!manualBid,
                    hasStockMarked: !!skuStatus?.stockMarked,
                    isSkipped,
                    isReviewed: isSkuHandled,
                  });
                  const skuActivity = resolveSkuActivity(skuKey, skuStatus);
                  const activityLine = formatActivityLine(skuActivity);

                  return (
                    <tr key={`${sku.skuId}-${idx}`} className={`hover:bg-secondary/[0.02] transition-colors group h-16 ${rowVisual.rowClass} ${rowVisual.fade ? "opacity-40 grayscale-[0.5]" : ""}`}>
                      {/* 관리 (선택 + 입찰 + 재고 + 검토 + 메모 + 스킵) */}
                      <td className={`px-1 text-center border-r border-secondary/10 relative ${rowVisual.manageCellClass}`}>
                        <SkuRowManageCell
                          skuId={sku.skuId}
                          checked={!!selectedSkus[sku.skuId]}
                          onCheckedChange={() => toggleSkuSelection(sku.skuId)}
                          systemBid={systemBid}
                          manualBid={manualBid}
                          onManualBidToggle={() => handleToggleSkuManualBid(skuKey, spuIdKey)}
                          isSavingManualBid={!!savingManualBid[skuKey]}
                          stockMarked={!!skuStatus?.stockMarked}
                          stockMarkedDate={skuStatus?.stockMarkedDate}
                          onStockToggle={() => handleToggleSkuStockMarked(skuKey, spuIdKey)}
                          isSavingStock={!!savingStockMarked[skuKey]}
                          isHandled={isSkuHandled}
                          onHandledToggle={() => toggleSkuHandled(skuKey, spuIdKey, childSkuIds, item)}
                          hasMemo={!!skuStatus?.memo}
                          memoTitle={skuStatus?.memo ?? undefined}
                          activityTitle={activityLine ?? undefined}
                          onMemoClick={() =>
                            setSkuMemoEditor(
                              skuMemoEditor?.skuId === skuKey
                                ? null
                                : { skuId: skuKey, spuId: spuIdKey, value: skuStatus?.memo ?? "" }
                            )
                          }
                          isSkipped={isSkipped}
                          onSkipToggle={() => handleToggleSkip(row, true)}
                        />
                        {skuMemoEditor?.skuId === skuKey && (
                          <div className="absolute left-2 top-full mt-1 z-[70] w-64 bg-background border border-border rounded-lg shadow-xl p-2.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-foreground">옵션 메모 · {propsStr}</span>
                              <button onClick={() => setSkuMemoEditor(null)} className="text-muted-foreground/50 hover:text-foreground"><X size={13} /></button>
                            </div>
                            <textarea
                              autoFocus
                              value={skuMemoEditor.value}
                              onChange={(e) => setSkuMemoEditor({ skuId: skuKey, spuId: spuIdKey, value: e.target.value })}
                              placeholder="이 옵션에 대한 메모"
                              className="w-full h-20 text-[11px] p-2 bg-secondary/20 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                            />
                            <div className="flex justify-end gap-1.5 mt-1.5">
                              <button onClick={() => setSkuMemoEditor(null)} className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-md">취소</button>
                              <button
                                onClick={() => handleSaveSkuMemo(skuKey, spuIdKey)}
                                disabled={!!savingSkuMemo[skuKey]}
                                className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1 disabled:opacity-40"
                              >
                                {savingSkuMemo[skuKey] ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                저장
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 border-r border-secondary/10 overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
                            {sku.image || item.image ? <img src={sku.image || item.image} className="w-full h-full object-contain" /> : <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />}
                            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="bg-blue-500/10 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">{propsStr}</span>
                              {systemBid && <BidStatusIndicator bid={systemBid} variant="badge" />}
                              {manualBid && (
                                <BidStatusIndicator
                                  bid={manualBid}
                                  variant="badge"
                                  removable
                                  onClick={() => handleToggleSkuManualBid(skuKey, spuIdKey)}
                                />
                              )}
                              {skuStatus?.stockMarked && (
                                <StockStatusIndicator
                                  date={skuStatus.stockMarkedDate ?? formatBidDate(new Date().toISOString())}
                                  variant="badge"
                                  removable
                                  onClick={() => handleToggleSkuStockMarked(skuKey, spuIdKey)}
                                />
                              )}
                              <span className="font-bold text-foreground text-[12px] truncate tracking-tight">{item.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                              <CopyableArticleNumber articleNumber={item.articleNumber} />
                              <span className="opacity-30">|</span>
                              <span className="font-bold text-foreground/40">{item.brand}</span>
                              {systemBid && (
                                <span className="text-[9px] text-blue-700 font-semibold normal-case tracking-normal">
                                  · 입찰 ₩{systemBid.price?.toLocaleString()} ({systemBid.date})
                                </span>
                              )}
                              {manualBid && !systemBid && (
                                <span className="text-[9px] text-red-700 font-semibold normal-case tracking-normal">
                                  · 수동표기 ({manualBid.date})
                                </span>
                              )}
                              {skuStatus?.stockMarked && (
                                <span className="text-[9px] text-emerald-700 font-semibold normal-case tracking-normal">
                                  · 재고보유 ({skuStatus.stockMarkedDate})
                                </span>
                              )}
                            </div>
                            {activityLine && (
                              <span className="text-[9px] text-muted-foreground/70 font-medium normal-case tracking-normal">
                                {activityLine}
                              </span>
                            )}
                            {skuStatus?.memo && (
                              <span className="text-[9px] text-amber-700/80 truncate max-w-full" title={skuStatus.memo}>
                                {skuStatus.memo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* 30일 거래가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01] font-bold text-foreground/60">
                        {(() => {
                           const avgObj = sku.averagePrice;
                           const avg = avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0;
                           return avg > 0 ? `₩${Number(avg).toLocaleString()}` : "—";
                        })()}
                      </td>
                      {/* 중국 노출가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-orange-500/[0.01] leading-none">
                        <div className="font-bold text-[11px] text-orange-600/80 mb-0.5 italic shrink-0" onClick={() => {
                          const exposurePr = resolveExposurePriceValue(rec, row.skuPrice);
                          handleBiddingPriceChange(sku.skuId, String(exposurePr));
                        }}>
                          <span className="inline-flex items-center justify-center gap-1">
                            {formatExposurePrice(rec, row.skuPrice)}
                            {isLoadingRec && !rec && (
                              <Loader2 size={8} className="animate-spin opacity-30 shrink-0" />
                            )}
                          </span>
                        </div>
                      </td>
                      {/* 최저 오퍼 원가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.01] font-bold text-emerald-600">
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                          <SourceOfferPriceCell
                            item={naverItem}
                            loading={!!loadingSourceOffers[item.articleNumber] && !naverItem}
                            emptyClassName="opacity-10"
                            onOpen={() => openSourceOfferModal(item.articleNumber)}
                          />
                        </div>
                      </td>
                      {/* 순수익 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-blue-500/[0.02]">
                        {(() => {
                          if (!naverPrice || !systemSettings) return <span className="opacity-10 text-[11px]">—</span>;
                          const rawSkuPrice = String(rec?.globalMinPrice || row.skuPrice || "").replace(/[^0-9]/g, "");
                          const poizonSkuPrice = Number(rawSkuPrice);
                          if (isNaN(poizonSkuPrice) || poizonSkuPrice <= 0) return <span className="opacity-10 text-[11px]">—</span>;
                          const { fee: skuFee } = calculateMargin(poizonSkuPrice, systemSettings);
                          const skuProfit = poizonSkuPrice - skuFee - Number(naverPrice);
                          return (
                            <div className="flex flex-col items-center leading-none gap-0.5">
                              <span className={`font-bold text-[12px] ${skuProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                {skuProfit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(skuProfit)).toLocaleString()}
                              </span>
                              <span className="text-[9px] text-muted-foreground/40 font-bold">수수료 ₩{skuFee.toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </td>
                      {/* 판매량 (중국/현지) — CN 통계 우선, 없으면 KR */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01]">
                         <div className="font-bold text-[11px] text-foreground/50">
                            {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "globalSoldNum30"))}
                         </div>
                      </td>
                      <td className="px-1 text-center border-r border-secondary/10 bg-secondary/[0.01]">
                        <div className="font-bold text-[11px] text-foreground/40">
                           {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "localSoldNum30"))}
                        </div>
                      </td>
                      {/* 나의 입찰 제안 (가격 입력 + BID) */}
                      <td className="px-2 text-center bg-blue-500/[0.01]">
                         <div className="flex items-center justify-center gap-1.5">
                           <div className="relative group/input flex-1 max-w-[120px]">
                             <input type="text" value={bidPrice ? Number(bidPrice).toLocaleString() : ""} onChange={(e) => handleBiddingPriceChange(sku.skuId, e.target.value)} className="w-full text-[11px] py-1 pl-4 pr-1.5 bg-background border border-secondary/30 rounded-md text-right font-mono font-bold focus:ring-1 focus:ring-primary/30 outline-none transition-all" placeholder="0" />
                             <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-20 group-focus-within/input:opacity-50">₩</span>
                           </div>
                           <button onClick={() => handleSingleBid(sku.skuId, item.id)} disabled={!bidPrice || isBidding} className="px-4 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all uppercase tracking-wider italic shrink-0">BID</button>
                         </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // --- 기존 품번 중심 목록 (Hierarchy Mode) ---
                sortedItems.map((item, idx) => {
                  const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
                  const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
                  
                  // 수익 계산 로직 (필터링용)
                  let profit = -999999;
                  if (naverPrice && !isNaN(poizonPriceNum) && poizonPriceNum > 0 && systemSettings) {
                    const { fee } = calculateMargin(poizonPriceNum, systemSettings);
                    profit = poizonPriceNum - fee - Number(naverPrice);
                  }

                  // 필터링 적용: '수익 상품만 보기' 활성화 시 수익이 0 이하인 항목은 숨김
                  if (showOnlyProfitable && profit <= 0) return null;

                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isExpanded = !!expandedRows[item.id];
                  const childSkuIds = getChildSkuIds(item);
                  const allSkusSkipped = childSkuIds.length > 0 && childSkuIds.every((id: string) => skippedSkuIds.has(id));
                  const selectedChildCount = childSkuIds.filter((id: string) => selectedSkus[id]).length;
                  const allChildSelected = childSkuIds.length > 0 && selectedChildCount === childSkuIds.length;
                  const someChildSelected = selectedChildCount > 0 && !allChildSelected;

                  // 품번(SPU) 처리 상태/메모
                  const spuKey = String(item.id).replace(/[^0-9]/g, "");
                  const status = itemStatuses[spuKey];
                  const hasMemo = !!status?.memo;
                  const spuBidSummary = getSpuBidSummary(item);
                  const reviewSummary = getSpuReviewSummary(item);
                  const { allHandled, someHandled, reviewState, handledCount, totalCount } = reviewSummary;
                  const spuVisual = getSpuRowVisualState({
                    hasAnyBid: spuBidSummary.bidCount > 0,
                    allSkusSkipped,
                    allHandled,
                    someHandled,
                  });
                  const spuActivityLine = formatActivityLine(
                    getSpuLastActivity(
                      childSkuIds.map((id) => resolveSkuActivity(id, skuStatuses[id])),
                      status?.updatedAt,
                      status?.handled
                    )
                  );

                  return (
                    <React.Fragment key={`${item.articleNumber}-${idx}`}>
                      <tr
                        data-spu-row={item.id}
                        className={`hover:bg-secondary/5 transition-colors group h-14 ${isExpanded ? "bg-secondary/[0.02]" : ""} ${spuVisual.rowClass} ${spuVisual.fade ? "opacity-40 grayscale-[0.5]" : ""} ${item.skuDetails?.length > 0 ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (item.skuDetails?.length > 0) toggleRow(item.id, item.skuDetails);
                        }}
                      >
                        <td className="px-1 text-center relative border-r border-secondary/10" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-start gap-0">
                            {/* slot1: 선택 */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <Checkbox
                                aria-label="이 품번의 모든 옵션 입찰 선택"
                                checked={allChildSelected ? true : someChildSelected ? "indeterminate" : false}
                                onCheckedChange={() => setManySelected(childSkuIds, !allChildSelected)}
                              />
                            </div>
                            {/* slot2: 검토완료 */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <ReviewCheckButton
                                state={reviewState}
                                partialLabel={someHandled ? `${handledCount}/${totalCount}` : undefined}
                                onClick={() => toggleItemHandled(item)}
                              />
                            </div>
                            {/* slot3: 메모 */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <button
                                onClick={() => setMemoEditor(memoEditor?.spuId === spuKey ? null : { spuId: spuKey, value: status?.memo ?? "" })}
                                title={hasMemo ? `메모: ${status?.memo}` : "메모 추가"}
                                className={`p-1 rounded-md transition-all ${hasMemo ? 'text-amber-600 bg-amber-500/10 hover:bg-amber-500/20' : 'text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-500/5'}`}
                              >
                                <StickyNote size={14} />
                              </button>
                            </div>
                            {/* slot4: 스킵 (세부옵션 눈 아이콘과 수직 정렬) */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleSkip(item, false);
                                }}
                                disabled={childSkuIds.length === 0}
                                title={
                                  childSkuIds.length === 0
                                    ? "옵션 정보가 없어 스킵할 수 없습니다"
                                    : allSkusSkipped
                                      ? "이 품번 전체 옵션 스킵 해제"
                                      : "이 품번 전체 옵션(사이즈) 스킵"
                                }
                                className={`p-1 rounded-md transition-all disabled:opacity-20 disabled:cursor-not-allowed ${allSkusSkipped ? 'text-orange-600 bg-orange-500/15 ring-1 ring-orange-500/40' : 'text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-secondary/60'}`}
                              >
                                {allSkusSkipped ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            {/* slot5: 영구 제외 */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <button
                                onClick={() => {
                                  setItemToExclude({ articleNumber: item.articleNumber, title: item.title, idx });
                                  setExcludeReason("");
                                  setIsExcludeModalOpen(true);
                                }}
                                title="이 품번 검색에서 영구 제외"
                                className="p-1 text-muted-foreground/30 hover:text-orange-500 hover:bg-orange-500/5 rounded-md transition-all"
                              ><Ban size={14} /></button>
                            </div>
                            {/* slot6: 임시 삭제 */}
                            <div className="w-6 flex items-center justify-center shrink-0">
                              <button onClick={() => removeItem(idx)} title="목록에서 임시 삭제" className="p-1 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 rounded-md transition-all"><Trash2 size={14} /></button>
                            </div>
                          </div>

                          {memoEditor?.spuId === spuKey && (
                            <div className="absolute left-2 top-full mt-1 z-[70] w-64 bg-background border border-border rounded-lg shadow-xl p-2.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-foreground">메모</span>
                                <button onClick={() => setMemoEditor(null)} className="text-muted-foreground/50 hover:text-foreground"><X size={13} /></button>
                              </div>
                              <textarea
                                autoFocus
                                value={memoEditor.value}
                                onChange={(e) => setMemoEditor({ spuId: spuKey, value: e.target.value })}
                                placeholder="이 품번에 대한 메모 (예: 가격 추적, 재입고 대기 등)"
                                className="w-full h-20 text-[11px] p-2 bg-secondary/20 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                              />
                              <div className="flex justify-end gap-1.5 mt-1.5">
                                <button onClick={() => setMemoEditor(null)} className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-md">취소</button>
                                <button onClick={() => handleSaveMemo(item)} className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1">
                                  <Save size={11} /> 저장
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-2 border-r border-secondary/10 overflow-hidden">
                          <div className="flex items-center gap-3">
                            {item.skuDetails?.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleRow(item.id, item.skuDetails); }}
                                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                                title={isExpanded ? "옵션 접기" : "옵션 펼치기"}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <div className="w-7 h-7 shrink-0" />
                            )}
                            <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
                              {item.image ? <img src={item.image} className="w-full h-full object-contain" /> : <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />}
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">{item.brand}</span>
                                <span className="font-bold text-foreground text-[12px] truncate tracking-tight">{item.title}</span>
                                {item.skuDetails?.length > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold shrink-0">
                                    {item.skuDetails.length}개 옵션
                                  </span>
                                )}
                                {spuBidSummary.bidCount > 0 && (
                                  <SpuBidSummary
                                    variant="inline"
                                    systemCount={spuBidSummary.systemCount}
                                    manualCount={spuBidSummary.manualCount}
                                    totalCount={spuBidSummary.totalCount}
                                    bids={spuBidSummary.bids}
                                  />
                                )}
                                {allHandled && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                    <CheckCircle2 size={9} /> 검토완료
                                  </span>
                                )}
                                {someHandled && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                                    <CheckCircle2 size={9} /> 검토 {handledCount}/{totalCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                                <CopyableArticleNumber articleNumber={item.articleNumber} />
                                <span className="opacity-30">|</span>
                                <span>{item.category}</span>
                                {isBiddable && <span className="ml-1 bg-emerald-500/10 text-emerald-600 text-[8px] px-1 py-0.5 rounded border border-emerald-500/20 font-bold">입찰 가능</span>}
                              </div>
                              {spuActivityLine && (
                                <span className="text-[9px] text-muted-foreground/70 font-medium normal-case tracking-normal">
                                  {spuActivityLine}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01] font-bold text-foreground/80">
                          {item.avgPrice}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-orange-500/[0.01] leading-none">
                            <div className="font-bold text-[11px] text-orange-600/80 italic shrink-0">
                                {item.minPrice}
                            </div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.01] font-bold text-emerald-600">
                          <div className="flex flex-col items-center justify-center -space-y-0.5">
                            <SourceOfferPriceCell
                              item={getBestSourceOffer(sourceOffers, item.articleNumber)}
                              loading={!!loadingSourceOffers[item.articleNumber]}
                              onOpen={() => openSourceOfferModal(item.articleNumber)}
                            />
                          </div>
                        </td>
                        {/* 순수익 컬럼: 포이즌 노출가 - 수수료 - 최저 오퍼 원가 */}
                        <td className="px-1 text-center border-r border-secondary/10 bg-blue-500/[0.02]">
                          {(() => {
                            const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
                            if (!naverPrice || item.minPrice === "—" || !systemSettings) return <span className="opacity-20 text-[11px]">—</span>;
                            const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
                            if (isNaN(poizonPriceNum) || poizonPriceNum <= 0) return <span className="opacity-20 text-[11px]">—</span>;
                            const { fee } = calculateMargin(poizonPriceNum, systemSettings);
                            const profit = poizonPriceNum - fee - Number(naverPrice);
                            return (
                              <div className="flex flex-col items-center leading-none gap-0.5">
                                <span className={`font-bold text-[12px] ${profit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                  {profit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(profit)).toLocaleString()}
                                </span>
                                <span className="text-[9px] text-muted-foreground/40 font-bold">
                                  수수료 ₩{fee.toLocaleString()}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/70">{item.salesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-secondary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/50">{item.localSalesVolume}</div>
                        </td>
                        <td className="px-1 text-center text-[10px] text-muted-foreground/30 italic font-bold">SELECT SKU</td>
                      </tr>

                      {isExpanded && item.skuDetails?.map((sku: any) => {
                        const rec = skuRecommendations[sku.skuId];
                        const isLoadingRec = loadingRecommendations[sku.skuId];
                        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                        const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                        const skuPrice = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "—";
                        const bidPrice = biddingPrices[sku.skuId];
                        const naverPrice = getBestSourceOfferPrice(sourceOffers, item.articleNumber);
                        const margin = getMargin(bidPrice, naverPrice ? Number(naverPrice) : undefined);
                        const skuKey = resolveSkuId(sku);
                        const isSkuSkipped = skippedSkuIds.has(skuKey);
                        const skuStatus = skuStatuses[skuKey];
                        const { systemBid, manualBid } = getSkuBidViews(skuKey, skuStatus);
                        const isSkuHandled = skuStatus?.handled ?? false;
                        const rowVisual = getSkuRowVisualState({
                          hasSystemBid: !!systemBid,
                          hasManualBid: !!manualBid,
                          hasStockMarked: !!skuStatus?.stockMarked,
                          isSkipped: isSkuSkipped,
                          isReviewed: isSkuHandled,
                        });
                        const skuActivity = resolveSkuActivity(skuKey, skuStatus);
                        const activityLine = formatActivityLine(skuActivity);

                        return (
                          <tr key={sku.skuId} className={`bg-secondary/[0.04] text-[11px] h-12 border-b border-dashed border-secondary/20 ${rowVisual.rowClass} ${rowVisual.fade ? "opacity-40 grayscale-[0.5]" : ""}`}>
                            {/* 관리 (선택 + 입찰 + 재고 + 검토 + 메모 + 스킵) */}
                            <td className={`px-1 border-r border-secondary/5 border-dashed relative ${rowVisual.manageCellClass}`}>
                              <SkuRowManageCell
                                skuId={sku.skuId}
                                checked={!!selectedSkus[sku.skuId]}
                                onCheckedChange={() => toggleSkuSelection(sku.skuId)}
                                systemBid={systemBid}
                                manualBid={manualBid}
                                onManualBidToggle={() => handleToggleSkuManualBid(skuKey, spuKey)}
                                isSavingManualBid={!!savingManualBid[skuKey]}
                                stockMarked={!!skuStatus?.stockMarked}
                                stockMarkedDate={skuStatus?.stockMarkedDate}
                                onStockToggle={() => handleToggleSkuStockMarked(skuKey, spuKey)}
                                isSavingStock={!!savingStockMarked[skuKey]}
                                isHandled={isSkuHandled}
                                onHandledToggle={() => toggleSkuHandled(skuKey, spuKey, childSkuIds, item)}
                                hasMemo={!!skuStatus?.memo}
                                memoTitle={skuStatus?.memo ?? undefined}
                                activityTitle={activityLine ?? undefined}
                                onMemoClick={() =>
                                  setSkuMemoEditor(
                                    skuMemoEditor?.skuId === skuKey
                                      ? null
                                      : { skuId: skuKey, spuId: spuKey, value: skuStatus?.memo ?? "" }
                                  )
                                }
                                isSkipped={isSkuSkipped}
                                onSkipToggle={() => handleToggleSkip({ ...sku, parent: item }, true)}
                                checkboxSize="sm"
                              />
                              {skuMemoEditor?.skuId === skuKey && (
                                <div className="absolute left-2 top-full mt-1 z-[70] w-64 bg-background border border-border rounded-lg shadow-xl p-2.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-bold text-foreground">옵션 메모 · {propsStr}</span>
                                    <button onClick={() => setSkuMemoEditor(null)} className="text-muted-foreground/50 hover:text-foreground"><X size={13} /></button>
                                  </div>
                                  <textarea
                                    autoFocus
                                    value={skuMemoEditor.value}
                                    onChange={(e) => setSkuMemoEditor({ skuId: skuKey, spuId: spuKey, value: e.target.value })}
                                    placeholder="이 옵션에 대한 메모"
                                    className="w-full h-20 text-[11px] p-2 bg-secondary/20 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                                  />
                                  <div className="flex justify-end gap-1.5 mt-1.5">
                                    <button onClick={() => setSkuMemoEditor(null)} className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-md">취소</button>
                                    <button
                                      onClick={() => handleSaveSkuMemo(skuKey, spuKey)}
                                      disabled={!!savingSkuMemo[skuKey]}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1 disabled:opacity-40"
                                    >
                                      {savingSkuMemo[skuKey] ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                      저장
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-2 border-r border-secondary/5 border-dashed">
                              <div className="flex items-center gap-3 pl-6">
                                <div className="w-8 h-8 bg-white border border-secondary/10 rounded-md p-1 shrink-0 flex items-center justify-center shadow-xs">
                                  {sku.image ? <img src={sku.image} className="max-w-full max-h-full object-contain" /> : <ImageIcon size={14} className="opacity-5"/>}
                                </div>
                                <div className="flex flex-col min-w-0 leading-tight">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground/70 truncate">{propsStr}</span>
                                    {systemBid && <BidStatusIndicator bid={systemBid} variant="badge" />}
                                    {manualBid && (
                                      <BidStatusIndicator
                                        bid={manualBid}
                                        variant="badge"
                                        removable
                                        onClick={() => handleToggleSkuManualBid(skuKey, spuKey)}
                                      />
                                    )}
                                    {skuStatus?.stockMarked && (
                                      <StockStatusIndicator
                                        date={skuStatus.stockMarkedDate ?? formatBidDate(new Date().toISOString())}
                                        variant="badge"
                                        removable
                                        onClick={() => handleToggleSkuStockMarked(skuKey, spuKey)}
                                      />
                                    )}
                                    <span className="bg-emerald-500/5 text-emerald-600/60 text-[8px] px-1 py-0.5 rounded border border-emerald-500/10 font-bold shrink-0">입찰 가능</span>
                                  </div>
                                  {systemBid && (
                                    <span className="text-[9px] text-blue-700 font-semibold">
                                      입찰 ₩{systemBid.price?.toLocaleString()} · {systemBid.date}
                                    </span>
                                  )}
                                  {manualBid && !systemBid && (
                                    <span className="text-[9px] text-red-700 font-semibold">
                                      수동표기 · {manualBid.date}
                                    </span>
                                  )}
                                  {skuStatus?.stockMarked && (
                                    <span className="text-[9px] text-emerald-700 font-semibold">
                                      재고보유 · {skuStatus.stockMarkedDate}
                                    </span>
                                  )}
                                  {activityLine && (
                                    <span className="text-[9px] text-muted-foreground/70 font-medium">
                                      {activityLine}
                                    </span>
                                  )}
                                  {skuStatus?.memo && (
                                    <span className="text-[9px] text-amber-700/80 truncate max-w-[200px]" title={skuStatus.memo}>
                                      {skuStatus.memo}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">SKUID: {sku.skuId}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.01] font-bold text-foreground/60 leading-tight">
                              <div className="text-[11px]">
                                {(() => {
                                  const avgObj = sku.averagePrice;
                                  const avg = avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0;
                                  return avg > 0 ? `₩${Number(avg).toLocaleString()}` : "—";
                                })()}
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-orange-500/[0.01] leading-none">
                              <div className="cursor-pointer hover:underline font-bold text-orange-600/70 block mb-0.5 text-[11px]" onClick={() => {
                                const exposurePr = resolveExposurePriceValue(rec, skuPrice);
                                handleBiddingPriceChange(sku.skuId, String(exposurePr));
                              }}>
                                <span className="inline-flex items-center justify-center gap-1">
                                  {formatExposurePrice(rec, skuPrice)}
                                  {isLoadingRec && !rec && (
                                    <Loader2 size={8} className="animate-spin opacity-30 shrink-0" />
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-emerald-500/[0.01] font-bold text-emerald-600/70">
                               <div className="flex flex-col items-center justify-center -space-y-0.5">
                                 <SourceOfferPriceCell
                                   item={getBestSourceOffer(sourceOffers, item.articleNumber)}
                                   loading={!!loadingSourceOffers[item.articleNumber] && !getBestSourceOffer(sourceOffers, item.articleNumber)}
                                   emptyClassName="opacity-10"
                                   onOpen={() => openSourceOfferModal(item.articleNumber)}
                                 />
                               </div>
                            </td>
                            {/* SKU 순수익 컬럼 */}
                            <td className="px-1 text-center border-r border-dashed bg-blue-500/[0.02]">
                              {(() => {
                                if (!naverPrice || !systemSettings) return <span className="opacity-10 text-[11px]">—</span>;
                                const rawSkuPrice = String(rec?.globalMinPrice || skuPrice || "").replace(/[^0-9]/g, "");
                                const poizonSkuPrice = Number(rawSkuPrice);
                                if (isNaN(poizonSkuPrice) || poizonSkuPrice <= 0) return <span className="opacity-10 text-[11px]">—</span>;
                                const { fee: skuFee } = calculateMargin(poizonSkuPrice, systemSettings);
                                const skuProfit = poizonSkuPrice - skuFee - Number(naverPrice);
                                return (
                                  <div className="flex flex-col items-center leading-none gap-0.5">
                                    <span className={`font-bold text-[11px] ${skuProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                      {skuProfit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(skuProfit)).toLocaleString()}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/40 font-bold">수수료 ₩{skuFee.toLocaleString()}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.01]">
                              <div className="font-bold text-[11px] text-foreground/40">
                                {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "globalSoldNum30"))}
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-secondary/[0.01]">
                              <div className="font-bold text-[11px] text-foreground/40">
                                {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "localSoldNum30"))}
                              </div>
                            </td>
                            <td className="px-1 text-center bg-blue-500/[0.01]">
                              <div className="flex items-center justify-center px-1 gap-1.5">
                                {margin ? (
                                  <div className="flex flex-col items-center leading-none gap-0.5 min-w-[44px]">
                                    <span className={`font-bold text-[11px] ${margin.actualProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                      {margin.actualProfit > 0 ? "▲" : "▼"} ₩{Math.round(margin.actualProfit).toLocaleString()}
                                    </span>
                                    <span className="text-[9px] font-bold opacity-30">{margin.actualRate}%</span>
                                  </div>
                                ) : <div className="min-w-[44px] opacity-10 text-[9px] font-bold">READY</div>}

                                <div className="flex flex-col items-center justify-center flex-1">
                                  <div className="relative group/input w-full max-w-[100px] mx-auto">
                                    <input type="text" value={bidPrice ? Number(bidPrice).toLocaleString() : ""} onChange={(e) => handleBiddingPriceChange(sku.skuId, e.target.value)} className="w-full text-[11px] py-1 pl-4 pr-1.5 bg-background border border-secondary/30 rounded-md text-right font-mono font-bold focus:ring-1 focus:ring-primary/30 outline-none transition-all" placeholder="0" />
                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-20 group-focus-within/input:opacity-50">₩</span>
                                  </div>
                                  {bidPrice && <span className="text-[8px] text-muted-foreground/40 mt-0.5 font-bold uppercase tracking-tighter">NET: ₩{calculateNet(bidPrice, naverPrice ? Number(naverPrice) : undefined)?.toLocaleString()}</span>}
                                </div>

                                <button
                                  onClick={() => handleSingleBid(sku.skuId, item.id)}
                                  disabled={!bidPrice || isBidding}
                                  className="px-3 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all uppercase tracking-wider italic shrink-0"
                                >
                                  BID
                                </button>
                              </div>
                            </td>
                         </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 브랜드 '더 불러오기' (누적 탐색) */}
        {searchType === "brand" && totalCount > 0 && items.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-secondary/10 flex items-center justify-between gap-4 text-xs">
            <div className="text-muted-foreground">
              총 <span className="font-bold text-foreground">{totalCount.toLocaleString()}</span>개 중{" "}
              <span className="font-bold text-primary">{items.length.toLocaleString()}</span>개 불러옴
              <span className="opacity-60"> ({brandLastApiPage}페이지까지)</span>
            </div>
            {brandLastApiPage > 0 && brandLastApiPage * pageSize < totalCount ? (
              <button
                onClick={handleLoadMore}
                disabled={isLoading || isLoadingMore}
                className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40`}
              >
                {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                더 불러오기 (다음 {pageSize}개)
              </button>
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
        onSuccess={(newData) => setSystemSettings(newData as SystemSettings)}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl border border-white/10 max-w-[90vw]">
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

function CopyableArticleNumber({ articleNumber }: { articleNumber: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(articleNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 group/copy">
      <span className="font-mono text-primary/70">{articleNumber}</span>
      <button 
        onClick={handleCopy} 
        className="p-0.5 text-muted-foreground/30 opacity-0 group-hover/copy:opacity-100 hover:text-primary transition-all rounded hover:bg-primary/10"
        title="품번 복사"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
