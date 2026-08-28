/**
 * search_jobs / search_job_items 접근 계층 (서버 전용).
 * 서버 액션과 백그라운드 워커가 같은 쿼리를 공유한다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SearchJob,
  SearchJobItemPayload,
  SearchJobItemRecord,
  SearchJobOptions,
  SearchJobPurpose,
  SearchJobStatus,
  SearchJobType,
  SourceOfferItemStatus,
} from "@/types/search-job";

/** 워커가 죽어 잠금이 남은 잡을 회수하는 기준 시간 */
export const STALE_LOCK_MS = 5 * 60 * 1000;

const JOB_SELECT =
  "id, type, keyword, options, status, stage, progress_total, progress_done, item_count, excluded_count, error, warnings, retry_count, max_retries, started_at, finished_at, created_at, updated_at";

function rowToJob(row: any): SearchJob {
  return {
    id: row.id,
    type: row.type as SearchJobType,
    keyword: row.keyword,
    options: (row.options ?? {}) as SearchJobOptions,
    status: row.status as SearchJobStatus,
    stage: row.stage ?? null,
    progressTotal: row.progress_total ?? 0,
    progressDone: row.progress_done ?? 0,
    itemCount: row.item_count ?? 0,
    excludedCount: row.excluded_count ?? 0,
    error: row.error ?? null,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    retryCount: row.retry_count ?? 0,
    maxRetries: row.max_retries ?? 3,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  input: { type: SearchJobType; keyword: string; options: SearchJobOptions }
): Promise<SearchJob> {
  const { data, error } = await supabase
    .from("search_jobs")
    .insert({
      user_id: userId,
      type: input.type,
      keyword: input.keyword,
      options: input.options,
      status: "queued",
    })
    .select(JOB_SELECT)
    .single();

  if (error) throw error;
  return rowToJob(data);
}

export async function listJobs(
  supabase: SupabaseClient,
  userId: string,
  limit = 30,
  purpose: SearchJobPurpose = "search"
): Promise<SearchJob[]> {
  let query = supabase
    .from("search_jobs")
    .select(JOB_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (purpose === "discovery") {
    query = query.eq("options->>purpose", "discovery");
  } else if (purpose === "bulk") {
    query = query.eq("options->>purpose", "bulk");
  } else {
    query = query.or("options->>purpose.is.null,options->>purpose.eq.search");
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(rowToJob);
}

export async function getJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<SearchJob | null> {
  const { data, error } = await supabase
    .from("search_jobs")
    .select(JOB_SELECT)
    .eq("user_id", userId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToJob(data) : null;
}

export async function getJobItems(
  supabase: SupabaseClient,
  jobId: string
): Promise<SearchJobItemRecord[]> {
  const { data, error } = await supabase
    .from("search_job_items")
    .select("spu_id, article_number, title, brand, payload, naver_status, sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    spuId: row.spu_id,
    articleNumber: row.article_number ?? null,
    title: row.title ?? null,
    brand: row.brand ?? null,
    payload: row.payload as SearchJobItemPayload,
      offerStatus: row.naver_status as SourceOfferItemStatus,
    sortOrder: row.sort_order ?? 0,
  }));
}

export interface InsertableJobItem {
  spuId: string;
  articleNumber: string | null;
  title: string | null;
  brand: string | null;
  payload: SearchJobItemPayload;
  offerStatus: SourceOfferItemStatus;
}

const ITEM_INSERT_CHUNK = 50;

export async function insertJobItems(
  supabase: SupabaseClient,
  jobId: string,
  items: InsertableJobItem[],
  startSortOrder = 0
): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((item, index) => ({
    job_id: jobId,
    spu_id: item.spuId,
    article_number: item.articleNumber,
    title: item.title,
    brand: item.brand,
    payload: item.payload,
    naver_status: item.offerStatus,
    sort_order: startSortOrder + index,
  }));

  let inserted = 0;
  // payload가 크므로 한 번에 밀어넣지 않고 청크 단위로 적재한다
  for (let i = 0; i < rows.length; i += ITEM_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + ITEM_INSERT_CHUNK);
    const { error } = await supabase
      .from("search_job_items")
      .upsert(chunk, { onConflict: "job_id, spu_id" });

    if (error) throw error;
    inserted += chunk.length;
  }

  return inserted;
}

