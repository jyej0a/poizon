"use client";

import { memo } from "react";
import { CheckCircle2, ChevronRight, CircleDot, EyeOff, ImageIcon } from "lucide-react";
import { getChildSkuIds } from "@/lib/search/search-item";
import { skuListPrice } from "@/lib/search/sku-display";
import { calculateMargin } from "@/lib/utils/calculate-margin";
import { formatActivityLine, getSpuLastActivity } from "@/lib/utils/sku-activity";
import { getSpuRowVisualState, searchBoardCellClass, SEARCH_BOARD_TD_HOVER } from "@/lib/utils/sku-row-visual";
import { cn } from "@/lib/utils";
import { ICON_PRESS } from "@/lib/utils/motion";
import { isHighProfit } from "@/lib/utils/high-profit";
import { getBestSourceOffer, getBestSourceOfferPrice } from "@/lib/sourcing/source-offer-view";
import { CopyableArticleNumber } from "./copyable-article-number";
import { SearchBoardIndexCell } from "./search-board-index-cell";
import { ProfitStack } from "./profit-stack";
import { RowMemoPopover } from "./row-memo-popover";
import { SearchBoardSkuRow } from "./search-board-sku-row";
import { SpuBidSummary } from "./bid-status-indicator";
import { SpuRowManageCell } from "./spu-row-manage-cell";
import { SourceOfferPriceCell } from "./source-offer-price-cell";
import { MetricLine, StackedMetricCell } from "./stacked-metric-cell";
import { SpuExposureHint } from "./exposure-price-hint";
import { useSearchBoardTable } from "./search-board-table-context";

interface SearchBoardSpuRowProps {
  item: any;
  articleIndex: number;
}

