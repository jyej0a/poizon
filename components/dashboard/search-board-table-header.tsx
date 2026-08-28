"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SEARCH_BOARD_INDEX_COL_PX } from "@/lib/search/board-page";
import type { SortKey } from "@/lib/search/column-layout";
import type { WorkspaceView } from "./dashboard-view-tabs";

interface ResizeHandleProps {
  column: string;
  onResizeStart: (e: React.MouseEvent, column: string) => void;
  onReset: (column: string) => void;
}

function ResizeHandle({ column, onResizeStart, onReset }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={(e) => onResizeStart(e, column)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset(column);
      }}
      onClick={(e) => e.stopPropagation()}
      title="드래그하여 너비 조절 · 더블클릭 시 기본값 복원"
      aria-label="열 너비 조절. 더블클릭 시 기본값 복원"
      role="separator"
      aria-orientation="vertical"
      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 flex justify-center group/resize"
    >
      <div className="w-px h-full bg-transparent group-hover/resize:bg-primary/60 transition-colors" />
    </div>
  );
}

function SortIcon({
  column,
  sortConfig,
}: {
  column: SortKey;
  sortConfig: { key: SortKey; dir: "asc" | "desc" } | null;
}) {
  const active = sortConfig?.key === column;
  if (!active) return <ChevronsUpDown size={11} className="opacity-30 shrink-0" />;
  return sortConfig?.dir === "asc" ? (
    <ArrowUp size={11} className="text-primary shrink-0" />
  ) : (
    <ArrowDown size={11} className="text-primary shrink-0" />
  );
}

function SortSubButton({
  column,
  label,
  sortConfig,
  onToggleSort,
}: {
  column: SortKey;
  label: string;
  sortConfig: { key: SortKey; dir: "asc" | "desc" } | null;
  onToggleSort: (key: SortKey) => void;
}) {
  const active = sortConfig?.key === column;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleSort(column);
      }}
      className={`inline-flex items-center gap-0.5 rounded px-0.5 hover:text-foreground ${
        active ? "text-foreground" : ""
      }`}
      aria-label={`${label} 정렬`}
    >
      {label}
      <SortIcon column={column} sortConfig={sortConfig} />
    </button>
  );
}

const thBase =
  "relative group/header px-1 text-center align-middle border-r border-border/40 select-none bg-muted";
const thPoizon = `${thBase} shadow-[inset_0_2px_0_0_oklch(0.68_0.15_190)]`;
const thCost = `${thBase} shadow-[inset_0_2px_0_0_rgb(16_185_129)]`;
const thProfit = `${thBase} shadow-[inset_0_2px_0_0_rgb(37_99_235)]`;
const thSales = `${thBase} shadow-[inset_0_2px_0_0_oklch(0.68_0.15_190)]`;

interface SearchBoardTableHeaderProps {
  columnWidths: Record<string, number>;
  workspaceView: WorkspaceView;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll: () => void;
  sortConfig: { key: SortKey; dir: "asc" | "desc" } | null;
  onToggleSort: (key: SortKey) => void;
  onResizeStart: (e: React.MouseEvent, column: string) => void;
  onResetColumnWidth: (column: string) => void;
}

export function SearchBoardTableHeader({
  columnWidths,
  workspaceView,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAll,
  sortConfig,
  onToggleSort,
  onResizeStart,
  onResetColumnWidth,
}: SearchBoardTableHeaderProps) {
  const infoLabel =
    workspaceView === "profitable"
      ? "수익 옵션 (SKU)"
      : workspaceView === "sku"
        ? "전체 옵션 (SKU)"
        : "중국 시장 정보";

  return (
    <thead className="text-[11px] text-muted-foreground bg-muted sticky top-0 z-20 border-b border-border uppercase font-semibold tracking-wide">
      <tr className="h-10 align-middle">
        <th
          style={{ width: SEARCH_BOARD_INDEX_COL_PX }}
          className={`${thBase} px-0`}
          aria-label="품번 번호"
        >
          <span aria-hidden>#</span>
        </th>
        <th
          style={{ width: `${columnWidths.manage}px` }}
          className={`${thBase}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Checkbox
              aria-label="현재 페이지의 모든 옵션 선택"
              size="sm"
              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
              onCheckedChange={onToggleSelectAll}
            />
            <span>관리</span>
          </div>
          <ResizeHandle column="manage" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.info}px` }}
          className="relative group/header px-2 align-middle border-r border-border/40 bg-muted"
        >
          <span>{infoLabel}</span>
          <ResizeHandle column="info" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.poizon}px` }}
          className={thPoizon}
        >
          <div className="flex flex-col items-center justify-center leading-[1.15] gap-0.5">
            <span>POIZON</span>
            <span className="flex items-center gap-1 text-[9px] font-normal opacity-80 normal-case tracking-normal">
              <SortSubButton
                column="avg"
                label="거래가"
                sortConfig={sortConfig}
                onToggleSort={onToggleSort}
              />
              <span className="opacity-30">·</span>
              <SortSubButton
                column="exposure"
                label="노출가"
                sortConfig={sortConfig}
                onToggleSort={onToggleSort}
              />
            </span>
          </div>
          <ResizeHandle column="poizon" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.naver}px` }}
          onClick={() => onToggleSort("naver")}
          className={`${thCost} cursor-pointer hover:text-foreground transition-colors`}
        >
          <div className="flex flex-col items-center justify-center leading-[1.15]">
            <span className="flex items-center gap-1">
              최저 오퍼/원가 <SortIcon column="naver" sortConfig={sortConfig} />
            </span>
          </div>
          <ResizeHandle column="naver" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.profit}px` }}
          onClick={() => onToggleSort("profit")}
          className={`${thProfit} cursor-pointer hover:text-foreground transition-colors`}
        >
          <div className="flex flex-col items-center justify-center leading-[1.15]">
            <span className="flex items-center gap-1">
              순수익 <SortIcon column="profit" sortConfig={sortConfig} />
            </span>
            <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal">
              (실수령−원가)
            </span>
          </div>
          <ResizeHandle column="profit" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.sales}px` }}
          className={thSales}
        >
          <div className="flex flex-col items-center justify-center leading-[1.15] gap-0.5">
            <span>30일 판매량</span>
            <span className="flex items-center gap-1 text-[9px] font-normal opacity-80 normal-case tracking-normal">
              <SortSubButton
                column="salesChina"
                label="중국"
                sortConfig={sortConfig}
                onToggleSort={onToggleSort}
              />
              <span className="opacity-30">·</span>
              <SortSubButton
                column="salesLocal"
                label="현지"
                sortConfig={sortConfig}
                onToggleSort={onToggleSort}
              />
            </span>
          </div>
          <ResizeHandle column="sales" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>

        <th
          style={{ width: `${columnWidths.bid}px` }}
          className="relative group/header px-1 text-center align-middle bg-muted"
        >
          <span>나의 입찰 제안</span>
          <ResizeHandle column="bid" onResizeStart={onResizeStart} onReset={onResetColumnWidth} />
        </th>
      </tr>
    </thead>
  );
}
