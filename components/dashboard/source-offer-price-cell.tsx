"use client";

import { Loader2 } from "lucide-react";
import type { SourceOffer } from "@/types/source-offer";

interface SourceOfferPriceCellProps {
  item?: SourceOffer | null;
  loading?: boolean;
  emptyClassName?: string;
  onOpen?: () => void;
}

export function SourceOfferPriceCell({
  item,
  loading,
  emptyClassName = "opacity-20",
  onOpen,
}: SourceOfferPriceCellProps) {
  if (loading) {
    return <Loader2 size={12} className="animate-spin opacity-40" aria-hidden="true" />;
  }

  if (!item) {
    return <span className={emptyClassName}>—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${item.sourceLabel} 오퍼 목록 보기`}
        className="hover:underline flex items-center gap-1 cursor-pointer"
      >
        ₩{item.price.toLocaleString()}
      </button>
      <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">{item.sourceLabel}</span>
    </>
  );
}
