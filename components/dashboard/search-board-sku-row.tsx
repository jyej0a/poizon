"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { getChildSkuIds, resolveSkuId } from "@/lib/search/search-item";
import { skuAverageAmount, skuOfferProfit, skuOptionLabel } from "@/lib/search/sku-display";
import { formatSalesVolume, getSkuSalesValue } from "@/lib/utils/sales-volume";
import { formatExposurePrice, resolveExposurePriceValue } from "@/lib/utils/exposure-price";
import { computeBidVsCostMargin, recommendBidFromCost } from "@/lib/utils/calculate-margin";
import { formatActivityLine } from "@/lib/utils/sku-activity";
import { getSkuRowVisualState, searchBoardCellClass, SEARCH_BOARD_TD_HOVER } from "@/lib/utils/sku-row-visual";
import { cn } from "@/lib/utils";
import { formatBidDate } from "@/lib/utils/poizon-listing";
import { getBestSourceOffer } from "@/lib/sourcing/source-offer-view";
import { BidStatusIndicator } from "./bid-status-indicator";
import { CopyableArticleNumber } from "./copyable-article-number";
import { RowMemoPopover } from "./row-memo-popover";
import { SkuRowManageCell } from "./sku-row-manage-cell";
import { SourceOfferPriceCell } from "./source-offer-price-cell";
import { StockStatusIndicator } from "./stock-status-indicator";
import { useSearchBoardTable } from "./search-board-table-context";
import { formatSignedWon } from "@/lib/utils/format-signed-won";
import { isHighProfit } from "@/lib/utils/high-profit";
import { ProfitStack } from "./profit-stack";
import { MetricLine, StackedMetricCell } from "./stacked-metric-cell";
import { SkuExposureHint } from "./exposure-price-hint";
import { PriceWatchButton } from "./price-watch-button";
import { currentExposureAmount, isPriceWatchHit } from "@/lib/utils/price-watch";

function BidPriceInput({ skuId, bidPrice }: { skuId: string; bidPrice?: string }) {
  const { handleBiddingPriceChange } = useSearchBoardTable();
  return (
    <div className="relative group/input w-full">
      <input
        type="text"
        value={bidPrice ? Number(bidPrice).toLocaleString() : ""}
        onChange={(e) => handleBiddingPriceChange(skuId, e.target.value)}
        className="w-full text-[11px] py-1 pl-4 pr-1.5 bg-background border border-secondary/30 rounded-md text-right font-mono font-bold focus:ring-1 focus:ring-primary/30 outline-none transition-all"
        placeholder="0"
        aria-label="입찰가"
      />
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-20 group-focus-within/input:opacity-50">
        ₩
      </span>
    </div>
  );
}

function BidNetHint({ netProfit }: { netProfit: number | null }) {
  if (netProfit == null) return null;
  return (
    <span className="text-[8px] text-muted-foreground/40 mt-0.5 font-bold tracking-tighter">
      실수령 ₩{netProfit.toLocaleString()}
    </span>
  );
}

function RecommendBidHint({
  skuId,
  recommended,
  targetRate,
}: {
  skuId: string;
  recommended: number | null;
  targetRate: number | undefined;
}) {
  const { handleBiddingPriceChange } = useSearchBoardTable();
  if (recommended == null) return null;
  const rateLabel = targetRate != null && Number.isFinite(Number(targetRate)) ? ` · ${Number(targetRate)}%` : "";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleBiddingPriceChange(skuId, String(recommended));
      }}
      className="text-[8px] text-primary/70 mt-0.5 font-bold tracking-tighter hover:text-primary hover:underline"
      aria-label={`목표 마진 권장 입찰가 ₩${recommended.toLocaleString()} 채우기`}
      title={`원가 대비 목표 마진을 만족하는 입찰가 ₩${recommended.toLocaleString()}`}
    >
      권장 ₩{recommended.toLocaleString()}
      {rateLabel}
    </button>
  );
}

interface SearchBoardSkuRowProps {
  variant: "flat" | "nested";
  sku: any;
  item: any;
  skuPrice: string | number;
  naverPrice: number | null;
}

