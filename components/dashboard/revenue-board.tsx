"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import { getOrdersAcrossRange } from "@/app/actions/orders";
import { getSystemSettings } from "@/app/actions/settings";
import { formatWonAmount } from "@/lib/utils/exposure-price";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/utils/calculate-margin";
import { aggregateOrderRevenue } from "@/lib/utils/order-revenue";
import { defaultOrderWindow, normalizeOrderRange, orderStatusMeta } from "@/lib/utils/poizon-order";

export function RevenueBoard() {
  const initial = defaultOrderWindow(new Date(), 30);
  const [startLocal, setStartLocal] = useState(initial.start);
  const [endLocal, setEndLocal] = useState(initial.end);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [summary, setSummary] = useState(() => aggregateOrderRevenue([], DEFAULT_SYSTEM_SETTINGS));

  const load = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    const range = normalizeOrderRange(startLocal, endLocal);
    const [ordersResult, settingsResult] = await Promise.all([
      getOrdersAcrossRange({ start: range.start, end: range.end }),
      getSystemSettings(),
    ]);
    const nextSettings = settingsResult.data ?? DEFAULT_SYSTEM_SETTINGS;
    setSettings(nextSettings);
    if (ordersResult.success) {
      setSummary(aggregateOrderRevenue(ordersResult.data, nextSettings));
    } else {
      setApiError(ordersResult.error || "주문을 불러오지 못했습니다.");
      setSummary(aggregateOrderRevenue([], nextSettings));
    }
    setIsLoading(false);
  }, [endLocal, startLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDay = useMemo(
    () => Math.max(1, ...summary.byDay.map((row) => row.gmv)),
    [summary.byDay]
  );

  const applyPreset = (days: number) => {
    const window = defaultOrderWindow(new Date(), days);
    setStartLocal(window.start);
    setEndLocal(window.end);
  };

  return (
    <div className="h-full flex flex-col gap-3 w-full min-h-0">
      <div className="glass-panel border border-secondary/40 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <label className="text-[11px] font-medium text-muted-foreground space-y-1">
          시작
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="block h-8 px-2 bg-secondary/30 rounded-lg text-[12px] outline-none"
          />
        </label>
        <label className="text-[11px] font-medium text-muted-foreground space-y-1">
          종료
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className="block h-8 px-2 bg-secondary/30 rounded-lg text-[12px] outline-none"
          />
        </label>
        <div className="flex gap-1 pb-1.5">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => applyPreset(days)}
              className="h-8 px-2 text-[11px] border border-secondary rounded-lg hover:bg-secondary font-medium"
            >
              {days}일
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="h-8 px-3 border border-secondary rounded-lg text-[12px] font-medium hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          조회
        </button>
        <p className="text-[11px] text-muted-foreground pb-1.5">
          주문 금액을 7일 단위로 모아 집계합니다. 원가는 포함하지 않습니다.
        </p>
      </div>

      {apiError && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-[12px] text-orange-700">
          <AlertCircle size={14} />
          <span className="flex-1">{apiError}</span>
          <button type="button" onClick={() => setApiError(null)} className="hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 glass-panel border border-secondary/40 rounded-xl grid place-items-center text-muted-foreground">
          <div className="text-center">
            <Loader2 size={28} className="animate-spin opacity-30 mx-auto mb-3" />
            <p className="text-[13px] opacity-40">집계하는 중...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="주문" value={`${summary.orderCount}건`} />
            <Metric label="체결 매출" value={formatWonAmount(summary.gmv)} />
            <Metric
              label={summary.feeEstimated ? "추정 수수료" : "플랫폼 수수료"}
              value={formatWonAmount(summary.fee)}
              hint={
                summary.orderCount === 0
                  ? undefined
                  : summary.feeEstimated
                    ? `설정 요율 ${settings.fee_percentage}%`
                    : "poundage_detail"
              }
            />
            <Metric label="추정 실수령" value={formatWonAmount(summary.net)} hint="매출 − 수수료. 원가 미차감" />
          </div>
          <div className="grid lg:grid-cols-2 gap-3 flex-1 min-h-0">
            <div className="glass-panel border border-secondary/40 rounded-xl p-4 min-h-[220px]">
              <h2 className="text-sm font-semibold mb-3">일별 매출</h2>
              {summary.byDay.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">이 구간에 주문이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.byDay.map((row) => (
                    <li key={row.day} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[88px] font-mono text-muted-foreground shrink-0">{row.day}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${Math.max(4, (row.gmv / maxDay) * 100)}%` }}
                        />
                      </div>
                      <span className="w-[92px] text-right font-mono">{formatWonAmount(row.gmv)}</span>
                      <span className="w-10 text-right text-muted-foreground">{row.count}건</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="glass-panel border border-secondary/40 rounded-xl p-4 min-h-[220px]">
              <h2 className="text-sm font-semibold mb-3">상태별</h2>
              {summary.byStatus.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">집계할 주문이 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-[12px]">
                  {summary.byStatus.map((row) => {
                    const meta = orderStatusMeta(row.status);
                    return (
                      <li key={row.status} className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-muted-foreground">{row.count}건</span>
                        <span className="font-mono">{formatWonAmount(row.gmv)}</span>
                      </li>
                    );
                  })}
                  <li className="flex items-center justify-between gap-3 pt-2 border-t text-muted-foreground">
                    <span>거래 성공만</span>
                    <span>{summary.successCount}건</span>
                    <span className="font-mono text-foreground">{formatWonAmount(summary.successGmv)}</span>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-panel border border-secondary/40 rounded-xl p-4">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="text-xl font-bold tracking-tight mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
