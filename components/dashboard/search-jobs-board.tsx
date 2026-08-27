"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  cancelSearchJob,
  deleteSearchJob,
  retrySearchJob,
} from "@/app/actions/search-jobs";
import { SearchJobPushBanner } from "@/components/dashboard/search-job-push-banner";
import { useSearchJobs } from "@/components/providers/search-jobs-provider";
import { formatDateTime } from "@/lib/utils/format-date";
import { hasJobResults, isJobActive, JOB_STATUS_LABEL, type SearchJob } from "@/types/search-job";

const STATUS_STYLES: Record<SearchJob["status"], { badge: string; icon: React.ReactNode }> = {
  queued: {
    badge: "bg-secondary/50 text-muted-foreground",
    icon: <Clock size={13} />,
  },
  running: {
    badge: "bg-blue-500/10 text-blue-600",
    icon: <Loader2 size={13} className="animate-spin" />,
  },
  done: {
    badge: "bg-emerald-500/10 text-emerald-600",
    icon: <CheckCircle2 size={13} />,
  },
  partial: {
    badge: "bg-amber-500/10 text-amber-600",
    icon: <AlertTriangle size={13} />,
  },
  failed: {
    badge: "bg-red-500/10 text-red-600",
    icon: <XCircle size={13} />,
  },
  cancelled: {
    badge: "bg-secondary/40 text-muted-foreground/70",
    icon: <Ban size={13} />,
  },
};

function StatusBadge({ status }: { status: SearchJob["status"] }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}
    >
      {style.icon}
      {JOB_STATUS_LABEL[status]}
    </span>
  );
}

