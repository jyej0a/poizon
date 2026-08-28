"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  pageBounds,
  SEARCH_BOARD_PAGE_SIZE,
  visiblePageNumbers,
} from "@/lib/search/board-page";
import { cn } from "@/lib/utils";
import { CONTROL_PRESS } from "@/lib/utils/motion";

interface SearchBoardPaginationProps {
  page: number;
  totalPages: number;
  totalArticles: number;
  onPageChange: (page: number) => void;
}

const pageBtn =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-background px-2 text-[12px] font-medium text-foreground hover:bg-secondary/60 disabled:opacity-30 disabled:hover:bg-background";

export function SearchBoardPagination({
  page,
  totalPages,
  totalArticles,
  onPageChange,
}: SearchBoardPaginationProps) {
  if (totalArticles <= SEARCH_BOARD_PAGE_SIZE) return null;

  const { start, end } = pageBounds(page, totalArticles);
  const pages = visiblePageNumbers(page, totalPages);

  return (
    <div className="shrink-0 px-4 py-2 border-t border-border/40 bg-background/45 backdrop-blur-md flex items-center justify-between gap-3 text-[12px]">
      <span className="text-muted-foreground">
        품번{" "}
        <span className="font-bold text-foreground">
          {start.toLocaleString()}–{end.toLocaleString()}
        </span>
        <span className="opacity-60"> / {totalArticles.toLocaleString()}</span>
      </span>
      <nav className="flex items-center gap-1" aria-label="검색 결과 페이지">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(pageBtn, CONTROL_PRESS)}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline pr-1">이전</span>
        </button>
        {pages.map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground/60" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                pageBtn,
                CONTROL_PRESS,
                item === page && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              )}
              aria-label={`${item}페이지`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(pageBtn, CONTROL_PRESS)}
          aria-label="다음 페이지"
        >
          <span className="hidden sm:inline pl-1">다음</span>
          <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  );
}