export async function countJobItems(
  supabase: SupabaseClient,
  jobId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("search_job_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * 대기 중인 잡 1건을 잠그고 가져온다.
 *
 * `status = 'queued'` 조건이 붙은 UPDATE라 동시에 여러 워커가 같은 잡을 집으면
 * 한 쪽만 행을 반환한다(낙관적 잠금). 별도 트랜잭션이 필요 없다.
 */
export async function claimNextJob(
  supabase: SupabaseClient,
  workerId: string
): Promise<{ job: SearchJob; userId: string } | null> {
  const { data: queued, error: pickError } = await supabase
    .from("search_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);

  if (pickError) throw pickError;

  const now = new Date().toISOString();

  for (const candidate of queued ?? []) {
    const claimed = await tryLockJob(supabase, candidate.id, workerId, now, "queued");
    if (claimed) return claimed;
  }

  const { data: resumable, error: resumeError } = await supabase
    .from("search_jobs")
    .select("id")
    .eq("status", "running")
    .is("locked_at", null)
    .order("updated_at", { ascending: true })
    .limit(5);

  if (resumeError) throw resumeError;

  for (const candidate of resumable ?? []) {
    const claimed = await tryLockJob(supabase, candidate.id, workerId, now, "running");
    if (claimed) return claimed;
  }

  return null;
}

async function tryLockJob(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  now: string,
  expectedStatus: "queued" | "running"
): Promise<{ job: SearchJob; userId: string } | null> {
  const patch: Record<string, unknown> = {
    status: "running",
    locked_at: now,
    locked_by: workerId,
    updated_at: now,
    error: null,
  };
  if (expectedStatus === "queued") patch.started_at = now;

  let query = supabase
    .from("search_jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("status", expectedStatus);

  if (expectedStatus === "running") {
    query = query.is("locked_at", null);
  }

  const { data, error } = await query.select(`${JOB_SELECT}, user_id`).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { job: rowToJob(data), userId: (data as { user_id: string }).user_id };
}

/**
 * 진행률 갱신. `locked_at`을 함께 갱신해 워커 생존 신호(heartbeat)를 겸하므로
 * 오래 걸리는 단계가 stale lock으로 오인되지 않는다.
 */
export async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  update: { stage?: string; progressTotal?: number; progressDone?: number }
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now, locked_at: now };
  if (update.stage !== undefined) patch.stage = update.stage;
  if (update.progressTotal !== undefined) patch.progress_total = update.progressTotal;
  if (update.progressDone !== undefined) patch.progress_done = update.progressDone;

  const { error } = await supabase.from("search_jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

export async function finishJob(
  supabase: SupabaseClient,
  jobId: string,
  result: {
    status: SearchJobStatus;
    itemCount?: number;
    excludedCount?: number;
    warnings?: string[];
    error?: string | null;
    stage?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("search_jobs")
    .update({
      status: result.status,
      item_count: result.itemCount ?? 0,
      excluded_count: result.excludedCount ?? 0,
      warnings: result.warnings ?? [],
      error: result.error ?? null,
      stage: result.stage ?? null,
      finished_at: now,
      updated_at: now,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function checkpointJob(
  supabase: SupabaseClient,
  jobId: string,
  update: {
    options: SearchJobOptions;
    itemCount: number;
    excludedCount: number;
    warnings: string[];
    stage: string | null;
    progressTotal: number;
    progressDone: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("search_jobs")
    .update({
      options: update.options,
      item_count: update.itemCount,
      excluded_count: update.excludedCount,
      warnings: update.warnings,
      stage: update.stage,
      progress_total: update.progressTotal,
      progress_done: update.progressDone,
      locked_at: now,
      updated_at: now,
    })
    .eq("id", jobId);

  if (error) throw error;
}

/** 더 모을 페이지가 남았으면 잠금만 풀고 running으로 둔다 (크론이 이어서 claim) */
export async function releaseLockKeepRunning(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from("search_jobs")
    .update({
      status: "running",
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function updateJobItemPayloads(
  supabase: SupabaseClient,
  jobId: string,
  updates: Array<{
    spuId: string;
    payload: SearchJobItemPayload;
    offerStatus?: SourceOfferItemStatus;
  }>
): Promise<void> {
  for (const update of updates) {
    const patch: Record<string, unknown> = { payload: update.payload };
    if (update.offerStatus) patch.naver_status = update.offerStatus;
    const { error } = await supabase
      .from("search_job_items")
      .update(patch)
      .eq("job_id", jobId)
      .eq("spu_id", update.spuId);
    if (error) throw error;
  }
}

export async function listJobItemsByKeyword(
  supabase: SupabaseClient,
  userId: string,
  type: SearchJobType,
  keyword: string,
  limitJobs = 20
): Promise<SearchJobItemRecord[]> {
  const { data: jobs, error: jobError } = await supabase
    .from("search_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("keyword", keyword)
    .order("created_at", { ascending: false })
    .limit(limitJobs);

  if (jobError) throw jobError;
  const jobIds = (jobs ?? []).map((row: { id: string }) => row.id);
  if (jobIds.length === 0) return [];

  const { data, error } = await supabase
    .from("search_job_items")
    .select("spu_id, article_number, title, brand, payload, naver_status, sort_order, job_id")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const seen = new Set<string>();
  const items: SearchJobItemRecord[] = [];
  for (const row of data ?? []) {
    const spuId = String(row.spu_id);
    if (seen.has(spuId)) continue;
    seen.add(spuId);
    items.push({
      spuId,
      articleNumber: row.article_number ?? null,
      title: row.title ?? null,
      brand: row.brand ?? null,
      payload: row.payload as SearchJobItemPayload,
      offerStatus: row.naver_status as SourceOfferItemStatus,
      sortOrder: row.sort_order ?? 0,
    });
  }
  return items;
}

/** 재시도해도 결과가 달라지지 않는 잡 실패 (브랜드/품번 없음 등) */
export function isDeterministicJobError(errorMessage: string): boolean {
  return (
    errorMessage.includes("고유 ID를 찾을 수 없습니다") ||
    errorMessage.includes("검색된 상품이 없습니다") ||
    errorMessage.includes("검색 결과가 없습니다")
  );
}

/** 재시도 여력이 남았으면 큐로 되돌리고, 아니면 실패로 확정한다. */
export async function requeueOrFail(
  supabase: SupabaseClient,
  job: SearchJob,
  errorMessage: string
): Promise<"requeued" | "failed"> {
  const nextRetry = job.retryCount + 1;
  const now = new Date().toISOString();

  if (nextRetry <= job.maxRetries && !isDeterministicJobError(errorMessage)) {
    await supabase
      .from("search_jobs")
      .update({
        status: "queued",
        retry_count: nextRetry,
        error: errorMessage,
        stage: null,
        locked_at: null,
        locked_by: null,
        updated_at: now,
      })
      .eq("id", job.id);
    return "requeued";
  }

  await finishJob(supabase, job.id, {
    status: "failed",
    error: errorMessage,
    itemCount: 0,
  });
  return "failed";
}

/**
 * 워커가 비정상 종료해 `running`으로 남은 잡을 큐로 되돌린다.
 * 워커 기동 시와 폴링 주기마다 호출한다.
 */
export async function reclaimStaleJobs(supabase: SupabaseClient): Promise<number> {
  const threshold = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data, error } = await supabase
    .from("search_jobs")
    .update({
      status: "queued",
      stage: null,
      locked_at: null,
      locked_by: null,
      error: "워커 중단으로 재시도 대기로 되돌렸습니다.",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("locked_at", threshold)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

export async function cancelJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("search_jobs")
    .update({
      status: "cancelled",
      stage: null,
      locked_at: null,
      locked_by: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 완료/실패한 잡을 다시 큐에 올린다 (결과는 초기화). 잘못된 brandId 캐시도 버린다. */
export async function retryJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<boolean> {
  const { data: existing, error: loadError } = await supabase
    .from("search_jobs")
    .select("options")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!existing) return false;

  const options = { ...((existing.options as SearchJobOptions | null) ?? {}) };
  delete options.brandId;
  delete options.brandTotal;
  options.brandPage = 1;
  options.articleOffset = 0;

  const { error: deleteError } = await supabase
    .from("search_job_items")
    .delete()
    .eq("job_id", jobId);
  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from("search_jobs")
    .update({
      status: "queued",
      options,
      stage: null,
      progress_done: 0,
      progress_total: 0,
      item_count: 0,
      excluded_count: 0,
      warnings: [],
      error: null,
      retry_count: 0,
      locked_at: null,
      locked_by: null,
      started_at: null,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("search_jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