function ProgressBar({ job }: { job: SearchJob }) {
  if (!isJobActive(job.status)) return null;

  const hasTotal = job.progressTotal > 0;
  const percent = hasTotal
    ? Math.min(100, Math.round((job.progressDone / job.progressTotal) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-semibold">{job.stage ?? "대기 중"}</span>
        {hasTotal && (
          <span className="font-mono">
            {job.progressDone}/{job.progressTotal}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <div
          className={`h-full bg-primary transition-all duration-500 ${hasTotal ? "" : "animate-pulse w-1/3"}`}
          style={hasTotal ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  );
}

export function SearchJobsBoard() {
  const { jobs, isLoading, error, refresh, markAllSeen, activeCount, runningCount, unclaimedCount } = useSearchJobs();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runAction = async (jobId: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(jobId);
    try {
      const res = await action();
      if (!res.success) alert(res.error ?? "처리에 실패했습니다.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-2 w-full animate-in fade-in duration-300">
      <div className="glass-panel border border-secondary/40 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Inbox size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">검색 작업</h2>
            <p className="text-sm text-muted-foreground">
                화면을 닫아도 워커가 손 안 댄 품번을 최대 500개까지 모읍니다. 결과 보기는 새 탭에서 열리며, 여러 작업을 동시에 두고 전환할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {runningCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-500/10 px-3 py-1.5 rounded-lg">
              <Loader2 size={13} className="animate-spin" />
              {runningCount}건 진행 중
            </span>
          ) : unclaimedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-500/10 px-3 py-1.5 rounded-lg">
              <Clock size={13} />
              {unclaimedCount}건 대기 (워커 없음)
            </span>
          ) : activeCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-500/10 px-3 py-1.5 rounded-lg">
              <Clock size={13} />
              {activeCount}건 대기
            </span>
          ) : null}
          <button
            type="button"
            onClick={markAllSeen}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-secondary/40 hover:bg-secondary text-foreground/70 transition-colors"
          >
            모두 확인 처리
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-secondary/40 hover:bg-secondary transition-colors"
          >
            <RefreshCw size={13} />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <SearchJobPushBanner />

      {unclaimedCount > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/25 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <p className="font-bold">대기 중인 검색을 집어갈 워커가 없습니다.</p>
          <p className="text-[13px] mt-1 leading-relaxed text-amber-800/80">
            로컬은 <code className="font-mono font-bold">pnpm dev</code>가 워커를 같이 켭니다.
            이미 Next만 켜 둔 상태면 개발 서버를 재시작하거나 터미널에서{" "}
            <code className="font-mono font-bold">pnpm worker</code>를 켜 두세요.
            배포 환경은 Vercel Cron과 <code className="font-mono">CRON_SECRET</code>을 확인하세요.
          </p>
        </div>
      )}

      <div className="flex-1 glass-panel border border-secondary/40 rounded-xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 grid place-items-center py-24">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex-1 grid place-items-center py-24">
            <div className="flex flex-col items-center text-muted-foreground opacity-60">
              <Inbox className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium">등록된 검색 작업이 없습니다.</p>
              <p className="text-xs mt-1">검색 화면에서 &lsquo;백그라운드 검색&rsquo;으로 등록하세요.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/20 text-muted-foreground border-b border-secondary/30">
                <tr>
                  <th className="px-5 py-3.5 font-bold tracking-wider">검색어</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider">상태</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider">진행</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-center">결과</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-center">등록 시각</th>
                  <th className="px-5 py-3.5 font-bold tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary/20">
                {jobs.map((job) => {
                  const busy = busyId === job.id;
                  const expanded = expandedId === job.id;
                  const detailAvailable = job.warnings.length > 0 || !!job.error;

                  return (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-secondary/10 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                job.type === "brand"
                                  ? "bg-violet-500/10 text-violet-600"
                                  : "bg-sky-500/10 text-sky-600"
                              }`}
                            >
                              {job.type === "brand" ? "브랜드" : "품번"}
                            </span>
                            <span className="font-mono font-bold text-foreground line-clamp-1 max-w-[280px]">
                              {job.keyword}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={job.status} />
                            {job.retryCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                재시도 {job.retryCount}/{job.maxRetries}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {isJobActive(job.status) ? (
                            <ProgressBar job={job} />
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-black text-foreground">{job.itemCount}</span>
                            {job.excludedCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {job.excludedCount}건 제외
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(job.createdAt)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasJobResults(job) && (
                              <Link
                                href={`/dashboard/jobs/${job.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="새 탭에서 열기"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
                              >
                                결과 보기
                                <ChevronRight size={13} />
                              </Link>
                            )}

                            {isJobActive(job.status) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(job.id, () => cancelSearchJob(job.id))
                                }
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                                title="취소"
                                aria-label="검색 작업 취소"
                              >
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                              </button>
                            )}

                            {!isJobActive(job.status) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(job.id, () => retrySearchJob(job.id))}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                                title="다시 실행"
                                aria-label="검색 작업 다시 실행"
                              >
                                {busy ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!confirm("이 검색 작업과 모아 둔 상품 목록을 삭제할까요?\n검토·메모 기록은 남지만, 사진과 가격은 다시 불러올 수 없습니다.")) return;
                                void runAction(job.id, () => deleteSearchJob(job.id));
                              }}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                              title="삭제"
                              aria-label="검색 작업 삭제"
                            >
                              <Trash2 size={14} />
                            </button>

                            {detailAvailable && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : job.id)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-amber-600 transition-colors"
                                title="상세 사유"
                                aria-label="검색 작업 상세 사유"
                              >
                                <AlertTriangle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expanded && detailAvailable && (
                        <tr className="bg-secondary/10">
                          <td colSpan={6} className="px-5 py-4">
                            {job.error && (
                              <p className="text-xs font-bold text-red-600 mb-2">{job.error}</p>
                            )}
                            {job.warnings.length > 0 && (
                              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                                {job.warnings.slice(0, 20).map((warning, index) => (
                                  <li key={index}>{warning}</li>
                                ))}
                                {job.warnings.length > 20 && (
                                  <li className="list-none opacity-60">
                                    … 외 {job.warnings.length - 20}건
                                  </li>
                                )}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
