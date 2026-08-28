"use client";

import React from "react";
import type { ItemStatus } from "@/app/actions/item-status";
import type { SortKey } from "@/lib/search/column-layout";
import type { SourceOffer } from "@/types/source-offer";
import type { SkuStatus } from "@/types/sku-status";
import type { SystemSettings } from "@/lib/utils/calculate-margin";
import type { SkuActivity } from "@/lib/utils/sku-activity";
import type { BidDisplaySource, BidStatusInfo } from "./bid-status-indicator";
import type { WorkspaceView } from "./dashboard-view-tabs";
import type { ReviewCheckState } from "./review-check-button";

export type SkuMemoEditorState = { skuId: string; spuId?: string; value: string };
export type SpuMemoEditorState = { spuId: string; value: string };

export interface SkuBidViews {
  systemBid: BidStatusInfo | null;
  manualBid: BidStatusInfo | null;
  manualMarked: boolean;
  hasAnyBid: boolean;
}

export interface SpuBidSummaryData {
  bidCount: number;
  systemCount: number;
  manualCount: number;
  totalCount: number;
  bids: Array<{ sizeInfo?: string; price?: number; date: string; source: BidDisplaySource }>;
}

export interface SpuReviewSummary {
  childSkuIds: string[];
  spuKey: string;
  handledCount: number;
  totalCount: number;
  allHandled: boolean;
  someHandled: boolean;
  reviewState: ReviewCheckState;
}

export interface SearchBoardTableContextValue {
  columnWidths: Record<string, number>;
  resizing: string | null;
  sortConfig: { key: SortKey; dir: "asc" | "desc" } | null;
  workspaceView: WorkspaceView;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  toggleSelectAllVisible: () => void;
  handleResizeStart: (e: React.MouseEvent, column: string) => void;
  resetColumnWidth: (column: string) => void;
  toggleSort: (key: SortKey) => void;

  selectedSkus: Record<string, boolean>;
  skuStatuses: Record<string, SkuStatus>;
  itemStatuses: Record<string, ItemStatus>;
  skippedSkuIds: Set<string>;
  skuRecommendations: Record<string, any>;
  loadingRecommendations: Record<string, boolean>;
  biddingPrices: Record<string, string>;
  sourceOffers: Record<string, SourceOffer[]>;
  loadingSourceOffers: Record<string, boolean>;
  systemSettings: SystemSettings | null;
  isBidding: boolean;
  expandedRows: Record<string, boolean>;
  skuMemoEditor: SkuMemoEditorState | null;
  memoEditor: SpuMemoEditorState | null;
  savingManualBid: Record<string, boolean>;
  savingStockMarked: Record<string, boolean>;
  savingWatch: Record<string, boolean>;
  savingSkuMemo: Record<string, boolean>;

  getSkuBidViews: (skuId: string, skuStatus?: SkuStatus) => SkuBidViews;
  getSpuBidSummary: (item: any) => SpuBidSummaryData;
  getSpuReviewSummary: (item: any) => SpuReviewSummary;
  resolveSkuActivity: (skuId: string, skuStatus?: SkuStatus) => SkuActivity | null;

  toggleSkuSelection: (skuId: string) => void;
  handleToggleSkuManualBid: (skuId: string, spuId?: string) => void;
  handleToggleSkuStockMarked: (skuId: string, spuId?: string) => void;
  handleToggleSkuWatch: (skuId: string, spuId?: string, skuPrice?: string | number) => void;
  toggleSkuHandled: (skuId: string, spuId: string, childSkuIds: string[], item?: any) => void;
  handleToggleSkip: (itemOrSku: any, isSku?: boolean) => void;
  handleSaveSkuMemo: (skuId: string, spuId?: string) => void;
  handleBiddingPriceChange: (skuId: string, value: string) => void;
  /** 타이핑 전용. 보드 전체를 다시 그리지 않고 ref만 갱신한다. */
  handleBiddingPriceInput: (skuId: string, value: string) => void;
  handleSingleBid: (skuId: string | number, spuId: string | number) => void;
  openSourceOfferModal: (articleNumber: string) => void;
  setSkuMemoEditor: React.Dispatch<React.SetStateAction<SkuMemoEditorState | null>>;
  setMemoEditor: React.Dispatch<React.SetStateAction<SpuMemoEditorState | null>>;
  handleSaveMemo: (item: any) => void;
  toggleItemHandled: (item: any) => void;
  setManySelected: (skuIds: string[], value: boolean) => void;
  toggleRow: (id: string, skus?: any[]) => void;
  removeItem: (item: { id?: string | number; articleNumber?: string }) => void;
  openExclude: (item: { articleNumber: string; title: string }) => void;
}

const SearchBoardTableContext = React.createContext<SearchBoardTableContextValue | null>(null);

/** 핸들러 본문은 최신 ref를 읽고, 반환 객체 참조는 고정한다. */
export function useStableCallbacks<T extends Record<string, (...args: never[]) => unknown>>(
  callbacks: T
): T {
  const ref = React.useRef(callbacks);
  ref.current = callbacks;
  return React.useMemo(() => {
    const stable = {} as T;
    for (const key of Object.keys(callbacks) as Array<keyof T>) {
      stable[key] = ((...args: never[]) => ref.current[key](...args)) as T[keyof T];
    }
    return stable;
    // 키 구성은 마운트 시 고정. 본문은 매 렌더 ref에 갱신한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function SearchBoardTableProvider({
  value,
  children,
}: {
  value: SearchBoardTableContextValue;
  children: React.ReactNode;
}) {
  return <SearchBoardTableContext.Provider value={value}>{children}</SearchBoardTableContext.Provider>;
}

export function useSearchBoardTable() {
  const ctx = React.useContext(SearchBoardTableContext);
  if (!ctx) throw new Error("useSearchBoardTable must be used within SearchBoardTableProvider");
  return ctx;
}