export const SearchBoardSpuRow = memo(function SearchBoardSpuRow({ item, articleIndex }: SearchBoardSpuRowProps) {
  const ctx = useSearchBoardTable();
  const isBiddable = item.raw?.userCanBidding !== false;
  const isExpanded = !!ctx.expandedRows[item.id];
  const childSkuIds = getChildSkuIds(item);
  const allSkusSkipped =
    childSkuIds.length > 0 && childSkuIds.every((id: string) => ctx.skippedSkuIds.has(id));
  const selectedChildCount = childSkuIds.filter((id: string) => ctx.selectedSkus[id]).length;
  const allChildSelected = childSkuIds.length > 0 && selectedChildCount === childSkuIds.length;
  const someChildSelected = selectedChildCount > 0 && !allChildSelected;

  const spuKey = String(item.id).replace(/[^0-9]/g, "");
  const status = ctx.itemStatuses[spuKey];
  const hasMemo = !!status?.memo;
  const spuBidSummary = ctx.getSpuBidSummary(item);
  const reviewSummary = ctx.getSpuReviewSummary(item);
  const { allHandled, someHandled, reviewState, handledCount, totalCount } = reviewSummary;
  const spuVisual = getSpuRowVisualState({
    hasAnyBid: spuBidSummary.bidCount > 0,
    allSkusSkipped,
    allHandled,
    someHandled,
  });
  const spuActivityLine = formatActivityLine(
    getSpuLastActivity(
      childSkuIds.map((id) => ctx.resolveSkuActivity(id, ctx.skuStatuses[id])),
      status?.updatedAt,
      status?.handled
    )
  );

  const naverPrice = getBestSourceOfferPrice(ctx.sourceOffers, item.articleNumber);
  let spuProfit: { profit: number; fee: number } | null = null;
  if (naverPrice && item.minPrice !== "—" && ctx.systemSettings) {
    const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
    if (!isNaN(poizonPriceNum) && poizonPriceNum > 0) {
      const { fee } = calculateMargin(poizonPriceNum, ctx.systemSettings);
      spuProfit = { fee, profit: poizonPriceNum - fee - Number(naverPrice) };
    }
  }
  const spuHighProfit = isHighProfit(spuProfit?.profit, ctx.systemSettings);

  const cell = cn(searchBoardCellClass(), spuVisual.fillClass);

  return (
    <>
      <tr
        data-spu-row={item.id}
        className={cn(
          "group h-14",
          item.skuDetails?.length > 0 && "cursor-pointer",
          isExpanded && "border-b-2 border-b-border/50",
          spuVisual.fade && "opacity-40 grayscale-[0.5]"
        )}
        onClick={() => {
          if (item.skuDetails?.length > 0) ctx.toggleRow(item.id, item.skuDetails);
        }}
      >
        <SearchBoardIndexCell index={articleIndex} className={cell} accentClass={spuVisual.accentClass} />
        <td className={cn(cell, "relative")} onClick={(e) => e.stopPropagation()}>
          <SpuRowManageCell
            allChildSelected={allChildSelected}
            someChildSelected={someChildSelected}
            onSelectToggle={() => ctx.setManySelected(childSkuIds, !allChildSelected)}
            reviewState={reviewState}
            partialLabel={someHandled ? `${handledCount}/${totalCount}` : undefined}
            onReviewToggle={() => ctx.toggleItemHandled(item)}
            hasMemo={hasMemo}
            memoTitle={hasMemo ? `메모: ${status?.memo}` : "메모 추가"}
            onMemoClick={() =>
              ctx.setMemoEditor(
                ctx.memoEditor?.spuId === spuKey ? null : { spuId: spuKey, value: status?.memo ?? "" }
              )
            }
            allSkusSkipped={allSkusSkipped}
            childCount={childSkuIds.length}
            onSkipToggle={() => {
              void ctx.handleToggleSkip(item, false);
            }}
            onExclude={() =>
              ctx.openExclude({ articleNumber: item.articleNumber, title: item.title })
            }
            onRemove={() => ctx.removeItem(item)}
          />
          {ctx.memoEditor?.spuId === spuKey && (
            <RowMemoPopover
              title="메모"
              value={ctx.memoEditor.value}
              placeholder="이 품번에 대한 메모 (예: 가격 추적, 재입고 대기 등)"
              onChange={(value) => ctx.setMemoEditor({ spuId: spuKey, value })}
              onClose={() => ctx.setMemoEditor(null)}
              onSave={() => ctx.handleSaveMemo(item)}
            />
          )}
        </td>
        <td className={cn(cell, "px-2 overflow-hidden")}>
          <div className="flex items-center gap-3">
            {item.skuDetails?.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.toggleRow(item.id, item.skuDetails);
                }}
                className={cn(
                  "shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors",
                  ICON_PRESS
                )}
                title={isExpanded ? "옵션 접기" : "옵션 펼치기"}
                aria-label={isExpanded ? "옵션 접기" : "옵션 펼치기"}
                aria-expanded={isExpanded}
              >
                <ChevronRight
                  size={14}
                  className={cn(
                    "motion-safe:transition-transform motion-safe:duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>
            ) : (
              <div className="w-7 h-7 shrink-0" />
            )}
            <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
              {item.image ? (
                <img src={item.image} className="w-full h-full object-contain" alt="" />
              ) : (
                <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />
              )}
              <div
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  isBiddable ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-gray-400"
                }`}
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">
                  {item.brand}
                </span>
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
                {allSkusSkipped && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-700 border border-slate-500/30 font-bold shrink-0 flex items-center gap-0.5">
                    <EyeOff size={9} /> 스킵
                  </span>
                )}
                {allHandled && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold shrink-0 flex items-center gap-0.5">
                    <CheckCircle2 size={9} /> 검토완료
                  </span>
                )}
                {someHandled && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 font-bold shrink-0 flex items-center gap-0.5">
                    <CircleDot size={9} /> 검토 {handledCount}/{totalCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                <CopyableArticleNumber articleNumber={item.articleNumber} />
                <span className="opacity-30">|</span>
                <span>{item.category}</span>
                {isBiddable && (
                  <span className="ml-1 bg-emerald-500/10 text-emerald-600 text-[8px] px-1 py-0.5 rounded border border-emerald-500/20 font-bold">
                    입찰 가능
                  </span>
                )}
              </div>
              {spuActivityLine && (
                <span className="text-[9px] text-muted-foreground/70 font-medium normal-case tracking-normal">
                  {spuActivityLine}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className={cell}>
          <StackedMetricCell
            ariaLabel={`30일 거래가 ${item.avgPrice}, 중국 노출가 ${item.minPrice}`}
          >
            <MetricLine label="거래" className="font-bold text-[11px] text-foreground/80">
              {item.avgPrice}
            </MetricLine>
            <SpuExposureHint displayValue={String(item.minPrice ?? "—")}>
              <MetricLine
                label="노출"
                className="font-bold text-[11px] text-orange-600/80 italic cursor-help"
              >
                {item.minPrice}
              </MetricLine>
            </SpuExposureHint>
          </StackedMetricCell>
        </td>
        <td className={cn(cell, "font-bold text-emerald-600")}>
          <div className="flex flex-col items-center justify-center -space-y-0.5">
            <SourceOfferPriceCell
              item={getBestSourceOffer(ctx.sourceOffers, item.articleNumber)}
              loading={!!ctx.loadingSourceOffers[item.articleNumber]}
              onOpen={() => ctx.openSourceOfferModal(item.articleNumber)}
            />
          </div>
        </td>
        <td className={cell}>
          {!spuProfit ? (
            <span className="opacity-20 text-[11px]">—</span>
          ) : (
            <ProfitStack profit={spuProfit.profit} fee={spuProfit.fee} highProfit={spuHighProfit} />
          )}
        </td>
        <td className={cell}>
          <StackedMetricCell
            ariaLabel={`중국 판매량 ${item.salesVolume}, 현지 판매량 ${item.localSalesVolume}`}
          >
            <MetricLine label="중국" className="font-bold text-[11px] text-foreground/70">
              {item.salesVolume}
            </MetricLine>
            <MetricLine label="현지" className="font-bold text-[11px] text-foreground/50">
              {item.localSalesVolume}
            </MetricLine>
          </StackedMetricCell>
        </td>
        <td className={cn(SEARCH_BOARD_TD_HOVER, spuVisual.fillClass, "px-1 text-center text-[10px] text-muted-foreground/30 italic font-bold")}>SELECT SKU</td>
      </tr>
      {isExpanded &&
        item.skuDetails?.map((sku: any) => (
          <SearchBoardSkuRow
            key={sku.skuId}
            variant="nested"
            sku={sku}
            item={item}
            skuPrice={skuListPrice(sku)}
            naverPrice={naverPrice ? Number(naverPrice) : null}
          />
        ))}
    </>
  );
});
