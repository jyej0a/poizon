"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSearchJobs } from "@/app/actions/search-jobs";
import { searchJobsUnchanged } from "@/lib/search/job-list";
import { isJobActive, isQueuedUnclaimed, type SearchJob } from "@/types/search-job";

/**
 * 검색 잡 목록을 한 곳에서 폴링한다.
 *
 * Supabase Realtime을 쓰지 않는 이유: `search_jobs`는 다른 테이블과 동일하게
 * service_role 전용(RLS 정책 없음)이라 클라이언트 구독이 차단된다. 잡은 길어도 수 분이고
 * 동시 건수도 적어 폴링 비용이 무시할 만하다.
 */

const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;

interface SearchJobsStateValue {
  jobs: SearchJob[];
  activeCount: number;
  runningCount: number;
  unclaimedCount: number;
  /** 아직 열어보지 않은 완료 잡 수 (사이드바 배지) */
  unseenCount: number;
  isLoading: boolean;
  error: string | null;
}

interface SearchJobsApiValue {
  refresh: () => Promise<void>;
  markSeen: (jobId: string) => void;
  markAllSeen: () => void;
}

export type SearchJobsContextValue = SearchJobsStateValue & SearchJobsApiValue;

const SearchJobsStateContext = createContext<SearchJobsStateValue | null>(null);
const SearchJobsApiContext = createContext<SearchJobsApiValue | null>(null);

const SEEN_STORAGE_KEY = "poizon_seen_search_jobs";

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  try {
    // 무한 증가 방지: 최근 200건만 유지
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // 저장 실패는 배지 정확도에만 영향을 주므로 무시한다
  }
}

export function SearchJobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [queueClock, setQueueClock] = useState(0);

  const inFlightRef = useRef(false);
  const jobsRef = useRef<SearchJob[]>([]);

  useEffect(() => {
    setSeenIds(readSeen());
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const res = await getSearchJobs(30, "search");
      if (res.success) {
        if (!searchJobsUnchanged(jobsRef.current, res.data)) {
          jobsRef.current = res.data;
          setJobs(res.data);
        }
        setError(null);
      } else {
        setError(res.error ?? "잡 목록을 불러오지 못했습니다.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const activeCount = useMemo(() => jobs.filter((j) => isJobActive(j.status)).length, [jobs]);
  const runningCount = useMemo(() => jobs.filter((j) => j.status === "running").length, [jobs]);
  const unclaimedCount = useMemo(
    () => jobs.filter((j) => isQueuedUnclaimed(j)).length,
    [jobs, queueClock]
  );

  // 진행 중 잡이 있을 때만 짧은 주기로 폴링한다
  useEffect(() => {
    void refresh();
    const interval = activeCount > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const timer = setInterval(() => void refresh(), interval);
    return () => clearInterval(timer);
  }, [refresh, activeCount]);

  // queued 경과(45초)로 미기동 배지가 바뀌도록, 데이터 변경이 없어도 시계만 갱신
  useEffect(() => {
    if (!jobs.some((j) => j.status === "queued")) return;
    const timer = setInterval(() => setQueueClock((n) => n + 1), ACTIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [jobs]);

  // 탭으로 돌아왔을 때 즉시 최신화
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const markSeen = useCallback((jobId: string) => {
    setSeenIds((prev) => {
      if (prev.has(jobId)) return prev;
      const next = new Set(prev).add(jobId);
      persistSeen(next);
      return next;
    });
  }, []);

  const markAllSeen = useCallback(() => {
    setSeenIds(() => {
      const next = new Set(jobsRef.current.map((j) => j.id));
      persistSeen(next);
      return next;
    });
  }, []);

  const unseenCount = useMemo(
    () =>
      jobs.filter(
        (j) => !isJobActive(j.status) && j.status !== "cancelled" && !seenIds.has(j.id)
      ).length,
    [jobs, seenIds]
  );

  const stateValue = useMemo<SearchJobsStateValue>(
    () => ({
      jobs,
      activeCount,
      runningCount,
      unclaimedCount,
      unseenCount,
      isLoading,
      error,
    }),
    [jobs, activeCount, runningCount, unclaimedCount, unseenCount, isLoading, error]
  );

  const apiValue = useMemo<SearchJobsApiValue>(
    () => ({
      refresh,
      markSeen,
      markAllSeen,
    }),
    [refresh, markSeen, markAllSeen]
  );

  return (
    <SearchJobsApiContext.Provider value={apiValue}>
      <SearchJobsStateContext.Provider value={stateValue}>{children}</SearchJobsStateContext.Provider>
    </SearchJobsApiContext.Provider>
  );
}

export function useSearchJobs(): SearchJobsContextValue {
  const state = useContext(SearchJobsStateContext);
  const api = useContext(SearchJobsApiContext);
  if (!state || !api) {
    throw new Error("useSearchJobs는 SearchJobsProvider 내부에서만 사용할 수 있습니다.");
  }
  return { ...state, ...api };
}

/** 잡 목록 변경에 리렌더되지 않는다. 등록 직후 갱신 등 명령만 필요할 때 쓴다. */
export function useSearchJobsRefresh(): () => Promise<void> {
  const api = useContext(SearchJobsApiContext);
  if (!api) {
    throw new Error("useSearchJobsRefresh는 SearchJobsProvider 내부에서만 사용할 수 있습니다.");
  }
  return api.refresh;
}
