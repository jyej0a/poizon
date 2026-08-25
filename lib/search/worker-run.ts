/**
 * 검색 잡 워커 코어.
 * 로컬 `pnpm worker` 루프와 `/api/cron/search-worker`가 동일한 claim·처리 경로를 쓴다.
 */

import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";
import { runSearchJobChunk, type ProgressUpdate } from "@/lib/search/run-search-job";
import { toStoredSearchItem } from "@/lib/search/search-item";
import * as jobStore from "@/lib/search/job-store";
import {
  SEARCH_JOB_MAX_ITEMS,
  type SearchJob,
  type SearchJobOptions,
} from "@/types/search-job";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 진행률 DB 반영 최소 간격. 아이템마다 쓰면 왕복이 과하다 */
const PROGRESS_FLUSH_MS = 1_000;

export interface WorkerTickResult {
  reclaimed: number;
  processed: boolean;
  jobId: string | null;
  status: "idle" | "done" | "partial" | "requeued" | "failed" | "continue";
  detail?: string;
}

function createProgressWriter(
  supabase: SupabaseClient,
  jobId: string,
  onWarn?: (message: string) => void
) {
  let pending: ProgressUpdate | null = null;
  let lastFlushedAt = 0;

  const write = async (update: ProgressUpdate) => {
    try {
      await jobStore.updateJobProgress(supabase, jobId, update);
    } catch (error) {
      onWarn?.(`진행률 갱신 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return {
    async report(update: ProgressUpdate) {
      pending = { ...pending, ...update };

      const now = Date.now();
      const isStageChange = update.stage !== undefined;
      if (!isStageChange && now - lastFlushedAt < PROGRESS_FLUSH_MS) return;

      const payload = pending;
      pending = null;
      lastFlushedAt = now;
      await write(payload);
    },
    async flush() {
      if (!pending) return;
      const payload = pending;
      pending = null;
      await write(payload);
    },
  };
}

function mergeWarnings(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  const next = [...existing];
  for (const warning of incoming) {
    if (seen.has(warning)) continue;
    seen.add(warning);
    next.push(warning);
  }
  return next;
}

async function processOneChunk(
  supabase: SupabaseClient,
  job: SearchJob,
  userId: string,
  onLog: (message: string) => void
): Promise<{
  status: "done" | "partial" | "continue" | "requeued" | "failed";
  job: SearchJob;
  detail: string;
}> {
  const label = `${job.type}:${job.keyword}`;
  const maxItems = job.options.maxItems ?? SEARCH_JOB_MAX_ITEMS;
  if (job.itemCount >= maxItems) {
    const status = job.warnings.length > 0 ? "partial" : "done";
    await jobStore.finishJob(supabase, job.id, {
      status,
      itemCount: job.itemCount,
      excludedCount: job.excludedCount,
      warnings: job.warnings,
      stage: null,
    });
    return { status, job, detail: `${status}, 상한 ${maxItems}건` };
  }

  const progress = createProgressWriter(supabase, job.id, (msg) => onLog(msg));

  try {
    const poizon = await createPoizonClientForUser(supabase, userId);
    const alreadyKept = job.itemCount;

    const outcome = await runSearchJobChunk(
      {
        id: job.id,
        type: job.type,
        keyword: job.keyword,
        options: job.options,
      },
      {
        supabase,
        poizon,
        userId,
        alreadyKept,
        onProgress: (update) => progress.report(update),
        onWarning: (message) => onLog(`경고: ${message}`),
      }
    );

    await progress.flush();

    await jobStore.insertJobItems(
      supabase,
      job.id,
      outcome.items.map((entry) => ({
        spuId: String(entry.item.id),
        articleNumber: entry.item.articleNumber ?? null,
        title: entry.item.title ?? null,
        brand: entry.item.brand ?? null,
        payload: {
          ...toStoredSearchItem(entry.item),
          sourceOffers: entry.sourceOffers,
          skuRecommendations: entry.skuRecommendations,
        },
        offerStatus: entry.offerStatus,
      })),
      alreadyKept
    );

    const itemCount = await jobStore.countJobItems(supabase, job.id);
    const excludedCount = job.excludedCount + outcome.excludedCount;
    const warnings = mergeWarnings(job.warnings, outcome.warnings);
    const nextOptions: SearchJobOptions = {
      ...job.options,
      brandPage: outcome.nextBrandPage,
      brandId: outcome.brandId,
      brandTotal: outcome.brandTotal,
      maxItems,
    };

    const reachedCap = itemCount >= maxItems;
    const finished = outcome.catalogEnded || reachedCap || job.type === "article";

    await jobStore.checkpointJob(supabase, job.id, {
      options: nextOptions,
      itemCount,
      excludedCount,
      warnings,
      stage: finished ? null : `수집 ${itemCount}/${maxItems}`,
      progressTotal: maxItems,
      progressDone: itemCount,
    });

    const nextJob: SearchJob = {
      ...job,
      options: nextOptions,
      itemCount,
      excludedCount,
      warnings,
    };

    if (!finished) {
      const detail = `계속 ${itemCount}/${maxItems}건, ${excludedCount}건 제외`;
      onLog(`잡 페이지 저장 ${job.id} — ${detail}`);
      return { status: "continue", job: nextJob, detail };
    }

    const status = warnings.length > 0 && itemCount > 0 ? "partial" : "done";
    await jobStore.finishJob(supabase, job.id, {
      status,
      itemCount,
      excludedCount,
      warnings,
      stage: null,
    });

    const detail = `${status}, ${itemCount}건 적재, ${excludedCount}건 제외`;
    onLog(`잡 완료 ${job.id} (${label}) — ${detail}`);
    return { status, job: nextJob, detail };
  } catch (error) {
    await progress.flush().catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    const result = await jobStore.requeueOrFail(supabase, job, message);
    const status = result === "requeued" ? "requeued" : "failed";
    onLog(`잡 ${status === "requeued" ? "재시도 대기" : "실패"} ${job.id} — ${message}`);
    return { status, job, detail: message };
  }
}

export async function processSearchJob(
  supabase: SupabaseClient,
  job: SearchJob,
  userId: string,
  options?: {
    onLog?: (message: string) => void;
    /** 한 틱에서 처리할 페이지 수. 로컬은 크게, 크론은 1 */
    maxChunks?: number;
  }
): Promise<{ status: "done" | "partial" | "continue" | "requeued" | "failed"; detail: string }> {
  const log = options?.onLog ?? (() => {});
  const maxChunks = Math.max(1, options?.maxChunks ?? 1);
  log(`잡 시작 ${job.id} (${job.type}:${job.keyword})`);

  let current = job;
  let lastStatus: "done" | "partial" | "continue" | "requeued" | "failed" = "continue";
  let lastDetail = "";

  for (let chunk = 0; chunk < maxChunks; chunk += 1) {
    const outcome = await processOneChunk(supabase, current, userId, log);
    lastStatus = outcome.status;
    lastDetail = outcome.detail;
    if (outcome.status !== "continue") return { status: outcome.status, detail: outcome.detail };
    current = outcome.job;
  }

  await jobStore.releaseLockKeepRunning(supabase, job.id);
  return { status: lastStatus, detail: lastDetail };
}

/**
 * stale lock 회수 후 대기/`running`(잠금 없음) 잡 최대 1건을 claim·처리한다.
 */
export async function runWorkerTick(
  supabase: SupabaseClient,
  workerId: string,
  options?: {
    onLog?: (message: string) => void;
    reclaimOnIdle?: boolean;
    maxChunks?: number;
  }
): Promise<WorkerTickResult> {
  const log = options?.onLog ?? (() => {});
  const reclaimOnIdle = options?.reclaimOnIdle ?? true;

  let reclaimed = 0;
  try {
    reclaimed = await jobStore.reclaimStaleJobs(supabase);
  } catch (error) {
    log(`stale lock 회수 실패: ${error instanceof Error ? error.message : String(error)}`);
  }

  let claimed: { job: SearchJob; userId: string } | null = null;
  try {
    claimed = await jobStore.claimNextJob(supabase, workerId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log(`잡 조회 실패: ${detail}`);
    return { reclaimed, processed: false, jobId: null, status: "idle", detail };
  }

  if (!claimed) {
    if (reclaimOnIdle && reclaimed > 0) {
      log(`중단된 잡 ${reclaimed}건을 큐로 되돌렸습니다.`);
    }
    return { reclaimed, processed: false, jobId: null, status: "idle" };
  }

  const outcome = await processSearchJob(supabase, claimed.job, claimed.userId, {
    onLog: log,
    maxChunks: options?.maxChunks ?? 1,
  });

  return {
    reclaimed,
    processed: true,
    jobId: claimed.job.id,
    status: outcome.status,
    detail: outcome.detail,
  };
}
