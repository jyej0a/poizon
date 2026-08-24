"use client";

import { Ban, Eye, EyeOff, MoreHorizontal, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ReviewCheckButton, type ReviewCheckState } from "./review-check-button";

interface SpuRowManageCellProps {
  allChildSelected: boolean;
  someChildSelected: boolean;
  onSelectToggle: () => void;
  reviewState: ReviewCheckState;
  partialLabel?: string;
  onReviewToggle: () => void;
  hasMemo?: boolean;
  memoTitle?: string;
  onMemoClick: () => void;
  allSkusSkipped: boolean;
  childCount: number;
  onSkipToggle: () => void;
  onExclude: () => void;
  onRemove: () => void;
}

/**
 * SPU 관리 열 — SKU와 동일 슬롯 순서(선택·입찰·재고·검토·메모·스킵).
 * 입찰/재고는 SPU에 해당 동작이 없어 자리만 유지. 제외·삭제는 케밥 메뉴.
 */
export function SpuRowManageCell({
  allChildSelected,
  someChildSelected,
  onSelectToggle,
  reviewState,
  partialLabel,
  onReviewToggle,
  hasMemo,
  memoTitle,
  onMemoClick,
  allSkusSkipped,
  childCount,
  onSkipToggle,
  onExclude,
  onRemove,
}: SpuRowManageCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-start gap-0">
      <div className="w-6 flex items-center justify-center shrink-0">
        <Checkbox
          aria-label="이 품번의 모든 옵션 입찰 선택"
          checked={allChildSelected ? true : someChildSelected ? "indeterminate" : false}
          onCheckedChange={onSelectToggle}
        />
      </div>

      {/* 입찰 슬롯 — SKU 정렬용 자리 */}
      <div className="w-7 flex items-center justify-center shrink-0" aria-hidden />

      {/* 재고 슬롯 — SKU 정렬용 자리 */}
      <div className="w-6 flex items-center justify-center shrink-0" aria-hidden />

      <div className="w-6 flex items-center justify-center shrink-0">
        <ReviewCheckButton
          state={reviewState}
          partialLabel={partialLabel}
          onClick={onReviewToggle}
        />
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onMemoClick}
          title={memoTitle || (hasMemo ? "메모" : "메모 추가")}
          className={`p-1 rounded-md transition-all ${hasMemo ? "text-amber-600 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-500/5"}`}
        >
          <StickyNote size={14} />
        </button>
      </div>

      <div className="w-6 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onSkipToggle}
          disabled={childCount === 0}
          title={
            childCount === 0
              ? "옵션 정보가 없어 스킵할 수 없습니다"
              : allSkusSkipped
                ? "이 품번 전체 옵션 스킵 해제"
                : "이 품번 전체 옵션(사이즈) 스킵"
          }
          className={`p-1 rounded-md transition-all disabled:opacity-20 disabled:cursor-not-allowed ${allSkusSkipped ? "text-orange-600 bg-orange-500/15 ring-1 ring-orange-500/40" : "text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-secondary/60"}`}
        >
          {allSkusSkipped ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="relative w-6 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="품번 추가 작업"
          aria-label="품번 추가 작업"
          aria-expanded={menuOpen}
          className="p-1 text-muted-foreground/30 hover:text-foreground hover:bg-secondary/60 rounded-md transition-all"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1 z-50 w-40 rounded-lg border border-border/60 bg-card shadow-lg py-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onExclude();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left text-orange-600"
              >
                <Ban size={13} /> 영구 제외
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left text-destructive"
              >
                <Trash2 size={13} /> 목록에서 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
