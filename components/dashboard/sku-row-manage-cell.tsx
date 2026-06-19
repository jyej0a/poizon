"use client";

import { Eye, EyeOff, Home, StickyNote } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BidStatusIndicator, type BidStatusInfo } from "./bid-status-indicator";
import { StockStatusIndicator } from "./stock-status-indicator";
import { ReviewCheckButton } from "./review-check-button";

interface SkuRowManageCellProps {
  skuId: string | number;
  checked: boolean;
  onCheckedChange: () => void;
  systemBid?: BidStatusInfo | null;
  manualBid?: BidStatusInfo | null;
  onManualBidToggle: () => void;
  isSavingManualBid?: boolean;
  stockMarked?: boolean;
  stockMarkedDate?: string | null;
  onStockToggle: () => void;
  isSavingStock?: boolean;
  isHandled?: boolean;
  onHandledToggle: () => void;
  hasMemo?: boolean;
  memoTitle?: string;
  onMemoClick: () => void;
  isSkipped: boolean;
  onSkipToggle: () => void;
  checkboxSize?: "default" | "sm";
  activityTitle?: string;
}

export function SkuRowManageCell({
  skuId,
  checked,
  onCheckedChange,
  systemBid,
  manualBid,
  onManualBidToggle,
  isSavingManualBid,
  stockMarked = false,
  stockMarkedDate,
  onStockToggle,
  isSavingStock,
  isHandled = false,
  onHandledToggle,
  hasMemo,
  memoTitle,
  onMemoClick,
  isSkipped,
  onSkipToggle,
  checkboxSize = "default",
  activityTitle,
}: SkuRowManageCellProps) {
  const iconSize = checkboxSize === "sm" ? 13 : 14;
  const stockDate = stockMarkedDate ?? "—";

  return (
    <div className="flex items-center justify-start gap-0">
      <div className="w-6 flex items-center justify-center shrink-0">
        <Checkbox
          aria-label={`옵션 ${skuId} 입찰 선택`}
          size={checkboxSize}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>

      <div className="w-7 flex items-center justify-center shrink-0">
        {manualBid ? (
          <BidStatusIndicator
            bid={manualBid}
            variant="compact"
            iconSize={11}
            removable={!isSavingManualBid}
            onClick={isSavingManualBid ? undefined : onManualBidToggle}
          />
        ) : systemBid ? (
          <BidStatusIndicator bid={systemBid} variant="compact" iconSize={11} />
        ) : (
          <button
            type="button"
            onClick={onManualBidToggle}
            disabled={isSavingManualBid}
            title="입찰 완료 (수동 표기)"
            className="flex items-center justify-center w-[22px] h-[22px] rounded-md border-2 border-dashed border-red-300/60 text-red-400/50 hover:border-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <span className="text-[10px] font-bold leading-none">+</span>
          </button>
        )}
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        {stockMarked ? (
          <StockStatusIndicator
            date={stockDate}
            variant="compact"
            iconSize={11}
            removable={!isSavingStock}
            onClick={isSavingStock ? undefined : onStockToggle}
          />
        ) : (
          <button
            type="button"
            onClick={onStockToggle}
            disabled={isSavingStock}
            title="재고 보유 (수동 표기)"
            className="flex items-center justify-center w-[22px] h-[22px] rounded-md border-2 border-dashed border-emerald-300/60 text-emerald-400/50 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
          >
            <Home size={11} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        <ReviewCheckButton
          state={isHandled ? "all" : "none"}
          onClick={onHandledToggle}
          size={checkboxSize === "sm" ? 13 : 14}
        />
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        <button
          onClick={onMemoClick}
          title={hasMemo ? `메모: ${memoTitle}${activityTitle ? `\n${activityTitle}` : ""}` : activityTitle ?? "메모 추가"}
          className={`p-1 rounded-md transition-all ${hasMemo ? "text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 ring-1 ring-amber-500/25" : "text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-500/5"}`}
        >
          <StickyNote size={iconSize} />
        </button>
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        <button
          onClick={onSkipToggle}
          title={isSkipped ? `스킵 해제${activityTitle ? `\n${activityTitle}` : ""}` : `이 옵션 스킵${activityTitle ? `\n${activityTitle}` : ""}`}
          className={`p-1 rounded-md transition-all ${
            isSkipped
              ? "text-orange-600 bg-orange-500/15 ring-1 ring-orange-500/40 hover:bg-orange-500/25"
              : "text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-secondary/60"
          }`}
        >
          {isSkipped ? <EyeOff size={iconSize} strokeWidth={2.5} /> : <Eye size={iconSize} />}
        </button>
      </div>
    </div>
  );
}
