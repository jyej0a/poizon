"use client";

import { SEARCH_BOARD_INDEX_COL_PX } from "@/lib/search/board-page";
import { cn } from "@/lib/utils";

interface SearchBoardIndexCellProps {
  index?: number | null;
  className?: string;
  accentClass?: string;
}

export function SearchBoardIndexCell({
  index,
  className,
  accentClass,
}: SearchBoardIndexCellProps) {
  const hasIndex = index != null && index > 0;
  return (
    <td
      style={{ width: SEARCH_BOARD_INDEX_COL_PX }}
      className={cn(className, accentClass, "w-10 px-0")}
    >
      {hasIndex ? (
        <span
          className="text-[11px] font-semibold tabular-nums text-muted-foreground"
          aria-label={`품번 ${index}`}
        >
          {index}
        </span>
      ) : null}
    </td>
  );
}