export function SearchBoardSkuRow({
  variant,
  sku,
  item,
  skuPrice,
  naverPrice,
}: SearchBoardSkuRowProps) {
  const ctx = useSearchBoardTable();
  const nested = variant === "nested";
  const rec = ctx.skuRecommendations[sku.skuId];
  const isLoadingRec = ctx.loadingRecommendations[sku.skuId];
  const propsStr = skuOptionLabel(sku);
  const bidPrice = ctx.biddingPrices[sku.skuId];
  const naverItem = getBestSourceOffer(ctx.sourceOffers, item.articleNumber);
  const isBiddable = item.raw?.userCanBidding !== false;
  const skuKey = resolveSkuId(sku);
  const isSkipped = ctx.skippedSkuIds.has(skuKey);
  const skuStatus = ctx.skuStatuses[skuKey];
  const { systemBid, manualBid } = ctx.getSkuBidViews(skuKey, skuStatus);
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
  const skuActivity = ctx.resolveSkuActivity(skuKey, skuStatus);
  const activityLine = formatActivityLine(skuActivity);
  const avg = skuAverageAmount(sku);
  const profit = skuOfferProfit(rec, skuPrice, naverPrice, ctx.systemSettings);
  const highProfit = isHighProfit(profit?.profit, ctx.systemSettings);
  const margin = computeBidVsCostMargin(bidPrice, naverPrice ?? undefined, ctx.systemSettings);
  const netProfit = margin?.netProfit ?? null;
  const recommendedBid = recommendBidFromCost(naverPrice, ctx.systemSettings);
  const targetRate = ctx.systemSettings?.target_margin_rate;
  const watchPrice = skuStatus?.watchPrice ?? null;
  const watchHit = isPriceWatchHit(watchPrice, currentExposureAmount(rec, skuPrice));

  const cell = cn(searchBoardCellClass(), rowVisual.fillClass);
  const rowClass = nested
    ? `group text-[11px] h-12 border-b border-dashed border-border/40 ${rowVisual.fade ? "opacity-40 grayscale-[0.5]" : ""}`
    : `group h-16 ${rowVisual.fade ? "opacity-40 grayscale-[0.5]" : ""}`;

  return (
    <tr className={rowClass}>
      <td className={cn(cell, rowVisual.accentClass, "relative")}>
        <SkuRowManageCell
          skuId={sku.skuId}
          checked={!!ctx.selectedSkus[sku.skuId]}
          onCheckedChange={() => ctx.toggleSkuSelection(sku.skuId)}
          systemBid={systemBid}
          manualBid={manualBid}
          onManualBidToggle={() => ctx.handleToggleSkuManualBid(skuKey, spuIdKey)}
          isSavingManualBid={!!ctx.savingManualBid[skuKey]}
          stockMarked={!!skuStatus?.stockMarked}
          stockMarkedDate={skuStatus?.stockMarkedDate}
          onStockToggle={() => ctx.handleToggleSkuStockMarked(skuKey, spuIdKey)}
          isSavingStock={!!ctx.savingStockMarked[skuKey]}
          isHandled={isSkuHandled}
          onHandledToggle={() => ctx.toggleSkuHandled(skuKey, spuIdKey, childSkuIds, item)}
          hasMemo={!!skuStatus?.memo}
          memoTitle={skuStatus?.memo ?? undefined}
          activityTitle={activityLine ?? undefined}
          onMemoClick={() =>
            ctx.setSkuMemoEditor(
              ctx.skuMemoEditor?.skuId === skuKey
                ? null
                : { skuId: skuKey, spuId: spuIdKey, value: skuStatus?.memo ?? "" }
            )
          }
          isSkipped={isSkipped}
          onSkipToggle={() => ctx.handleToggleSkip(variant === "flat" ? sku : { ...sku, parent: item }, true)}
          checkboxSize={nested ? "sm" : "default"}
        />
        {ctx.skuMemoEditor?.skuId === skuKey && (
          <RowMemoPopover
            title={`옵션 메모 · ${propsStr}`}
            value={ctx.skuMemoEditor.value}
            placeholder="이 옵션에 대한 메모"
            saving={!!ctx.savingSkuMemo[skuKey]}
            onChange={(value) => ctx.setSkuMemoEditor({ skuId: skuKey, spuId: spuIdKey, value })}
            onClose={() => ctx.setSkuMemoEditor(null)}
            onSave={() => ctx.handleSaveSkuMemo(skuKey, spuIdKey)}
          />
        )}
      </td>
      <td className={cn(cell, "px-2", nested ? "" : "overflow-hidden")}>
        {nested ? (
          <div className="flex items-center gap-3 pl-6 relative">
            <span className="pointer-events-none absolute left-2.5 top-0 bottom-0 w-px bg-border" aria-hidden />
            <div className="w-8 h-8 bg-white border border-secondary/10 rounded-md p-1 shrink-0 flex items-center justify-center shadow-xs">
              {sku.image ? (
                <img src={sku.image} className="max-w-full max-h-full object-contain" alt="" />
              ) : (
                <ImageIcon size={14} className="opacity-5" />
              )}
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
                    onClick={() => ctx.handleToggleSkuManualBid(skuKey, spuIdKey)}
                  />
                )}
                {skuStatus?.stockMarked && (
                  <StockStatusIndicator
                    date={skuStatus.stockMarkedDate ?? formatBidDate(new Date().toISOString())}
                    variant="badge"
                    removable
                    onClick={() => ctx.handleToggleSkuStockMarked(skuKey, spuIdKey)}
                  />
                )}
                <span className="bg-emerald-500/5 text-emerald-600/60 text-[8px] px-1 py-0.5 rounded border border-emerald-500/10 font-bold shrink-0">
                  입찰 가능
                </span>
              </div>
              {systemBid && (
                <span className="text-[9px] text-blue-700 font-semibold">
                  입찰 ₩{systemBid.price?.toLocaleString()} · {systemBid.date}
                </span>
              )}
              {manualBid && !systemBid && (
                <span className="text-[9px] text-red-700 font-semibold">수동표기 · {manualBid.date}</span>
              )}
              {skuStatus?.stockMarked && (
                <span className="text-[9px] text-emerald-700 font-semibold">재고보유 · {skuStatus.stockMarkedDate}</span>
              )}
              {activityLine && (
                <span className="text-[9px] text-muted-foreground/70 font-medium">{activityLine}</span>
              )}
              {skuStatus?.memo && (
                <span className="text-[9px] text-amber-700/80 truncate max-w-[200px]" title={skuStatus.memo}>
                  {skuStatus.memo}
                </span>
              )}
              <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">SKUID: {sku.skuId}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
              {sku.image || item.image ? (
                <img src={sku.image || item.image} className="w-full h-full object-contain" alt="" />
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
                <span className="bg-blue-500/10 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">
                  {propsStr}
                </span>
                {systemBid && <BidStatusIndicator bid={systemBid} variant="badge" />}
                {manualBid && (
                  <BidStatusIndicator
                    bid={manualBid}
                    variant="badge"
                    removable
                    onClick={() => ctx.handleToggleSkuManualBid(skuKey, spuIdKey)}
                  />
                )}
                {skuStatus?.stockMarked && (
                  <StockStatusIndicator
                    date={skuStatus.stockMarkedDate ?? formatBidDate(new Date().toISOString())}
                    variant="badge"
                    removable
                    onClick={() => ctx.handleToggleSkuStockMarked(skuKey, spuIdKey)}
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
        )}
      </td>
      <td className={cell}>
        <StackedMetricCell
          ariaLabel={`30일 거래가 ${avg > 0 ? `₩${Number(avg).toLocaleString()}` : "없음"}, 중국 노출가 ${formatExposurePrice(rec, skuPrice)}`}
        >
          <MetricLine label="거래" className="font-bold text-foreground/60 text-[11px]">
            {avg > 0 ? `₩${Number(avg).toLocaleString()}` : "—"}
          </MetricLine>
          <SkuExposureHint
            rec={rec}
            loading={isLoadingRec}
            displayValue={formatExposurePrice(rec, skuPrice)}
          >
            <MetricLine
              label="노출"
              className="font-bold text-[11px] text-orange-600/80 italic"
              ariaLabel={`중국 노출가로 입찰가 채우기, 노출 보장 ${formatExposurePrice(rec, skuPrice)}`}
              onClick={(e) => {
                e.stopPropagation();
                const exposurePr = resolveExposurePriceValue(rec, skuPrice);
                ctx.handleBiddingPriceChange(sku.skuId, String(exposurePr));
              }}
            >
              <span className="inline-flex items-center gap-1">
                {formatExposurePrice(rec, skuPrice)}
                {isLoadingRec && !rec && <Loader2 size={8} className="animate-spin opacity-30 shrink-0" />}
              </span>
            </MetricLine>
          </SkuExposureHint>
        </StackedMetricCell>
      </td>
      <td className={cn(cell, nested ? "font-bold text-emerald-600/70" : "font-bold text-emerald-600")}>
        <div className="flex flex-col items-center justify-center -space-y-0.5">
          <SourceOfferPriceCell
            item={naverItem}
            loading={!!ctx.loadingSourceOffers[item.articleNumber] && !naverItem}
            emptyClassName="opacity-10"
            onOpen={() => ctx.openSourceOfferModal(item.articleNumber)}
          />
        </div>
      </td>
      <td className={cell}>
        {!profit ? (
          <span className="opacity-10 text-[11px]">—</span>
        ) : (
          <ProfitStack profit={profit.profit} fee={profit.fee} compact={nested} highProfit={highProfit} />
        )}
      </td>
      <td className={cell}>
        <StackedMetricCell
          ariaLabel={`중국 판매량 ${formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "globalSoldNum30"))}, 현지 판매량 ${formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "localSoldNum30"))}`}
        >
          <MetricLine label="중국" className={`font-bold text-[11px] ${nested ? "text-foreground/40" : "text-foreground/50"}`}>
            {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "globalSoldNum30"))}
          </MetricLine>
          <MetricLine label="현지" className="font-bold text-[11px] text-foreground/40">
            {formatSalesVolume(getSkuSalesValue(sku, item.skuStatsCN, "localSoldNum30"))}
          </MetricLine>
        </StackedMetricCell>
      </td>
      <td className={cn(SEARCH_BOARD_TD_HOVER, rowVisual.fillClass, nested ? "px-1 text-center" : "px-2 text-center")}>
        {nested ? (
          <div className="flex items-center justify-center px-1 gap-1.5">
            {margin ? (
              <div className="flex flex-col items-center leading-none gap-0.5 min-w-[44px]">
                <span className={`font-bold text-[11px] ${margin.actualProfit > 0 ? "text-blue-600" : margin.actualProfit < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatSignedWon(margin.actualProfit)}
                </span>
                <span className="text-[9px] font-bold opacity-30">{margin.actualRate}%</span>
              </div>
            ) : (
              <div className="min-w-[44px] opacity-10 text-[9px] font-bold">READY</div>
            )}
            <PriceWatchButton
              watchPrice={watchPrice}
              hit={watchHit}
              saving={!!ctx.savingWatch[skuKey]}
              onToggle={() => ctx.handleToggleSkuWatch(skuKey, spuIdKey, skuPrice)}
            />
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="w-full max-w-[100px] mx-auto">
                <BidPriceInput skuId={sku.skuId} bidPrice={bidPrice} />
              </div>
              {bidPrice ? (
                <BidNetHint netProfit={netProfit} />
              ) : (
                <RecommendBidHint skuId={sku.skuId} recommended={recommendedBid} targetRate={targetRate} />
              )}
            </div>
            <button
              type="button"
              onClick={() => ctx.handleSingleBid(sku.skuId, item.id)}
              disabled={!bidPrice || ctx.isBidding}
              className="px-3 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 motion-safe:active:scale-95 disabled:opacity-20 motion-safe:transition-all uppercase tracking-wider italic shrink-0"
              aria-label="이 옵션 입찰"
            >
              BID
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <PriceWatchButton
              watchPrice={watchPrice}
              hit={watchHit}
              saving={!!ctx.savingWatch[skuKey]}
              onToggle={() => ctx.handleToggleSkuWatch(skuKey, spuIdKey, skuPrice)}
            />
            <div className="flex-1 max-w-[120px] flex flex-col items-center">
              <BidPriceInput skuId={sku.skuId} bidPrice={bidPrice} />
              {bidPrice ? (
                <BidNetHint netProfit={netProfit} />
              ) : (
                <RecommendBidHint skuId={sku.skuId} recommended={recommendedBid} targetRate={targetRate} />
              )}
            </div>
            <button
              type="button"
              onClick={() => ctx.handleSingleBid(sku.skuId, item.id)}
              disabled={!bidPrice || ctx.isBidding}
              className="px-4 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 motion-safe:active:scale-95 disabled:opacity-20 motion-safe:transition-all uppercase tracking-wider italic shrink-0"
              aria-label="이 옵션 입찰"
            >
              BID
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
