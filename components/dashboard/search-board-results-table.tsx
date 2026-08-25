"use client";

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
}

export function SearchBoardResultsTable({
  isFlatView,
  itemsCount,
  filteredEmpty,
  sortedFlattenedRows,
  sortedItems,
}: SearchBoardResultsTableProps) {
  const ctx = useSearchBoardTable();

  return (
    <div className="overflow-auto flex-1 min-h-0 custom-scrollbar w-full bg-card">
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
              <td colSpan={7} className="py-16 text-center text-muted-foreground/70 text-sm">
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
              />
            ))
          ) : (
            sortedItems.map((item, idx) => (
              <SearchBoardSpuRow key={`${item.articleNumber}-${idx}`} item={item} idx={idx} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
