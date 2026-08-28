"use client";

import { memo, type Ref } from "react";
import { brandItemKey } from "@/lib/search/search-item";
import { SearchBoardSkuRow } from "./search-board-sku-row";
import { SearchBoardSpuRow } from "./search-board-spu-row";
import { SearchBoardTableHeader } from "./search-board-table-header";
import { useSearchBoardTable } from "./search-board-table-context";

interface SearchBoardResultsTableProps {
  isFlatView: boolean;
  itemsCount: number;
  filteredEmpty: boolean;
  sortedFlattenedRows: any[];
  sortedItems: any[];
  articleIndexByKey: Map<string, number>;
  scrollRef?: Ref<HTMLDivElement>;
}

export const SearchBoardResultsTable = memo(function SearchBoardResultsTable({
  isFlatView,
  itemsCount,
  filteredEmpty,
  sortedFlattenedRows,
  sortedItems,
  articleIndexByKey,
  scrollRef,
}: SearchBoardResultsTableProps) {
  const ctx = useSearchBoardTable();

  return (
    <div
      ref={scrollRef}
      className="overflow-auto flex-1 min-h-0 custom-scrollbar w-full bg-card"
    >
      <table
        className={`w-full text-[13px] text-left whitespace-nowrap table-fixed border-collapse ${
          ctx.resizing ? "cursor-col-resize select-none" : ""
        }`}
      >
        <SearchBoardTableHeader
          columnWidths={ctx.columnWidths}
          workspaceView={ctx.workspaceView}
          allVisibleSelected={ctx.allVisibleSelected}
          someVisibleSelected={ctx.someVisibleSelected}
          onToggleSelectAll={ctx.toggleSelectAllVisible}
          sortConfig={ctx.sortConfig}
          onToggleSort={ctx.toggleSort}
          onResizeStart={ctx.handleResizeStart}
          onResetColumnWidth={ctx.resetColumnWidth}
        />
        <tbody className="divide-y divide-secondary/10">
          {filteredEmpty ? (
            <tr>
              <td colSpan={8} className="py-16 text-center text-muted-foreground/70 text-sm">
                {itemsCount === 0
                  ? "검색을 시작해 주세요."
                  : "해당 분류나 표시 조건에 맞는 상품이 목록에 없습니다."}
              </td>
            </tr>
          ) : isFlatView ? (
            sortedFlattenedRows.map((row, idx) => (
              <SearchBoardSkuRow
                key={`${row.skuId}-${idx}`}
                variant="flat"
                sku={row}
                item={row.parent}
                skuPrice={row.skuPrice}
                naverPrice={row.naverPrice}
                articleIndex={articleIndexByKey.get(brandItemKey(row.parent)) ?? null}
              />
            ))
          ) : (
            sortedItems.map((item, idx) => (
              <SearchBoardSpuRow
                key={`${item.articleNumber}-${idx}`}
                item={item}
                articleIndex={articleIndexByKey.get(brandItemKey(item)) ?? 0}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
