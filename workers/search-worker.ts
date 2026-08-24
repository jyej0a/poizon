/**
 * 백그라운드 검색 워커.
 *
 * `search_jobs` 큐를 폴링해 한 건씩 처리한다. Next 서버리스 실행시간 제약을 받지 않으므로
 * 브랜드 대량 검색(수십 초~수 분)을 끝까지 수행할 수 있다.
 *
 * 실행:
 *   pnpm worker
 *
 * 필요 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *
 * POIZON 자격증명은 잡 소유자의 `user_configs`에서 잡 시작 시 1회 로드한다.
 */

import { randomUUID } from "node:crypto";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createPoizonClientForUser } from "@/lib/api/poizon-credentials";
import { runSearchJob, type ProgressUpdate } from "@/lib/search/run-search-job";
import { toStoredSearchItem } from "@/lib/search/search-item";
import * as jobStore from "@/lib/search/job-store";
import type { SearchJob } from "@/types/search-job";

/** 큐가 비었을 때 다음 폴링까지 대기 시간 */
const IDLE_POLL_MS = 3_000;
/** 진행률 DB 반영 최소 간격. 아이템마다 쓰면 왕복이 과하다 */
const PROGRESS_FLUSH_MS = 1_000;

const workerId = `${process.env.WORKER_ID ?? "local"}-${randomUUID().slice(0, 8)}`;
const supabase = getServiceRoleClient();

let shuttingDown = false;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function log(message: string) {
  console.log(`[worker ${workerId}] ${new Date().toISOString()} ${message}`);
}

/**
 * 진행률 갱신을 시간 기준으로 병합한다.
 * 마지막 상태는 `flush()`로 반드시 반영한다.
 */
function createProgressWriter(jobId: string) {
  let pending: ProgressUpdate | null = null;
  let lastFlushedAt = 0;

  const write = async (update: ProgressUpdate) => {
    try {
      await jobStore.updateJobProgress(supabase, jobId, update);
    } catch (error) {
      // 진행률 실패로 수집 자체를 중단시키지 않는다
      console.warn(`[worker ${workerId}] 진행률 갱신 실패:`, error);
    }
  };

  return {
    async report(update: ProgressUpdate) {
      pending = { ...pending, ...update };

      const now = Date.now();
      // 단계 전환은 사용자에게 즉시 보여야 하므로 지연시키지 않는다
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

async function processJob(job: SearchJob, userId: string) {
  const label = `${job.type}:${job.keyword}`;
  log(`잡 시작 ${job.id} (${label})`);

  const progress = createProgressWriter(job.id);

  try {
    const poizon = await createPoizonClientForUser(supabase, userId);

    const outcome = await runSearchJob(
      { id: job.id, type: job.type, keyword: job.keyword, options: job.options },
      {
        supabase,
        poizon,
        userId,
        onProgress: (update) => progress.report(update),
        onWarning: (message) => log(`경고: ${message}`),
      }
    );

    await progress.flush();

    const inserted = await jobStore.insertJobItems(
      supabase,
      job.id,
      outcome.items.map((entry) => ({
        spuId: String(entry.item.id),
        articleNumber: entry.item.articleNumber ?? null,
        title: entry.item.title ?? null,
        brand: entry.item.brand ?? null,
        // 외부 소싱 오퍼를 payload에 함께 담아 화면이 추가 호출 없이 렌더할 수 있게 한다
        payload: { ...toStoredSearchItem(entry.item), sourceOffers: entry.sourceOffers },
        offerStatus: entry.offerStatus,
      }))
    );

    // 결과는 있으나 일부 단계가 실패했으면 partial로 남겨 재시도 판단을 사용자에게 맡긴다
    const status = outcome.warnings.length > 0 && inserted > 0 ? "partial" : "done";

    await jobStore.finishJob(supabase, job.id, {
      status,
      itemCount: inserted,
      excludedCount: outcome.excludedCount,
      warnings: outcome.warnings,
      stage: null,
    });

    log(`잡 완료 ${job.id} — ${status}, ${inserted}건 적재, ${outcome.excludedCount}건 제외`);
  } catch (error) {
    await progress.flush().catch(() => {});

    const message = error instanceof Error ? error.message : String(error);
    const result = await jobStore.requeueOrFail(supabase, job, message);
    log(`잡 ${result === "requeued" ? "재시도 대기" : "실패"} ${job.id} — ${message}`);
  }
}

async function main() {
  log("기동");

  const reclaimed = await jobStore.reclaimStaleJobs(supabase).catch((error) => {
    console.error("stale lock 회수 실패:", error);
    return 0;
  });
  if (reclaimed > 0) log(`중단된 잡 ${reclaimed}건을 큐로 되돌렸습니다.`);

  while (!shuttingDown) {
    let claimed: { job: SearchJob; userId: string } | null = null;

    try {
      claimed = await jobStore.claimNextJob(supabase, workerId);
    } catch (error) {
      console.error("잡 조회 실패:", error);
      await sleep(IDLE_POLL_MS);
      continue;
    }

    if (!claimed) {
      await jobStore.reclaimStaleJobs(supabase).catch(() => 0);
      await sleep(IDLE_POLL_MS);
      continue;
    }

    await processJob(claimed.job, claimed.userId);
  }

  log("종료");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1);
    // 진행 중인 잡은 끝까지 처리하고 멈춘다. 강제 종료가 필요하면 한 번 더 누른다.
    log(`${signal} 수신 — 현재 잡 완료 후 종료합니다. (다시 누르면 즉시 종료)`);
    shuttingDown = true;
  });
}

main().catch((error) => {
  console.error("워커 비정상 종료:", error);
  process.exit(1);
});
