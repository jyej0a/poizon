"use client";

import { Gavel, X } from "lucide-react";

export type BidDisplaySource = "system" | "manual";

export interface BidStatusInfo {
  price?: number;
  date: string;
  sizeInfo?: string;
  source: BidDisplaySource;
  createdAt?: string;
}

interface BidStatusIndicatorProps {
  bid: BidStatusInfo;
  variant?: "compact" | "badge" | "both";
  iconSize?: number;
  onClick?: () => void;
  removable?: boolean;
}

const SOURCE_STYLES = {
  system: {
    icon: "bg-blue-600 ring-blue-400/40 hover:bg-blue-500",
    badge: "bg-blue-600 hover:bg-blue-500",
    tooltip: "bg-blue-950 border-blue-400/30",
    tooltipArrow: "border-r-blue-950",
    label: "시스템 입찰",
  },
  manual: {
    icon: "bg-red-600 ring-red-400/40 hover:bg-red-500",
    badge: "bg-red-600 hover:bg-red-500",
    tooltip: "bg-red-950 border-red-400/30",
    tooltipArrow: "border-r-red-950",
    label: "수동 표기",
  },
} as const;

export function BidStatusIndicator({
  bid,
  variant = "both",
  iconSize = 13,
  onClick,
  removable = false,
}: BidStatusIndicatorProps) {
  const styles = SOURCE_STYLES[bid.source];
  const showIcon = variant === "compact" || variant === "both";
  const showBadge = variant === "badge" || variant === "both";
  const interactive = removable && !!onClick;

  const pricePart = bid.price && bid.price > 0 ? ` · ₩${bid.price.toLocaleString()}` : "";
  const undoHint = interactive ? " · 클릭하여 해제" : "";
  const tooltip = `${styles.label}${pricePart} · ${bid.date}${bid.sizeInfo ? ` · ${bid.sizeInfo}` : ""}${undoHint}`;

  const iconEl = (
    <div
      className={`relative group/bid-history ${interactive ? "cursor-pointer" : "cursor-help"}`}
      title={tooltip}
      aria-label={tooltip}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
    >
      <div
        className={`flex items-center justify-center w-[22px] h-[22px] rounded-md text-white shadow-sm ring-2 transition-colors ${styles.icon} ${interactive ? "group-hover/bid-history:ring-red-300" : ""}`}
      >
        <Gavel size={iconSize} strokeWidth={2.5} className="rotate-[-20deg]" />
        {interactive && (
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 group-hover/bid-history:opacity-100 transition-opacity">
            <X size={iconSize - 2} strokeWidth={3} />
          </span>
        )}
      </div>
      {!interactive && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/bid-history:block z-[60] animate-in fade-in slide-in-from-left-1 duration-200 pointer-events-none">
          <div
            className={`text-white text-[10px] px-2.5 py-1.5 rounded-md shadow-xl whitespace-nowrap font-bold flex items-center gap-1.5 border ${styles.tooltip}`}
          >
            <Gavel size={10} className="rotate-[-20deg] opacity-80" />
            {tooltip}
          </div>
          <div className={`absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent ${styles.tooltipArrow}`} />
        </div>
      )}
    </div>
  );

  const badgeEl = showBadge && (
    <span
      title={tooltip}
      aria-label={tooltip}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`text-[8px] px-1.5 py-0.5 rounded-md text-white font-bold shrink-0 flex items-center gap-0.5 whitespace-nowrap shadow-sm ${styles.badge} ${interactive ? "cursor-pointer ring-1 ring-transparent hover:ring-red-300/60" : ""}`}
    >
      <Gavel size={8} className="rotate-[-20deg]" />
      {bid.source === "system" ? "입찰됨" : "수동표기"}
    </span>
  );

  return (
    <>
      {showIcon && iconEl}
      {badgeEl}
    </>
  );
}

interface SpuBidSummaryProps {
  systemCount: number;
  manualCount: number;
  totalCount: number;
  bids: Array<{ sizeInfo?: string; price?: number; date: string; source: BidDisplaySource }>;
  variant?: "icon" | "inline";
}

function SpuBidTooltipContent({
  bidCount,
  systemCount,
  manualCount,
  totalCount,
  bids,
}: {
  bidCount: number;
  systemCount: number;
  manualCount: number;
  totalCount: number;
  bids: SpuBidSummaryProps["bids"];
}) {
  return (
    <div className="bg-slate-900 text-white text-[10px] px-2.5 py-2 rounded-md shadow-xl font-bold border border-white/10 min-w-[160px]">
      <div className="mb-1.5">
        입찰 {bidCount}/{totalCount}개 옵션
        <span className="ml-1 font-normal text-white/60">
          (시스템 {systemCount} · 수동 {manualCount})
        </span>
      </div>
      <div className="space-y-1 font-normal">
        {bids.map((b, i) => (
          <div key={i} className={`flex justify-between gap-3 ${b.source === "manual" ? "text-red-300" : "text-blue-300"}`}>
            <span className="opacity-90 truncate max-w-[80px]">{b.sizeInfo || "옵션"}</span>
            <span>
              {b.price && b.price > 0 ? `₩${b.price.toLocaleString()} · ` : ""}
              {b.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpuBidSummary({
  systemCount,
  manualCount,
  totalCount,
  bids,
  variant = "icon",
}: SpuBidSummaryProps) {
  const bidCount = systemCount + manualCount;
  if (bidCount === 0) return null;

  const hasSystem = systemCount > 0;
  const primarySource: BidDisplaySource = hasSystem ? "system" : "manual";
  const styles = SOURCE_STYLES[primarySource];

  if (variant === "inline") {
    return (
      <div className="relative group/spu-bid-summary shrink-0">
        <span
          className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap cursor-help ${
            hasSystem
              ? "bg-blue-500/15 text-blue-700 border border-blue-500/25"
              : "bg-red-500/15 text-red-700 border border-red-500/25"
          }`}
          title={`입찰 ${bidCount}/${totalCount} (시스템 ${systemCount} · 수동 ${manualCount})`}
        >
          입찰 {bidCount}/{totalCount}
          {systemCount > 0 && <span className="text-blue-600 ml-0.5">·{systemCount}</span>}
          {manualCount > 0 && <span className="text-red-600 ml-0.5">·{manualCount}</span>}
        </span>
        <div className="absolute left-0 top-full mt-1 hidden group-hover/spu-bid-summary:block z-[60] animate-in fade-in slide-in-from-top-1 duration-200 pointer-events-none">
          <SpuBidTooltipContent
            bidCount={bidCount}
            systemCount={systemCount}
            manualCount={manualCount}
            totalCount={totalCount}
            bids={bids}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group/spu-bid-summary">
      <div
        className={`flex items-center justify-center w-[22px] h-[22px] rounded-md text-white shadow-sm ring-2 cursor-help transition-colors ${styles.icon}`}
        title={`입찰 ${bidCount}/${totalCount} (시스템 ${systemCount} · 수동 ${manualCount})`}
        aria-label={`입찰 ${bidCount}/${totalCount} (시스템 ${systemCount} · 수동 ${manualCount})`}
        role="img"
      >
        <Gavel size={12} strokeWidth={2.5} className="rotate-[-20deg]" />
      </div>
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/spu-bid-summary:block z-[60] animate-in fade-in slide-in-from-left-1 duration-200 pointer-events-none">
        <SpuBidTooltipContent
          bidCount={bidCount}
          systemCount={systemCount}
          manualCount={manualCount}
          totalCount={totalCount}
          bids={bids}
        />
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
      </div>
    </div>
  );
}
