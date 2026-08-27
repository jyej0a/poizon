"use client";

import {
  AlertCircle,
  Bell,
  ChevronLeft,
  CircleStop,
  Clock,
  Gavel,
  Inbox,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DashboardViewTabs,
  DisplayFilterSelect,
  type DisplayFilter,
  type WorkspaceView,
} from "./dashboard-view-tabs";
import { CONTROL_PRESS } from "@/lib/utils/motion";
import {
  clearSearchHistory,
  removeSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/search/search-history";
import type { SearchBoardVariant } from "@/hooks/use-poizon-search";

export const toolbarBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-[color,background-color,transform] motion-safe:active:scale-[0.98]";
export const toolbarBtnOutline = `${toolbarBtn} border border-border bg-background hover:bg-secondary/60 text-foreground`;
export const toolbarBtnGhost = `${toolbarBtn} border border-transparent hover:bg-secondary/60 text-muted-foreground`;

export interface SearchBoardToolbarProps {
  variant?: SearchBoardVariant;
  searchType: "article" | "brand";
  onSearchTypeChange: (type: "article" | "brand") => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  isInputFocused: boolean;
  onInputFocusChange: (focused: boolean) => void;
  searchHistory: SearchHistoryEntry[];
  onSearchHistoryChange: (entries: SearchHistoryEntry[]) => void;
  isLoading: boolean;
  isEnqueuing: boolean;
  onSearch: () => void;
  onHistorySearch: (entry: SearchHistoryEntry) => void;
  onBackgroundSearch: () => void;
  onStopSearch?: () => void;
  canStopSearch?: boolean;
  jobKeyword?: string;
  error: string | null;
  workspaceView: WorkspaceView;
  onWorkspaceViewChange: (view: WorkspaceView) => void;
  displayFilter: DisplayFilter;
  onDisplayFilterChange: (value: DisplayFilter) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  resultCount: number;
  highProfitCount: number;
  onHighProfitFocus: () => void;
  watchHitCount: number;
  watchFocus: boolean;
  onWatchFocus: () => void;
  hasVisibleRows: boolean;
  selectedSkuCount: number;
  isBidding: boolean;
  onBatchBid: () => void;
  onRefreshSelectedPrices: () => void;
  isRefreshingPrices: boolean;
  onMergeActedItems: () => void;
  overflowOpen: boolean;
  onOverflowOpenChange: (open: boolean) => void;
  excludeSkippedOnSearch: boolean;
  onExcludeSkippedChange: (value: boolean) => void;
  excludeReviewedOnSearch: boolean;
  onExcludeReviewedChange: (value: boolean) => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  onOpenMarginSettings: () => void;
  onResetColumnWidths: () => void;
  canClearList: boolean;
  onClearList: () => void;
}

export function SearchBoardToolbar(props: SearchBoardToolbarProps) {
  const {
    variant = "live",
    searchType,
    onSearchTypeChange,
    keyword,
    onKeywordChange,
    isInputFocused,
    onInputFocusChange,
    searchHistory,
    onSearchHistoryChange,
    isLoading,
    isEnqueuing,
    onSearch,
    onHistorySearch,
    onBackgroundSearch,
    onStopSearch,
    canStopSearch = false,
    jobKeyword,
    error,
    workspaceView,
    onWorkspaceViewChange,
    displayFilter,
    onDisplayFilterChange,
    selectedCategory,
    onCategoryChange,
    categories,
    resultCount,
    highProfitCount,
    onHighProfitFocus,
    watchHitCount,
    watchFocus,
    onWatchFocus,
    hasVisibleRows,
    selectedSkuCount,
    isBidding,
    onBatchBid,
    onRefreshSelectedPrices,
    isRefreshingPrices,
    onMergeActedItems,
    overflowOpen,
    onOverflowOpenChange,
    excludeSkippedOnSearch,
    onExcludeSkippedChange,
    excludeReviewedOnSearch,
    onExcludeReviewedChange,
    pageSize,
    onPageSizeChange,
    onOpenMarginSettings,
    onResetColumnWidths,
    canClearList,
    onClearList,
  } = props;

  return (
    <div
      className={`relative z-30 shrink-0 px-4 py-3 border-b border-border/40 transition-colors backdrop-blur-md ${
        isInputFocused ? "bg-primary/[0.06]" : "bg-background/45"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
          {variant === "job" ? "Job" : "Search"}
        </span>
        {variant === "job" ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/dashboard/jobs"
              className={`${toolbarBtnOutline} shrink-0`}
            >
              <ChevronLeft size={13} />
              목록으로
            </Link>
            <p className="min-w-0 truncate text-xs text-foreground">
              <span className="font-semibold">검색 작업 결과</span>
              {jobKeyword ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {searchType === "brand" ? "브랜드" : "품번"} {jobKeyword}
                </span>
              ) : null}
            </p>
            {isLoading && <Loader2 size={13} className="animate-spin text-primary shrink-0" />}
            {error && (
              <div className="hidden lg:flex items-center gap-1.5 text-destructive font-medium text-xs truncate">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex bg-secondary/40 p-0.5 rounded-lg shrink-0 h-8">
            <button
              type="button"
              onClick={() => onSearchTypeChange("article")}
              className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${CONTROL_PRESS} ${
                searchType === "article"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              품번
            </button>
            <button
              type="button"
              onClick={() => onSearchTypeChange("brand")}
              className={`px-2.5 h-full text-xs font-medium rounded-md transition-all ${CONTROL_PRESS} ${
                searchType === "brand"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              브랜드
            </button>
          </div>
          <div
            className={`relative h-8 transition-all duration-300 ease-out ${
              isInputFocused ? "w-72 md:w-96" : "w-48 md:w-56"
            }`}
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              onFocus={() => onInputFocusChange(true)}
              onBlur={() => onInputFocusChange(false)}
              placeholder={
                searchType === "article"
                  ? "품번 (콤마 구분) 입력 후 조회"
                  : "브랜드명 입력 후 조회"
              }
              className="w-full h-8 pl-8 pr-3 bg-background border border-border/60 rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-shadow"
              aria-label="검색어"
            />
            {isInputFocused && searchHistory.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-50 glass-panel border border-border/60 rounded-lg overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/30">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Clock size={11} /> 최근 검색
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("최근 검색 기록을 모두 삭제할까요?")) return;
                      onSearchHistoryChange(clearSearchHistory());
                    }}
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
                          type="button"
                          onClick={() => onHistorySearch(entry)}
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
                          type="button"
                          onClick={() =>
                            onSearchHistoryChange(removeSearchHistory(entry.keyword, entry.type))
                          }
                          className="shrink-0 p-0.5 rounded text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="이 기록 삭제"
                          aria-label="이 기록 삭제"
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
          <button
            type="button"
            onClick={onSearch}
            disabled={isLoading || !keyword.trim()}
            className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0`}
          >
            {isLoading && canStopSearch ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            조회
          </button>
          <button
            type="button"
            onClick={onStopSearch}
            disabled={!canStopSearch}
            title="진행 중인 조회만 멈춥니다. 이미 모인 목록은 유지됩니다. 검색 화면을 나가도 조회는 중단됩니다."
            aria-label="조회 중단"
            className={`${toolbarBtn} border border-border/60 bg-background hover:bg-secondary/60 disabled:opacity-40 shrink-0`}
          >
            <CircleStop size={13} />
            중단
          </button>
          <button
            type="button"
            onClick={onBackgroundSearch}
            disabled={isEnqueuing || !keyword.trim()}
            title="서버에서 검색을 진행합니다. 창을 닫아도 계속되며 '검색 작업'에서 결과를 확인합니다."
            className={`${toolbarBtn} border border-border/60 bg-background hover:bg-secondary/60 disabled:opacity-40 shrink-0`}
          >
            {isEnqueuing ? <Loader2 size={13} className="animate-spin" /> : <Inbox size={13} />}
            백그라운드
          </button>
          {error && (
            <div className="hidden lg:flex items-center gap-1.5 text-destructive font-medium text-xs truncate">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
            View
          </span>
          <DashboardViewTabs view={workspaceView} onViewChange={onWorkspaceViewChange} />
          <DisplayFilterSelect value={displayFilter} onChange={onDisplayFilterChange} />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              분류
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className={`${toolbarBtnOutline} h-8 min-w-[72px] cursor-pointer`}
              aria-label="분류"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
            {resultCount} 건
          </span>
          {highProfitCount > 0 && (
            <button
              type="button"
              onClick={onHighProfitFocus}
              className={`inline-flex items-center gap-1 text-xs bg-violet-500/15 text-violet-700 px-2 py-0.5 rounded-full font-semibold shrink-0 hover:bg-violet-500/25 transition-colors ${CONTROL_PRESS}`}
              title="수익 옵션 뷰에서 순수익 높은 순으로 봅니다"
              aria-label={`효자 상품 ${highProfitCount}건, 수익 옵션 높은 순으로 보기`}
            >
              <Sparkles size={12} aria-hidden />
              효자 {highProfitCount}
            </button>
          )}
          {(watchHitCount > 0 || watchFocus) && (
            <button
              type="button"
              onClick={onWatchFocus}
              className={`inline-flex items-center gap-1 text-xs bg-cyan-500/15 text-cyan-800 px-2 py-0.5 rounded-full font-semibold shrink-0 hover:bg-cyan-500/25 transition-colors ${CONTROL_PRESS} ${
                watchFocus ? "ring-1 ring-cyan-700" : ""
              }`}
              title={
                watchFocus
                  ? "가격 알림 도달만 보는 필터를 해제합니다"
                  : "옵션 뷰에서 가격 알림 도달 건만 봅니다"
              }
              aria-label={
                watchFocus
                  ? `가격 알림 도달 ${watchHitCount}건, 필터 해제`
                  : `가격 알림 도달 ${watchHitCount}건, 옵션 뷰에서 도달 건만 보기`
              }
              aria-pressed={watchFocus}
            >
              <Bell size={12} aria-hidden />
              알림 {watchHitCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefreshSelectedPrices}
            disabled={!hasVisibleRows || selectedSkuCount === 0 || isRefreshingPrices || isLoading}
            className={`${toolbarBtnOutline} disabled:opacity-30`}
            title="체크한 품번의 중국 노출가와 외부 원가만 다시 가져옵니다"
          >
            {isRefreshingPrices ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            선택 가격 갱신
          </button>
          <button
            type="button"
            onClick={onMergeActedItems}
            disabled={isLoading || isEnqueuing}
            className={`${toolbarBtnOutline} disabled:opacity-30`}
            title="같은 검색어로 과거에 손댄 품번을 현재 목록에 합칩니다"
          >
            손댄 품번 합치기
          </button>
          <button
            type="button"
            onClick={onBatchBid}
            disabled={!hasVisibleRows || selectedSkuCount === 0 || isBidding}
            className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30`}
          >
            <Gavel size={13} /> 일괄 입찰
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => onOverflowOpenChange(!overflowOpen)}
              className={toolbarBtnGhost}
              aria-label="더보기 메뉴"
              aria-expanded={overflowOpen}
            >
              <MoreHorizontal size={14} />
              <span className="hidden md:inline">더보기</span>
            </button>
            {overflowOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="메뉴 닫기"
                  onClick={() => onOverflowOpenChange(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-border/60 glass-panel py-1 text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    검색 옵션
                  </div>
                  <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={excludeSkippedOnSearch}
                      onCheckedChange={(checked) => onExcludeSkippedChange(checked === true)}
                      className="h-3.5 w-3.5"
                    />
                    스킵 제외 (검색 시)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={excludeReviewedOnSearch}
                      onCheckedChange={(checked) => onExcludeReviewedChange(checked === true)}
                      className="h-3.5 w-3.5"
                    />
                    검토완료 제외 (검색 시)
                  </label>
                  <div className="my-1 border-t border-border/40" />
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="text-muted-foreground">조회수</span>
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="bg-transparent font-semibold outline-none cursor-pointer"
                      aria-label="조회수"
                    >
                      <option value={50}>50개</option>
                      <option value={100}>100개</option>
                      <option value={200}>200개</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMarginSettings();
                      onOverflowOpenChange(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left"
                  >
                    <Settings2 size={13} /> 마진 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResetColumnWidths();
                      onOverflowOpenChange(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left"
                  >
                    <RotateCcw size={13} /> 너비 초기화
                  </button>
                  <button
                    type="button"
                    disabled={!canClearList}
                    onClick={onClearList}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left text-destructive disabled:opacity-30"
                  >
                    <Trash2 size={13} /> 목록 비우기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
