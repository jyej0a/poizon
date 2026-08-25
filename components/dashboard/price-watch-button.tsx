"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_PRESS } from "@/lib/utils/motion";

export function PriceWatchButton({
  watchPrice,
  hit,
  saving,
  onToggle,
}: {
  watchPrice: number | null;
  hit: boolean;
  saving?: boolean;
  onToggle: () => void;
}) {
  const watching = watchPrice != null && watchPrice > 0;
  const label = watching
    ? hit
      ? `가격 알림 도달, 목표 ₩${watchPrice.toLocaleString()}. 클릭하여 해제`
      : `가격 알림 ₩${watchPrice.toLocaleString()} 이하. 클릭하여 해제`
    : "현재 노출가(또는 입찰 입력값)로 가격 알림 걸기";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={saving}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center w-[22px] h-[22px] rounded-md shrink-0 transition-colors disabled:opacity-40",
        ICON_PRESS,
        hit
          ? "bg-cyan-600 text-white"
          : watching
            ? "text-cyan-700 bg-cyan-500/15"
            : "text-muted-foreground/40 hover:text-cyan-700 hover:bg-cyan-500/10"
      )}
    >
      <Bell size={13} fill={hit ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
