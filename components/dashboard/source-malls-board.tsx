"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  checkAllSourceMalls,
  checkSourceMall,
  listSourceMalls,
  moveSourceMall,
  purgeSourceOfferCache,
  toggleSourceMallActive,
} from "@/app/actions/source-malls";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/utils/format-date";
import {
  SOURCE_MALL_CHECK_LABEL,
  type SourceMallCheckStatus,
  type SourceMallView,
} from "@/types/source-mall";

const DEFAULT_PROBE_ARTICLE = "TLTCM26521";

type FilterTab = "all" | "active" | "inactive";

function CheckBadge({ status }: { status: SourceMallCheckStatus | null }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  const styles: Record<SourceMallCheckStatus, string> = {
    ok: "bg-emerald-500/10 text-emerald-600",
    empty: "bg-amber-500/10 text-amber-700",
    failed: "bg-red-500/10 text-red-600",
  };
  const icons: Record<SourceMallCheckStatus, React.ReactNode> = {
    ok: <CheckCircle2 size={12} />,
    empty: <AlertTriangle size={12} />,
    failed: <XCircle size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${styles[status]}`}>
      {icons[status]}
      {SOURCE_MALL_CHECK_LABEL[status]}
    </span>
  );
}

export function SourceMallsBoard() {
  const [malls, setMalls] = useState<SourceMallView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [probeArticle, setProbeArticle] = useState(DEFAULT_PROBE_ARTICLE);
  const [probingKeys, setProbingKeys] = useState<Set<string>>(new Set());
  const [isProbingAll, setIsProbingAll] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchMalls = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listSourceMalls();
      if (res.success && res.data) {
        setMalls(res.data);
      } else {
        setError(res.error ?? "수집 몰 목록을 불러오지 못했습니다.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMalls();
  }, []);

  const filteredMalls = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return malls.filter((mall) => {
      if (filter === "active" && !mall.is_active) return false;
      if (filter === "inactive" && mall.is_active) return false;
      if (!query) return true;
      return (
        mall.label.toLowerCase().includes(query) ||
        mall.key.toLowerCase().includes(query) ||
        (mall.notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [malls, filter, searchQuery]);

  const activeCount = malls.filter((mall) => mall.is_active).length;
  const limitedCount = malls.filter((mall) => mall.reliability === "limited").length;

  const withProbing = (keys: string[], running: boolean) => {
    setProbingKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (running) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const applyProbeResults = async () => {
    const res = await listSourceMalls();
    if (res.success && res.data) setMalls(res.data);
  };

  const handleToggle = async (mall: SourceMallView) => {
    const nextActive = !mall.is_active;
    setMalls((prev) =>
      prev.map((item) => (item.key === mall.key ? { ...item, is_active: nextActive } : item))
    );
    const res = await toggleSourceMallActive(mall.key, nextActive);
    if (!res.success) {
      setMalls((prev) =>
        prev.map((item) => (item.key === mall.key ? { ...item, is_active: mall.is_active } : item))
      );
      alert(res.error ?? "활성 상태를 바꾸지 못했습니다.");
    }
  };

  const handleMove = async (key: string, direction: "up" | "down") => {
    setBusyKey(key);
    try {
      const res = await moveSourceMall(key, direction);
      if (res.success && res.data) {
        setMalls(res.data);
      } else {
        alert(res.error ?? "순서를 바꾸지 못했습니다.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleProbe = async (key: string) => {
    const article = probeArticle.trim();
    if (!article) {
      alert("점검할 품번을 입력하세요.");
      return;
    }
    withProbing([key], true);
    try {
      const res = await checkSourceMall(key, article);
      if (!res.success) {
        alert(res.error ?? "점검에 실패했습니다.");
        return;
      }
      await applyProbeResults();
    } finally {
      withProbing([key], false);
    }
  };

  const handleProbeAll = async () => {
    const article = probeArticle.trim();
    if (!article) {
      alert("점검할 품번을 입력하세요.");
      return;
    }
    const keys = filteredMalls.filter((mall) => mall.hasParser).map((mall) => mall.key);
    if (keys.length === 0) return;

    setIsProbingAll(true);
    withProbing(keys, true);
    try {
      const res = await checkAllSourceMalls(article, keys);
      if (!res.success) {
        alert(res.error ?? "전체 점검에 실패했습니다.");
        return;
      }
      await applyProbeResults();
    } finally {
      withProbing(keys, false);
      setIsProbingAll(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm("저장된 원가 캐시를 모두 지울까요? 다음 검색부터 활성 몰 기준으로 다시 수집합니다.")) {
      return;
    }
    setIsPurging(true);
    try {
      const res = await purgeSourceOfferCache();
      if (res.success) {
        alert(`원가 캐시 ${res.deleted ?? 0}건을 비웠습니다.`);
      } else {
        alert(res.error ?? "캐시를 비우지 못했습니다.");
      }
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-2 w-full animate-in fade-in duration-300">
      <div className="bg-card border border-secondary/40 rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Store size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">수집 몰</h2>
              <p className="text-sm text-muted-foreground">
                원가 오퍼를 가져올 쇼핑몰을 켜고 끌 수 있습니다. 새 몰은 파서를 추가한 뒤 이 목록에 나타납니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
              활성 {activeCount}/{malls.length}
            </span>
            {limitedCount > 0 && (
              <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                제한적 {limitedCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => void fetchMalls()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-secondary/40 hover:bg-secondary transition-colors"
            >
              <RefreshCw size={13} />
              새로고침
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="몰 이름 또는 식별자 검색..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-secondary/20 border border-secondary/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex bg-secondary/20 p-1 rounded-lg">
              {(
                [
                  ["all", "전체"],
                  ["active", "활성"],
                  ["inactive", "꺼짐"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    filter === value ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="text"
              value={probeArticle}
              onChange={(event) => setProbeArticle(event.target.value)}
              placeholder="점검 품번"
              aria-label="점검 품번"
              className="w-full sm:w-40 px-3 py-2 bg-secondary/20 border border-secondary/40 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => void handleProbeAll()}
              disabled={isProbingAll || filteredMalls.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isProbingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              전체 점검
            </button>
            <button
              type="button"
              onClick={() => void handlePurgeCache()}
              disabled={isPurging}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-secondary/40 hover:bg-secondary disabled:opacity-50 transition-colors"
            >
              {isPurging ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              원가 캐시 비우기
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          몰을 켜거나 끈 뒤에는 기존 원가 캐시(1시간)에 바로 반영되지 않을 수 있습니다. 즉시 반영하려면 캐시를 비우세요.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex-1 bg-card border border-secondary/40 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 grid place-items-center py-24">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredMalls.length === 0 ? (
          <div className="flex-1 grid place-items-center py-24">
            <div className="flex flex-col items-center text-muted-foreground opacity-60">
              <Store className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium">표시할 수집 몰이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/20 text-muted-foreground border-b border-secondary/30">
                <tr>
                  <th className="px-4 py-4 font-bold tracking-wider w-16 text-center">순서</th>
                  <th className="px-4 py-4 font-bold tracking-wider">몰</th>
                  <th className="px-4 py-4 font-bold tracking-wider text-center">수집</th>
                  <th className="px-4 py-4 font-bold tracking-wider">품질</th>
                  <th className="px-4 py-4 font-bold tracking-wider">최근 점검</th>
                  <th className="px-4 py-4 font-bold tracking-wider">비고</th>
                  <th className="px-4 py-4 font-bold tracking-wider text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary/20">
                {filteredMalls.map((mall, index) => {
                  const isProbing = probingKeys.has(mall.key);
                  const isBusy = busyKey === mall.key;
                  return (
                    <tr
                      key={mall.key}
                      className={`hover:bg-secondary/10 transition-colors ${mall.is_active ? "" : "opacity-55"}`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            aria-label={`${mall.label} 위로`}
                            disabled={index === 0 || isBusy || filter !== "all" || Boolean(searchQuery.trim())}
                            onClick={() => void handleMove(mall.key, "up")}
                            className="p-1 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-20 disabled:hover:bg-transparent"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label={`${mall.label} 아래로`}
                            disabled={
                              index === filteredMalls.length - 1 ||
                              isBusy ||
                              filter !== "all" ||
                              Boolean(searchQuery.trim())
                            }
                            onClick={() => void handleMove(mall.key, "down")}
                            className="p-1 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-20 disabled:hover:bg-transparent"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary/40 border border-secondary/20 flex items-center justify-center text-primary shrink-0">
                            <Store size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">{mall.label}</span>
                              {mall.homepage && (
                                <a
                                  href={mall.homepage}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${mall.label} 사이트 열기`}
                                  className="text-muted-foreground/60 hover:text-primary"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">{mall.key}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={mall.is_active}
                            onCheckedChange={() => void handleToggle(mall)}
                            aria-label={`${mall.label} 수집 ${mall.is_active ? "끄기" : "켜기"}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {mall.hasParser ? (
                          mall.reliability === "limited" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700">
                              제한적
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600">
                              정상
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary text-muted-foreground">
                            파서 없음
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <CheckBadge status={mall.last_check_status} />
                          <span className="text-[11px] text-muted-foreground">
                            {mall.last_check_message || formatDateTime(mall.last_checked_at)}
                          </span>
                          {mall.last_checked_at && mall.last_check_message && (
                            <span className="text-[10px] text-muted-foreground/70">
                              {formatDateTime(mall.last_checked_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground max-w-xs">
                        {mall.notes || <span className="text-muted-foreground/30 italic">없음</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => void handleProbe(mall.key)}
                          disabled={!mall.hasParser || isProbing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 hover:bg-secondary text-foreground rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                        >
                          {isProbing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          연결 점검
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
