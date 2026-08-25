"use client";

import { Sparkles } from "lucide-react";
import { formatSignedWon } from "@/lib/utils/format-signed-won";

export function ProfitStack({
  profit,
  fee,
  compact,
  highProfit,
}: {
  profit: number;
  fee: number;
  compact?: boolean;
  highProfit?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center leading-none gap-0.5 ${
        highProfit ? "rounded-md px-1 py-0.5 bg-violet-500/[0.10]" : ""
      }`}
      aria-label={highProfit ? `효자 상품, 순수익 ${formatSignedWon(profit)}` : undefined}
    >
      <span
        className={`font-bold ${compact ? "text-[11px]" : "text-[12px]"} ${
          highProfit
            ? "text-violet-700"
            : profit > 0
              ? "text-blue-600"
              : profit < 0
                ? "text-destructive"
                : "text-muted-foreground"
        }`}
      >
        {formatSignedWon(profit)}
      </span>
      <span
        className={`text-[9px] font-bold ${
          highProfit ? "text-violet-600/80 inline-flex items-center gap-0.5" : "text-muted-foreground/40"
        }`}
      >
        {highProfit ? (
          <>
            <Sparkles size={10} aria-hidden />
            효자 · ₩{fee.toLocaleString()}
          </>
        ) : (
          <>수수료 ₩{fee.toLocaleString()}</>
        )}
      </span>
    </div>
  );
}
