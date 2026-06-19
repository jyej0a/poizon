"use client";

import { Home, X } from "lucide-react";

interface StockStatusIndicatorProps {
  date: string;
  variant?: "compact" | "badge";
  iconSize?: number;
  onClick?: () => void;
  removable?: boolean;
}

export function StockStatusIndicator({
  date,
  variant = "compact",
  iconSize = 13,
  onClick,
  removable = false,
}: StockStatusIndicatorProps) {
  const showIcon = variant === "compact";
  const showBadge = variant === "badge";
  const interactive = removable && !!onClick;
  const undoHint = interactive ? " · 클릭하여 해제" : "";
  const tooltip = `재고 보유 표기 · ${date}${undoHint}`;

  const iconEl = (
    <div
      className={`relative group/stock-mark ${interactive ? "cursor-pointer" : "cursor-help"}`}
      title={tooltip}
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
    >
      <div
        className={`flex items-center justify-center w-[22px] h-[22px] rounded-md text-white shadow-sm ring-2 transition-colors bg-emerald-600 ring-emerald-400/40 hover:bg-emerald-500 ${interactive ? "group-hover/stock-mark:ring-emerald-300" : ""}`}
      >
        <Home size={iconSize} strokeWidth={2.5} />
        {interactive && (
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 group-hover/stock-mark:opacity-100 transition-opacity">
            <X size={iconSize - 2} strokeWidth={3} />
          </span>
        )}
      </div>
      {!interactive && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/stock-mark:block z-[60] animate-in fade-in slide-in-from-left-1 duration-200 pointer-events-none">
          <div className="text-white text-[10px] px-2.5 py-1.5 rounded-md shadow-xl whitespace-nowrap font-bold flex items-center gap-1.5 border bg-emerald-950 border-emerald-400/30">
            <Home size={10} className="opacity-80" />
            {tooltip}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-emerald-950" />
        </div>
      )}
    </div>
  );

  const badgeEl = showBadge && (
    <span
      title={tooltip}
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
      className={`text-[8px] px-1.5 py-0.5 rounded-md text-white font-bold shrink-0 flex items-center gap-0.5 whitespace-nowrap shadow-sm bg-emerald-600 hover:bg-emerald-500 ${interactive ? "cursor-pointer ring-1 ring-transparent hover:ring-emerald-300/60" : ""}`}
    >
      <Home size={8} />
      재고보유
    </span>
  );

  if (showBadge) return badgeEl;
  return iconEl;
}
