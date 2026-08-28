"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  DollarSign,
  Download,
  Filter,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
  Bot,
} from "lucide-react";
import {
  cancelBid,
  getLocalBidHistory,
  getMyListings,
  updateBidPrice,
  updateSelectedListingPrices,
  type ListingItem,
} from "@/app/actions/listing";
import { submitAutoFollow } from "@/app/actions/auto-follow";
import { getSkuStatuses, getSkuStatusesBySpuIds, getStockMarkedSkuStatuses, setSkuStockMarked } from "@/app/actions/sku-status";
import { FOLLOW_TYPES } from "@/types/auto-follow";
import { formatWonAmount } from "@/lib/utils/exposure-price";
import { computeAdjustedPrice, formatBidDate } from "@/lib/utils/poizon-listing";
import { CopyableArticleNumber } from "@/components/dashboard/copyable-article-number";
import { StockStatusIndicator } from "@/components/dashboard/stock-status-indicator";
import { EMPTY_SKU_STATUS, type SkuStatus } from "@/types/sku-status";
import {
  canEditListing,
  isLowestMissed,
  LISTING_STATUS_TABS,
  LISTING_VIEW_FILTERS,
  listingStatusMeta,
  matchesListingViewFilter,
  type ListingStatusTab,
  type ListingViewFilter,
  type PriceAdjustMode,
} from "@/types/poizon-listing";

interface BidHistoryItem {
  id: string;
  sku_id: number;
  spu_id: number;
  article_number: string;
  product_name: string;
  size_info: string;
  bid_price: number;
  seller_bidding_no: string;
  status: string;
  created_at: string;
}

const pageSize = 20;
const LOCAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: "활성", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  cancelled: { label: "취소", color: "text-gray-500 bg-gray-500/10 border-gray-500/20" },
};

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function looksLikeBiddingNo(value: string): boolean {
  return /^\d{12,}$/.test(value.trim());
}

function uniquePositiveIds(...ids: Array<number | undefined | null>): number[] {
  const set = new Set<number>();
  for (const id of ids) {
    if (id != null && Number.isFinite(id) && id > 0) set.add(id);
  }
  return [...set];
}

function skuStatusForIds(
  statuses: Record<string, SkuStatus>,
  ...ids: Array<number | undefined | null>
): SkuStatus | undefined {
  let fallback: SkuStatus | undefined;
  for (const id of ids) {
    if (id == null || !Number.isFinite(id) || id <= 0) continue;
    const found = statuses[String(id)];
    if (!found) continue;
    if (found.stockMarked) return found;
    if (!fallback) fallback = found;
  }
  return fallback;
}

function listingStatusIds(item: {
  skuId?: number;
  globalSkuId?: number;
  skuIdAliases?: number[];
}): Array<number | undefined | null> {
  return [item.skuId, item.globalSkuId, ...(item.skuIdAliases ?? [])];
}

async function loadSkuStatusesForIds(skuIds: number[], spuIds: number[]) {
  const [bySku, bySpu, marked] = await Promise.all([
    skuIds.length > 0
      ? getSkuStatuses(skuIds)
      : Promise.resolve({ success: true as const, data: {} as Record<string, SkuStatus> }),
    spuIds.length > 0
      ? getSkuStatusesBySpuIds(spuIds)
      : Promise.resolve({ success: true as const, data: {} as Record<string, SkuStatus> }),
    getStockMarkedSkuStatuses(),
  ]);
  return { ...(bySpu.data ?? {}), ...(bySku.data ?? {}), ...(marked.data ?? {}) };
}

function withStockMark(prev: SkuStatus | undefined, marked: boolean, now: string): SkuStatus {
  return {
    ...(prev ?? EMPTY_SKU_STATUS),
    stockMarked: marked,
    stockMarkedDate: marked ? formatBidDate(now) : null,
    stockMarkedAt: marked ? now : null,
    updatedAt: now,
  };
}

function patchSkuStatuses(
  prev: Record<string, SkuStatus>,
  ids: Array<number | undefined | null>,
  next: SkuStatus
): Record<string, SkuStatus> {
  const out = { ...prev };
  for (const id of uniquePositiveIds(...ids)) {
    out[String(id)] = next;
  }
  return out;
}

