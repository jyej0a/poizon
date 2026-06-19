"use client";

import { CheckCircle2 } from "lucide-react";

export type ReviewCheckState = "none" | "partial" | "all";

interface ReviewCheckButtonProps {
  state: ReviewCheckState;
  /** partial 상태일 때 툴팁용 (예: "3/18") */
  partialLabel?: string;
  onClick: () => void;
  size?: number;
}

const STATE_STYLES: Record<ReviewCheckState, string> = {
  none: "text-muted-foreground/30 hover:text-emerald-500 hover:bg-emerald-500/5",
  partial: "text-amber-600 bg-amber-500/10 ring-1 ring-amber-500/40 hover:bg-amber-500/20",
  all: "text-emerald-600 bg-emerald-500/10 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20",
};

export function ReviewCheckButton({
  state,
  partialLabel,
  onClick,
  size = 14,
}: ReviewCheckButtonProps) {
  const title =
    state === "all"
      ? "검토완료 해제"
      : state === "partial"
        ? `일부 검토완료${partialLabel ? ` (${partialLabel})` : ""} · 클릭 시 전체 완료`
        : "검토완료로 표시";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded-full transition-all ${STATE_STYLES[state]}`}
    >
      <CheckCircle2 size={size} strokeWidth={state === "partial" ? 2.25 : 2} />
    </button>
  );
}
