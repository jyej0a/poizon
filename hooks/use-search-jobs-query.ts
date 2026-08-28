"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSearchJobs } from "@/app/actions/search-jobs";
import { searchJobsUnchanged } from "@/lib/search/job-list";
import { isJobActive, isQueuedUnclaimed, type SearchJob, type SearchJobPurpose } from "@/types/search-job";

const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;

export function useSearchJobsQuery(purpose: SearchJobPurpose, enabled = true) {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const jobsRef = useRef<SearchJob[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      const res = await getSearchJobs(30, purpose);
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
      if (pendingRef.current) {
        pendingRef.current = false;
        void refresh();
      }
    }
  }, [purpose, enabled]);

  const activeCount = useMemo(() => jobs.filter((j) => isJobActive(j.status)).length, [jobs]);
  const runningCount = useMemo(() => jobs.filter((j) => j.status === "running").length, [jobs]);
  const unclaimedCount = useMemo(() => jobs.filter((j) => isQueuedUnclaimed(j)).length, [jobs]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void refresh();
    const interval = activeCount > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const timer = setInterval(() => void refresh(), interval);
    return () => clearInterval(timer);
  }, [refresh, activeCount, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, enabled]);

  return { jobs, isLoading, error, refresh, activeCount, runningCount, unclaimedCount };
}