export function ListingsBoard() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [localHistory, setLocalHistory] = useState<BidHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusTab, setStatusTab] = useState<ListingStatusTab>("active");
  const [viewFilter, setViewFilter] = useState<ListingViewFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [exclusiveStartOffsetId, setExclusiveStartOffsetId] = useState(0);
  const [prevOffsets, setPrevOffsets] = useState<number[]>([]);
  const [lastOffsetId, setLastOffsetId] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [localPage, setLocalPage] = useState(1);
  const [localTotal, setLocalTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"api" | "local">("api");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [followItem, setFollowItem] = useState<ListingItem | null>(null);
  const [skuStatuses, setSkuStatuses] = useState<Record<string, SkuStatus>>({});
  const [savingStockIds, setSavingStockIds] = useState<Set<string>>(new Set());

  const tradeStatus = LISTING_STATUS_TABS.find((tab) => tab.key === statusTab)?.tradeStatus ?? 2;

  const resetPaging = useCallback(() => {
    setExclusiveStartOffsetId(0);
    setPrevOffsets([]);
    setSelectedIds(new Set());
  }, []);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      if (dataSource === "api") {
        const biddingNo = looksLikeBiddingNo(appliedKeyword) ? appliedKeyword.trim() : undefined;
        const result = await getMyListings({
          tradeStatus,
          exclusiveStartOffsetId,
          pageSize,
          sellerBiddingNo: biddingNo,
        });
        if (result.success) {
          setListings(result.data);
          setLastOffsetId(result.lastOffsetId);
          setHasMore(result.hasMore);
          const skuIds = uniquePositiveIds(
            ...result.data.flatMap((item) => listingStatusIds(item))
          );
          const spuIds = uniquePositiveIds(...result.data.flatMap((item) => [item.spuId, item.globalSpuId]));
          setSkuStatuses(await loadSkuStatusesForIds(skuIds, spuIds));
        } else {
          setApiError(result.error || "입찰 목록을 불러오지 못했습니다.");
          const localResult = await getLocalBidHistory(localPage, pageSize);
          if (localResult.success) {
            setLocalHistory(localResult.data as BidHistoryItem[]);
            setLocalTotal(localResult.total);
            setDataSource("local");
            const skuIds = uniquePositiveIds(...(localResult.data as BidHistoryItem[]).map((item) => item.sku_id));
            setSkuStatuses(await loadSkuStatusesForIds(skuIds, []));
          }
        }
      } else {
        const localResult = await getLocalBidHistory(localPage, pageSize);
        if (localResult.success) {
          setLocalHistory(localResult.data as BidHistoryItem[]);
          setLocalTotal(localResult.total);
          const skuIds = uniquePositiveIds(...(localResult.data as BidHistoryItem[]).map((item) => item.sku_id));
          setSkuStatuses(await loadSkuStatusesForIds(skuIds, []));
        }
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [appliedKeyword, dataSource, exclusiveStartOffsetId, localPage, tradeStatus]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const visibleListings = useMemo(() => {
    const q = appliedKeyword.trim().toLowerCase();
    return listings.filter((item) => {
      const skuStatus = skuStatusForIds(skuStatuses, ...listingStatusIds(item));
      if (!matchesListingViewFilter(item, viewFilter, { stockMarked: !!skuStatus?.stockMarked })) return false;
      if (!q || looksLikeBiddingNo(q)) return true;
      return [item.productName, item.articleNumber, item.sizeInfo, item.sellerBiddingNo, String(item.skuId)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [appliedKeyword, listings, skuStatuses, viewFilter]);

  const handleToggleStock = async (
    ids: Array<number | undefined | null>,
    skuId: number,
    spuId?: number | null
  ) => {
    const saveKey = String(skuId);
    if (!skuId || savingStockIds.has(saveKey)) return;
    const current = !!skuStatusForIds(skuStatuses, ...ids, skuId)?.stockMarked;
    const next = !current;
    const now = new Date().toISOString();
    const snapshot = skuStatuses;
    const patched = withStockMark(skuStatusForIds(skuStatuses, ...ids, skuId), next, now);
    const writeIds = uniquePositiveIds(
      skuId,
      ...ids.filter((id) => id != null && skuStatuses[String(id)])
    );

    setSkuStatuses((prev) => patchSkuStatuses(prev, [...ids, skuId], patched));
    setSavingStockIds((prev) => new Set(prev).add(saveKey));
    try {
      const results = await Promise.all(
        writeIds.map((id) => setSkuStockMarked(id, next, spuId ?? undefined))
      );
      if (results.some((res) => !res.success)) {
        setSkuStatuses(snapshot);
        const failed = results.find((res) => !res.success);
        alert(`재고 보유 표기 실패: ${failed?.error ?? "sku_status 테이블을 확인하세요."}`);
      }
    } finally {
      setSavingStockIds((prev) => {
        const n = new Set(prev);
        n.delete(saveKey);
        return n;
      });
    }
  };

  const handleCancel = async (sellerBiddingNo: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm("이 입찰을 취소하시겠습니까?")) return;
    setCancellingIds((prev) => new Set(prev).add(sellerBiddingNo));
    try {
      const result = await cancelBid(sellerBiddingNo);
      if (result.success) await fetchListings();
      else alert(`취소 실패: ${result.error}`);
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(sellerBiddingNo);
        return next;
      });
    }
  };

  const handlePriceUpdate = async (item: ListingItem) => {
    const newPrice = editingPrice[item.sellerBiddingNo];
    if (!newPrice) return;
    const numPrice = Number(newPrice.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      alert("유효한 가격을 입력해 주세요.");
      return;
    }
    setUpdatingIds((prev) => new Set(prev).add(item.sellerBiddingNo));
    try {
      const result = await updateBidPrice(
        item.sellerBiddingNo,
        item.skuId,
        numPrice,
        item.spuId,
        item.quantity
      );
      if (result.success) {
        setEditingPrice((prev) => {
          const next = { ...prev };
          delete next[item.sellerBiddingNo];
          return next;
        });
        await fetchListings();
      } else {
        alert(`가격 수정 실패: ${result.error}`);
      }
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.sellerBiddingNo);
        return next;
      });
    }
  };

  const selectedListings = visibleListings.filter((item) => selectedIds.has(item.sellerBiddingNo));
  const editableSelected = selectedListings.filter((item) => canEditListing(item.tradeStatus));

  const handleBatchCancel = async () => {
    if (editableSelected.length === 0) return;
    if (!confirm(`선택된 ${editableSelected.length}건의 입찰을 취소하시겠습니까?`)) return;
    for (const item of editableSelected) {
      await handleCancel(item.sellerBiddingNo, true);
    }
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    if (dataSource === "api") {
      downloadCsv(
        `listings-${statusTab}.csv`,
        ["입찰번호", "품번", "상품", "사이즈", "SKU", "가격", "수량", "상태", "중국노출", "한국노출", "중국최저", "한국최저", "재고보유"],
        visibleListings.map((item) => [
          item.sellerBiddingNo,
          item.articleNumber,
          item.productName,
          item.sizeInfo,
          item.skuId,
          item.price,
          item.onSaleQuantity || item.quantity,
          listingStatusMeta(item.tradeStatus).label,
          item.cnExposed ? "노출" : "미노출",
          item.krExposed ? "노출" : "미노출",
          item.cnMinPrice ?? "",
          item.krMinPrice ?? "",
          skuStatusForIds(skuStatuses, ...listingStatusIds(item))?.stockMarked ? "Y" : "",
        ])
      );
      return;
    }
    downloadCsv(
      "listings-local.csv",
      ["입찰번호", "상품", "사이즈", "SKU", "가격", "상태", "재고보유"],
      localHistory.map((item) => [
        item.seller_bidding_no,
        item.product_name,
        item.size_info,
        item.sku_id,
        item.bid_price,
        item.status,
        skuStatusForIds(skuStatuses, item.sku_id)?.stockMarked ? "Y" : "",
      ])
    );
  };

  const toggleSelectAll = () => {
    const allIds =
      dataSource === "api"
        ? visibleListings.map((item) => item.sellerBiddingNo)
        : localHistory.map((item) => item.seller_bidding_no || item.id);
    setSelectedIds((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  };

  const localPages = Math.ceil(localTotal / pageSize);
  const currentCount = dataSource === "api" ? visibleListings.length : localHistory.length;
  const allSelected = currentCount > 0 && selectedIds.size === currentCount;

  return (
    <div className="h-full flex flex-col gap-2 w-full min-h-0">
      <div className="glass-panel border border-secondary/40 rounded-xl p-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (keyword === appliedKeyword && exclusiveStartOffsetId === 0) {
                    void fetchListings();
                  } else {
                    setAppliedKeyword(keyword);
                    resetPaging();
                  }
                }}
                placeholder="상품명 / 품번 / 사이즈 / SKU / 입찰번호"
                className="w-full pl-9 pr-4 py-2 bg-secondary/30 border-none rounded-lg outline-none text-[13px]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (keyword === appliedKeyword && exclusiveStartOffsetId === 0) {
                  void fetchListings();
                } else {
                  setAppliedKeyword(keyword);
                  resetPaging();
                }
              }}
              disabled={isLoading}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              검색
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {LISTING_STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusTab(tab.key);
                  resetPaging();
                }}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap border ${
                  statusTab === tab.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/20 text-muted-foreground border-secondary/30 hover:bg-secondary/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="w-px h-4 bg-secondary/50 mx-1" />
            {LISTING_VIEW_FILTERS.filter((tab) => tab.key !== "stock").map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewFilter(tab.key)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap border ${
                  viewFilter === tab.key
                    ? "bg-secondary text-foreground border-secondary"
                    : "bg-secondary/10 text-muted-foreground border-secondary/20 hover:bg-secondary/30"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="w-px h-4 bg-secondary/50 mx-1" />
            {LISTING_VIEW_FILTERS.filter((tab) => tab.key === "stock").map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewFilter(tab.key)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap border ${
                  viewFilter === tab.key
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 glass-panel border border-secondary/40 rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between p-4 border-b bg-secondary/5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">입찰 관리</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              이 페이지 {currentCount}건
            </span>
            {dataSource === "api" && (
              <span className="text-[10px] text-muted-foreground">총건수 없음 · 다음으로 이어 조회</span>
            )}
            {dataSource === "local" && (
              <span className="text-[10px] bg-orange-500/10 text-orange-600 px-2 py-1 rounded-full font-semibold border border-orange-500/20">
                로컬 이력
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setDataSource(dataSource === "api" ? "local" : "api");
                resetPaging();
                setLocalPage(1);
              }}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 font-medium"
            >
              <Filter size={13} />
              {dataSource === "api" ? "로컬 이력" : "API 조회"}
            </button>
            <button
              type="button"
              onClick={() => void fetchListings()}
              disabled={isLoading}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 font-medium disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              새로고침
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={currentCount === 0}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 font-medium disabled:opacity-30"
            >
              <Download size={13} />
              내보내기
            </button>
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={editableSelected.length === 0}
              className="text-[11px] px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 flex items-center gap-1.5 font-bold disabled:opacity-30"
            >
              <DollarSign size={13} />
              가격 조정 ({editableSelected.length})
            </button>
            <button
              type="button"
              onClick={() => void handleBatchCancel()}
              disabled={editableSelected.length === 0}
              className="text-[11px] px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 flex items-center gap-1.5 font-bold disabled:opacity-30"
            >
              <Trash2 size={13} />
              일괄 취소 ({editableSelected.length})
            </button>
          </div>
        </div>

        {apiError && (
          <div className="mx-4 mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-[12px] text-orange-700">
            <AlertCircle size={14} />
            <span className="flex-1">{apiError}</span>
            <button type="button" onClick={() => setApiError(null)} className="hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-[13px] text-left whitespace-nowrap border-collapse">
            <thead className="text-[11px] text-muted-foreground bg-background sticky top-0 z-20 shadow-sm border-b uppercase font-bold tracking-wider">
              <tr className="bg-secondary/5 h-10">
                <th className="px-2 w-10 text-center border-r border-secondary/10">
                  <input type="checkbox" className="w-3.5 h-3.5" onChange={toggleSelectAll} checked={allSelected} />
                </th>
                <th className="px-2 min-w-[72px] text-center border-r border-secondary/10">재고</th>
                <th className="px-4 min-w-[280px] border-r border-secondary/10">상품</th>
                <th className="px-2 min-w-[60px] text-center border-r border-secondary/10">수량</th>
                <th className="px-2 min-w-[110px] text-center border-r border-secondary/10">입찰가</th>
                <th className="px-2 min-w-[80px] text-center border-r border-secondary/10">상태</th>
                <th className="px-2 min-w-[110px] text-center border-r border-secondary/10">중국</th>
                <th className="px-2 min-w-[110px] text-center border-r border-secondary/10">한국</th>
                <th className="px-2 min-w-[180px] text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 size={28} className="animate-spin opacity-30" />
                      <span className="text-[13px] font-medium opacity-40">데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : dataSource === "api" && visibleListings.length === 0 && !apiError ? (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Package size={36} className="opacity-10" />
                      <span className="text-[13px] font-medium opacity-30">이 조건의 입찰이 없습니다</span>
                    </div>
                  </td>
                </tr>
              ) : dataSource === "local" && localHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Package size={36} className="opacity-10" />
                      <span className="text-[13px] font-medium opacity-30">로컬 입찰 이력이 없습니다</span>
                    </div>
                  </td>
                </tr>
              ) : dataSource === "api" ? (
                visibleListings.map((item) => (
                  <ListingRow
                    key={item.sellerBiddingNo}
                    item={item}
                    skuStatus={skuStatusForIds(skuStatuses, ...listingStatusIds(item))}
                    isSelected={selectedIds.has(item.sellerBiddingNo)}
                    onSelect={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.has(item.sellerBiddingNo) ? next.delete(item.sellerBiddingNo) : next.add(item.sellerBiddingNo);
                        return next;
                      });
                    }}
                    editingPrice={editingPrice[item.sellerBiddingNo]}
                    onEditPrice={(val) => setEditingPrice((prev) => ({ ...prev, [item.sellerBiddingNo]: val }))}
                    onConfirmPrice={() => void handlePriceUpdate(item)}
                    onCancelEdit={() =>
                      setEditingPrice((prev) => {
                        const next = { ...prev };
                        delete next[item.sellerBiddingNo];
                        return next;
                      })
                    }
                    onCancelBid={() => void handleCancel(item.sellerBiddingNo)}
                    onAutoFollow={() => setFollowItem(item)}
                    onToggleStock={() =>
                      void handleToggleStock(listingStatusIds(item), item.skuId, item.spuId)
                    }
                    isSavingStock={savingStockIds.has(String(item.skuId))}
                    isCancelling={cancellingIds.has(item.sellerBiddingNo)}
                    isUpdating={updatingIds.has(item.sellerBiddingNo)}
                  />
                ))
              ) : (
                localHistory.map((item) => (
                  <LocalHistoryRow
                    key={item.id}
                    item={item}
                    skuStatus={skuStatusForIds(skuStatuses, item.sku_id)}
                    isSelected={selectedIds.has(item.seller_bidding_no || item.id)}
                    onSelect={() => {
                      const id = item.seller_bidding_no || item.id;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      });
                    }}
                    onCancelBid={() => item.seller_bidding_no && void handleCancel(item.seller_bidding_no)}
                    onToggleStock={() => void handleToggleStock([item.sku_id], item.sku_id)}
                    isSavingStock={savingStockIds.has(String(item.sku_id))}
                    isCancelling={cancellingIds.has(item.seller_bidding_no || "")}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {dataSource === "api" && (
          <div className="flex items-center justify-between p-3 border-t bg-secondary/5 text-[12px]">
            <span className="text-muted-foreground font-medium">커서 페이지 · 총건수는 API에 없음</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const prev = prevOffsets[prevOffsets.length - 1];
                  if (prev === undefined) return;
                  setPrevOffsets((stack) => stack.slice(0, -1));
                  setExclusiveStartOffsetId(prev);
                }}
                disabled={prevOffsets.length === 0}
                className="px-3 py-1 rounded border border-secondary hover:bg-secondary disabled:opacity-30 font-medium"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrevOffsets((stack) => [...stack, exclusiveStartOffsetId]);
                  setExclusiveStartOffsetId(lastOffsetId);
                }}
                disabled={!hasMore}
                className="px-3 py-1 rounded border border-secondary hover:bg-secondary disabled:opacity-30 font-medium"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {dataSource === "local" && localPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-secondary/5 text-[12px]">
            <span className="text-muted-foreground">{localTotal}건</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={localPage <= 1}
                onClick={() => setLocalPage((page) => Math.max(1, page - 1))}
                className="px-3 py-1 rounded border disabled:opacity-30"
              >
                이전
              </button>
              <button
                type="button"
                disabled={localPage >= localPages}
                onClick={() => setLocalPage((page) => page + 1)}
                className="px-3 py-1 rounded border disabled:opacity-30"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {followItem && (
        <AutoFollowDialog item={followItem} onClose={() => setFollowItem(null)} />
      )}

      {adjustOpen && (
        <PriceAdjustDialog
          items={editableSelected}
          onClose={() => setAdjustOpen(false)}
          onDone={() => {
            setAdjustOpen(false);
            setSelectedIds(new Set());
            void fetchListings();
          }}
        />
      )}
    </div>
  );
}

function MarketCell({
  exposed,
  minPrice,
  price,
}: {
  exposed: boolean;
  minPrice?: number;
  price: number;
}) {
  const missed = isLowestMissed(price, minPrice);
  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
          exposed
            ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/20"
            : "text-orange-700 bg-orange-500/10 border-orange-500/20"
        }`}
      >
        {exposed ? "노출" : "미노출"}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">
        {minPrice ? `최저 ${formatWonAmount(minPrice)}` : "최저 —"}
      </span>
      {missed && <span className="text-[9px] font-bold text-destructive">미달</span>}
    </div>
  );
}

function ListingStockCell({
  skuStatus,
  onToggle,
  isSaving,
}: {
  skuStatus?: SkuStatus;
  onToggle: () => void;
  isSaving: boolean;
}) {
  const stockMarked = !!skuStatus?.stockMarked;
  const stockDate = skuStatus?.stockMarkedDate ?? "—";
  return (
    <td className="px-2 text-center border-r border-secondary/10">
      <button
        type="button"
        onClick={onToggle}
        disabled={isSaving}
        title={stockMarked ? `재고 보유 표기 · ${stockDate} · 클릭하여 해제` : "재고 보유로 표기"}
        className={`inline-flex flex-col items-center justify-center gap-0.5 min-w-[52px] py-0.5 rounded-md disabled:opacity-40 ${
          stockMarked ? "hover:bg-emerald-500/10" : "hover:bg-secondary"
        }`}
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : stockMarked ? (
          <>
            <StockStatusIndicator date={stockDate} variant="badge" />
            <span className="text-[9px] text-emerald-700 font-semibold">{stockDate}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/55 font-medium">미보유</span>
        )}
      </button>
    </td>
  );
}

function ListingRow({
  item,
  skuStatus,
  isSelected,
  onSelect,
  editingPrice,
  onEditPrice,
  onConfirmPrice,
  onCancelEdit,
  onCancelBid,
  onAutoFollow,
  onToggleStock,
  isSavingStock,
  isCancelling,
  isUpdating,
}: {
  item: ListingItem;
  skuStatus?: SkuStatus;
  isSelected: boolean;
  onSelect: () => void;
  editingPrice?: string;
  onEditPrice: (val: string) => void;
  onConfirmPrice: () => void;
  onCancelEdit: () => void;
  onCancelBid: () => void;
  onAutoFollow: () => void;
  onToggleStock: () => void;
  isSavingStock: boolean;
  isCancelling: boolean;
  isUpdating: boolean;
}) {
  const isEditing = editingPrice !== undefined;
  const statusInfo = listingStatusMeta(item.tradeStatus);
  const editable = canEditListing(item.tradeStatus);
  const stockMarked = !!skuStatus?.stockMarked;

  return (
    <tr className={`hover:bg-secondary/5 transition-colors h-16 ${stockMarked ? "bg-emerald-500/[0.08]" : ""}`}>
      <td
        className={`px-2 text-center border-r border-secondary/10 ${
          stockMarked ? "border-l-[3px] border-l-solid border-l-emerald-500" : ""
        }`}
      >
        <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5" />
      </td>
      <ListingStockCell skuStatus={skuStatus} onToggle={onToggleStock} isSaving={isSavingStock} />
      <td className="px-4 border-r border-secondary/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-white border border-secondary/20 p-1 shrink-0 overflow-hidden">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="w-full h-full object-contain" />
            ) : (
              <Package size={16} className="m-auto text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-bold text-[12px] text-foreground/80 truncate">{item.productName || "—"}</span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
              {item.articleNumber ? <CopyableArticleNumber articleNumber={item.articleNumber} /> : null}
              {item.sizeInfo && <span className="font-bold">{item.sizeInfo}</span>}
            </div>
            <span className="text-[9px] text-muted-foreground/40 font-mono">
              SKU {item.skuId || "—"} · {item.sellerBiddingNo}
            </span>
          </div>
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 font-bold text-foreground/50 text-[12px]">
        {item.onSaleQuantity}/{item.quantity}
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        {isEditing ? (
          <div className="flex items-center gap-1 justify-center">
            <input
              type="text"
              value={editingPrice}
              onChange={(e) => onEditPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirmPrice()}
              className="w-24 text-[11px] py-1 px-2 bg-background border border-primary/30 rounded text-right font-mono font-bold outline-none"
              autoFocus
            />
            <button type="button" onClick={onConfirmPrice} disabled={isUpdating} className="p-0.5 text-emerald-600 hover:bg-emerald-500/10 rounded">
              {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button type="button" onClick={onCancelEdit} className="p-0.5 text-muted-foreground hover:bg-secondary rounded">
              <X size={12} />
            </button>
          </div>
        ) : (
          <span className="font-bold text-[13px] text-foreground/70">{formatWonAmount(item.price)}</span>
        )}
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
          {item.isWeakIntercept && <span className="text-[9px] text-destructive font-bold">미통과</span>}
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <MarketCell exposed={item.cnExposed} minPrice={item.cnMinPrice} price={item.price} />
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <MarketCell exposed={item.krExposed} minPrice={item.krMinPrice} price={item.price} />
      </td>
      <td className="px-2 text-center">
        {editable ? (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onEditPrice(String(item.price))}
              className="text-[10px] px-2 py-1 border border-primary/20 text-primary rounded hover:bg-primary/5 font-bold"
            >
              <Pencil size={10} className="inline mr-0.5" />
              수정
            </button>
            <button
              type="button"
              onClick={onAutoFollow}
              className="text-[10px] px-2 py-1 border border-secondary text-foreground/80 rounded hover:bg-secondary font-bold"
            >
              <Bot size={10} className="inline mr-0.5" />
              추종
            </button>
            <button
              type="button"
              onClick={onCancelBid}
              disabled={isCancelling}
              className="text-[10px] px-2 py-1 border border-destructive/20 text-destructive rounded hover:bg-destructive/5 font-bold disabled:opacity-30"
            >
              {isCancelling ? <Loader2 size={10} className="animate-spin inline" /> : <Trash2 size={10} className="inline mr-0.5" />}
              취소
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </td>
    </tr>
  );
}

function LocalHistoryRow({
  item,
  skuStatus,
  isSelected,
  onSelect,
  onCancelBid,
  onToggleStock,
  isSavingStock,
  isCancelling,
}: {
  item: BidHistoryItem;
  skuStatus?: SkuStatus;
  isSelected: boolean;
  onSelect: () => void;
  onCancelBid: () => void;
  onToggleStock: () => void;
  isSavingStock: boolean;
  isCancelling: boolean;
}) {
  const statusInfo = LOCAL_STATUS_LABEL[item.status] || LOCAL_STATUS_LABEL.active;
  const createdDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const stockMarked = !!skuStatus?.stockMarked;

  return (
    <tr className={`hover:bg-secondary/5 transition-colors h-14 ${stockMarked ? "bg-emerald-500/[0.08]" : ""}`}>
      <td
        className={`px-2 text-center border-r border-secondary/10 ${
          stockMarked ? "border-l-[3px] border-l-solid border-l-emerald-500" : ""
        }`}
      >
        <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5" />
      </td>
      <ListingStockCell skuStatus={skuStatus} onToggle={onToggleStock} isSaving={isSavingStock} />
      <td className="px-4 border-r border-secondary/10">
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="font-bold text-[12px] text-foreground/70 truncate">{item.product_name || "—"}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span className="font-mono">{item.article_number}</span>
            {item.size_info && <span className="font-bold">{item.size_info}</span>}
          </div>
          <span className="text-[9px] text-muted-foreground/30 font-mono">SKU {item.sku_id} · {createdDate}</span>
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">1</td>
      <td className="px-2 text-center border-r border-secondary/10">
        <span className="font-bold text-[13px] text-foreground/70">{formatWonAmount(item.bid_price)}</span>
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-muted-foreground/30">—</td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-muted-foreground/30">—</td>
      <td className="px-2 text-center">
        {item.seller_bidding_no && item.status === "active" && (
          <button
            type="button"
            onClick={onCancelBid}
            disabled={isCancelling}
            className="text-[10px] px-2 py-1 border border-destructive/20 text-destructive rounded hover:bg-destructive/5 font-bold disabled:opacity-30"
          >
            {isCancelling ? <Loader2 size={10} className="animate-spin inline" /> : "취소"}
          </button>
        )}
      </td>
    </tr>
  );
}

function PriceAdjustDialog({
  items,
  onClose,
  onDone,
}: {
  items: ListingItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<PriceAdjustMode>("delta");
  const [value, setValue] = useState("-1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(value.replace(/,/g, ""));
  const preview = items.slice(0, 5).map((item) => ({
    name: item.productName || item.sellerBiddingNo,
    from: item.price,
    to: computeAdjustedPrice(item.price, mode, numeric),
  }));

  const submit = async () => {
    if (!Number.isFinite(numeric)) {
      setError("숫자를 입력해 주세요.");
      return;
    }
    const payload = items.map((item) => ({
      sellerBiddingNo: item.sellerBiddingNo,
      skuId: item.skuId,
      spuId: item.spuId,
      quantity: item.quantity,
      tradeStatus: item.tradeStatus,
      newPrice: computeAdjustedPrice(item.price, mode, numeric),
    }));
    if (payload.some((row) => row.newPrice <= 0)) {
      setError("조정 후 가격이 1원 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updateSelectedListingPrices(payload);
    setBusy(false);
    if (result.success) onDone();
    else setError(result.error || "가격 조정에 실패했습니다.");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">가격 조정</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">선택된 {items.length}건에 동일 규칙을 적용합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["delta", "증감액"],
              ["percent", "증감%"],
              ["set", "절대가"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex-1 h-8 text-[12px] rounded-lg border font-medium ${
                mode === key ? "bg-primary text-primary-foreground border-primary" : "border-secondary hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-[12px] font-medium space-y-1">
          {mode === "set" ? "새 가격" : mode === "percent" ? "증감 % (예: -5)" : "증감 금액 (예: -1000)"}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px] font-mono"
          />
        </label>
        <ul className="text-[11px] space-y-1 max-h-32 overflow-auto">
          {preview.map((row) => (
            <li key={row.name} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{row.name}</span>
              <span className="font-mono shrink-0">
                {formatWonAmount(row.from)} → {formatWonAmount(row.to)}
              </span>
            </li>
          ))}
          {items.length > preview.length && (
            <li className="text-muted-foreground">외 {items.length - preview.length}건</li>
          )}
        </ul>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 h-8 text-[12px] rounded-lg hover:bg-secondary">
            닫기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="px-3 h-8 text-[12px] font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
          >
            {busy ? "적용 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoFollowDialog({ item, onClose }: { item: ListingItem; onClose: () => void }) {
  const [lowestPrice, setLowestPrice] = useState(String(item.cnMinPrice || item.price));
  const [followType, setFollowType] = useState(3);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const price = Number(String(lowestPrice).replace(/[^0-9]/g, ""));
    setBusy(true);
    setError(null);
    const result = await submitAutoFollow({
      sellerBiddingNo: item.sellerBiddingNo,
      lowestPrice: price,
      followType,
      autoSwitch,
    });
    setBusy(false);
    if (result.success) setDone(true);
    else setError(result.error || "등록에 실패했습니다.");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">자동 재입찰</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {item.productName || item.sellerBiddingNo} · 플랫폼이 최저가까지 가격을 맞춥니다
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <label className="block text-[12px] font-medium space-y-1">
          최저가 (이보다 낮게는 내리지 않음)
          <input
            value={lowestPrice}
            onChange={(e) => setLowestPrice(e.target.value)}
            className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px] font-mono"
          />
        </label>
        <label className="block text-[12px] font-medium space-y-1">
          추종 방식
          <select
            value={followType}
            onChange={(e) => setFollowType(Number(e.target.value))}
            className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px]"
          >
            {FOLLOW_TYPES.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label} ({row.value})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[12px] font-medium">
          <input type="checkbox" checked={autoSwitch} onChange={(e) => setAutoSwitch(e.target.checked)} />
          자동 전환 유지
        </label>
        {done && <p className="text-[12px] text-emerald-700">등록했습니다. 이후 가격은 플랫폼이 조정합니다.</p>}
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 h-8 text-[12px] rounded-lg hover:bg-secondary">
            닫기
          </button>
          <button
            type="button"
            disabled={busy || done}
            onClick={() => void submit()}
            className="px-3 h-8 text-[12px] font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

