export interface SkuRowVisualState {
  rowClass: string;
  manageCellClass: string;
  fade: boolean;
}

/** 입찰 행 = 선명 + 배경 음영 / 검토·스킵 = 흐림 */
export function getSkuRowVisualState(opts: {
  hasSystemBid: boolean;
  hasManualBid: boolean;
  hasStockMarked: boolean;
  isSkipped: boolean;
  isReviewed: boolean;
}): SkuRowVisualState {
  const hasBid = opts.hasSystemBid || opts.hasManualBid;

  if (hasBid) {
    const isSystem = opts.hasSystemBid;
    return {
      rowClass: isSystem
        ? "border-l-[3px] border-l-blue-500 bg-blue-500/[0.08]"
        : "border-l-[3px] border-l-red-500 bg-red-500/[0.08]",
      manageCellClass: isSystem ? "bg-blue-500/[0.10]" : "bg-red-500/[0.10]",
      fade: false,
    };
  }

  if (opts.hasStockMarked && !opts.isSkipped && !opts.isReviewed) {
    return {
      rowClass: "border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.08]",
      manageCellClass: "bg-emerald-500/[0.10]",
      fade: false,
    };
  }

  if (opts.isSkipped || opts.isReviewed) {
    return { rowClass: "", manageCellClass: "", fade: true };
  }

  return { rowClass: "", manageCellClass: "", fade: false };
}

export function getSpuRowVisualState(opts: {
  hasAnyBid: boolean;
  allSkusSkipped: boolean;
  allHandled: boolean;
  someHandled: boolean;
}): { rowClass: string; fade: boolean } {
  if (opts.hasAnyBid) {
    return {
      rowClass: "border-l-[3px] border-l-blue-400/60 bg-blue-500/[0.04]",
      fade: false,
    };
  }
  if (opts.allSkusSkipped || opts.allHandled) {
    return { rowClass: "", fade: true };
  }
  if (opts.someHandled) {
    return { rowClass: "border-l-[3px] border-l-amber-400/50 bg-amber-500/[0.03]", fade: false };
  }
  return { rowClass: "", fade: false };
}
