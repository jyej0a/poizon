"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Compass, Loader2 } from "lucide-react";
import { enqueueDiscoveryJob } from "@/app/actions/search-jobs";
import { getSystemSettings } from "@/app/actions/settings";
import { SearchJobsBoard } from "@/components/dashboard/search-jobs-board";
import { highProfitFloor } from "@/lib/utils/high-profit";
import { DISCOVERY_DEFAULT_MIN_SALES_VOLUME } from "@/types/search-job";

export function DiscoveryBoard() {
  const [keyword, setKeyword] = useState("");
  const [minNetProfit, setMinNetProfit] = useState("");
  const [minSalesVolume, setMinSalesVolume] = useState(String(DISCOVERY_DEFAULT_MIN_SALES_VOLUME));
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    void getSystemSettings().then((res) => {
      if (!res.success || !res.data) return;
      const floor = highProfitFloor(res.data);
      setMinNetProfit((prev) => (prev === "" && floor != null ? String(floor) : prev));
    });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const profit = Number(minNetProfit.replace(/[^0-9]/g, ""));
    const sales = Number(minSalesVolume.replace(/[^0-9]/g, ""));
    setIsEnqueuing(true);
    setError(null);
    try {
      const res = await enqueueDiscoveryJob({
        keyword,
        minNetProfit: profit,
        minSalesVolume: Number.isFinite(sales) ? sales : DISCOVERY_DEFAULT_MIN_SALES_VOLUME,
      });
      if (!res.success) {
        setError(res.error ?? "발굴 작업을 등록하지 못했습니다.");
        return;
      }
      setRefreshToken((n) => n + 1);
    } finally {
      setIsEnqueuing(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-2 w-full min-h-0">
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        className="glass-panel border border-secondary/40 rounded-xl p-5 shrink-0"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Compass size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">아이템 발굴</h2>
            <p className="text-sm text-muted-foreground">
              브랜드를 백그라운드로 스캔해, 유통·인기·순수익 하한을 통과한 품번만 모읍니다. 결과에서 바로 입찰할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[160px] flex-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">브랜드</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: Nike"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              required
            />
          </label>
          <label className="flex flex-col gap-1 w-[140px]">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">순수익 하한 (원)</span>
            <input
              inputMode="numeric"
              value={minNetProfit}
              onChange={(e) => setMinNetProfit(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="30000"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary font-mono"
              required
            />
          </label>
          <label className="flex flex-col gap-1 w-[140px]">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">중국 30일 판매</span>
            <input
              inputMode="numeric"
              value={minSalesVolume}
              onChange={(e) => setMinSalesVolume(e.target.value.replace(/[^0-9]/g, ""))}
              title="0이면 판매량 조건을 끕니다"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={isEnqueuing}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 motion-safe:active:scale-[0.98]"
            aria-label="발굴 백그라운드 시작"
          >
            {isEnqueuing ? <Loader2 size={13} className="animate-spin" /> : null}
            백그라운드 시작
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            판매량 0은 인기 조건을 끕니다. 합격 품번만 최대 500개까지 적재합니다.
          </p>
        )}
      </form>

      <div className="flex-1 min-h-0">
        <SearchJobsBoard
          purpose="discovery"
          resultBasePath="/dashboard/discover"
          title="발굴 작업"
          description="화면을 닫아도 워커가 조건을 통과한 품번만 모읍니다. 결과 보기는 새 탭에서 열립니다."
          emptyTitle="등록된 발굴 작업이 없습니다."
          emptyHint="위에서 브랜드와 순수익 하한을 넣고 시작하세요."
          showPushBanner={false}
          refreshToken={refreshToken}
        />
      </div>
    </div>
  );
}
