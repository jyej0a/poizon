export interface SkuRowVisualState {
  /** 모든 셀에 동일하게 깔아 행 전체에 상태 색이 보이게 한다 */
  fillClass: string;
  /** 첫 셀 왼쪽 테두리만 */
  accentClass: string;
  fade: boolean;
}

/** 호버는 셀 배경을 덮지 않고 어둡게만 깐다 (행 상태 색 유지) */
export const SEARCH_BOARD_TD_HOVER =
  "group-hover:shadow-[inset_0_0_0_9999px_rgba(15,23,42,0.035)]";

export function searchBoardCellClass(): string {
  return `px-1 text-center border-r border-solid border-border/40 ${SEARCH_BOARD_TD_HOVER}`;
}

/** 입찰 행 = 선명 + 배경 음영 / 검토 = 에메랄드 테두리+흐림 / 스킵 = 슬레이트 테두리+흐림 */
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
      fillClass: isSystem ? "bg-blue-500/[0.08]" : "bg-red-500/[0.08]",
      accentClass: isSystem ? "border-l-[3px] border-l-solid border-l-blue-500" : "border-l-[3px] border-l-solid border-l-red-500",
      fade: false,
    };
  }

  if (opts.hasStockMarked && !opts.isSkipped && !opts.isReviewed) {
    return {
      fillClass: "bg-emerald-500/[0.08]",
      accentClass: "border-l-[3px] border-l-solid border-l-emerald-500",
      fade: false,
    };
  }

  if (opts.isSkipped) {
    return {
      fillClass: "bg-slate-500/[0.06]",
      accentClass: "border-l-[3px] border-l-solid border-l-slate-400/70",
      fade: true,
    };
  }

  if (opts.isReviewed) {
    return {
      fillClass: "bg-emerald-500/[0.04]",
      accentClass: "border-l-[3px] border-l-solid border-l-emerald-500/70",
      fade: true,
    };
  }

  return { fillClass: "", accentClass: "", fade: false };
}

export function getSpuRowVisualState(opts: {
  hasAnyBid: boolean;
  allSkusSkipped: boolean;
  allHandled: boolean;
  someHandled: boolean;
}): { fillClass: string; accentClass: string; fade: boolean } {
  if (opts.hasAnyBid) {
    return {
      fillClass: "bg-blue-500/[0.06]",
      accentClass: "border-l-[3px] border-l-solid border-l-blue-400/80",
      fade: false,
    };
  }
  if (opts.allHandled) {
    return {
      fillClass: "bg-emerald-500/[0.04]",
      accentClass: "border-l-[3px] border-l-solid border-l-emerald-500/70",
      fade: true,
    };
  }
  if (opts.allSkusSkipped) {
    return {
      fillClass: "bg-slate-500/[0.06]",
      accentClass: "border-l-[3px] border-l-solid border-l-slate-400/70",
      fade: true,
    };
  }
  if (opts.someHandled) {
    return {
      fillClass: "bg-amber-500/[0.05]",
      accentClass: "border-l-[3px] border-l-solid border-l-amber-400/80",
      fade: false,
    };
  }
  return { fillClass: "", accentClass: "", fade: false };
}
