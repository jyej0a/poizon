"use client";

import type { RecommendBidPriceData } from "@/types/recommend-bid-price";
import {
  formatWonAmount,
  getExposurePriceBreakdown,
} from "@/lib/utils/exposure-price";

function HintShell({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  return (
    <div className="relative group/exposure-hint">
      {children}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover/exposure-hint:block z-[60] animate-in fade-in slide-in-from-top-1 duration-150 pointer-events-none">
        {content}
      </div>
    </div>
  );
}

function HintCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950/88 backdrop-blur-xl text-white text-[10px] px-2.5 py-2 rounded-md shadow-xl border border-white/10 min-w-[168px] text-left font-medium">
      {children}
    </div>
  );
}

function HintRow({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${current ? "text-orange-200" : "text-white/80"}`}>
      <span className="font-normal opacity-80 shrink-0">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

export function SkuExposureHint({
  rec,
  loading,
  displayValue,
  children,
}: {
  rec: RecommendBidPriceData | null | undefined;
  loading?: boolean;
  displayValue: string;
  children: React.ReactNode;
}) {
  const breakdown = getExposurePriceBreakdown(rec);
  const leak = formatWonAmount(breakdown.leakPrice) !== "—"
    ? formatWonAmount(breakdown.leakPrice)
    : displayValue;
  const minBid = formatWonAmount(breakdown.globalMinPrice);
  const opportunity = formatWonAmount(breakdown.effectiveExposurePrice);

  const content = (
    <HintCard>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-white/50 mb-1.5">
        중국 노출가
      </div>
      {loading && !rec ? (
        <p className="font-normal text-white/70">추천가 조회 중</p>
      ) : (
        <div className="space-y-1">
          <HintRow label="노출 보장" value={leak} current />
          <HintRow label="최저 입찰가" value={minBid} />
          {opportunity !== "—" && <HintRow label="기회 확대" value={opportunity} />}
        </div>
      )}
      <p className="mt-1.5 font-normal text-white/45 leading-snug">
        클릭하면 노출 보장가로 입찰가를 채웁니다
      </p>
    </HintCard>
  );

  return <HintShell content={content}>{children}</HintShell>;
}

export function SpuExposureHint({
  displayValue,
  children,
}: {
  displayValue: string;
  children: React.ReactNode;
}) {
  const content = (
    <HintCard>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-white/50 mb-1.5">
        접힌 품번 노출가
      </div>
      <div className="space-y-1">
        <HintRow label="통계 최저가" value={displayValue || "—"} current />
      </div>
      <p className="mt-1.5 font-normal text-white/45 leading-snug">
        옵션 행은 추천 API 노출 보장(leakPrice)이라 숫자가 다를 수 있습니다
      </p>
    </HintCard>
  );

  return <HintShell content={content}>{children}</HintShell>;
}
