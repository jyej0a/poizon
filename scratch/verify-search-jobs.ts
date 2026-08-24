/**
 * 2단계 백그라운드 검색 잡 end-to-end 검증용 일회성 스크립트.
 *
 *   pnpm tsx --env-file=.env.local scratch/verify-search-jobs.ts check
 *   pnpm tsx --env-file=.env.local scratch/verify-search-jobs.ts enqueue brand Nike 3
 *   pnpm tsx --env-file=.env.local scratch/verify-search-jobs.ts status
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import * as jobStore from "@/lib/search/job-store";
import type { SearchJobType } from "@/types/search-job";

const supabase = getServiceRoleClient();

async function pickUser() {
  const { data, error } = await supabase
    .from("user_configs")
    .select("user_id, poizon_app_key")
    .not("poizon_app_key", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("POIZON 자격증명이 등록된 사용자가 없습니다.");
  return data.user_id as string;
}

async function check() {
  for (const table of ["search_jobs", "search_job_items"]) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    console.log(`${table}: ${error ? `실패 — ${error.message}` : `OK (행 ${count ?? 0}개)`}`);
  }

  // 컬럼 존재 확인 (없는 컬럼을 select하면 에러가 난다)
  const { error: colError } = await supabase
    .from("search_jobs")
    .select("id, user_id, type, keyword, options, status, stage, progress_total, progress_done, item_count, excluded_count, error, warnings, retry_count, max_retries, locked_at, locked_by, started_at, finished_at")
    .limit(1);
  console.log(`search_jobs 컬럼: ${colError ? `불일치 — ${colError.message}` : "OK"}`);

  const { error: itemColError } = await supabase
    .from("search_job_items")
    .select("id, job_id, spu_id, article_number, title, brand, payload, naver_status, sort_order")
    .limit(1);
  console.log(`search_job_items 컬럼: ${itemColError ? `불일치 — ${itemColError.message}` : "OK"}`);

  const userId = await pickUser();
  console.log(`자격증명 보유 사용자: ${userId.slice(0, 8)}…`);
}

async function enqueue(type: SearchJobType, keyword: string, pageSize: number) {
  const userId = await pickUser();
  const job = await jobStore.createJob(supabase, userId, {
    type,
    keyword,
    options:
      type === "brand"
        ? { pageSize, brandPage: 1, excludeSkipped: false, excludeReviewed: false }
        : { excludeSkipped: false, excludeReviewed: false },
  });
  console.log(`등록 완료: ${job.id} (${job.type}:${job.keyword})`);
}

async function status() {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("id, type, keyword, status, stage, progress_done, progress_total, item_count, excluded_count, retry_count, error, warnings, started_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  for (const job of data ?? []) {
    const elapsed =
      job.started_at && job.finished_at
        ? `${((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
        : "-";
    console.log(
      `${job.status.padEnd(9)} ${String(job.type).padEnd(7)} ${String(job.keyword).padEnd(14)} ` +
        `단계=${job.stage ?? "-"} 진행=${job.progress_done}/${job.progress_total} ` +
        `결과=${job.item_count} 제외=${job.excluded_count} 재시도=${job.retry_count} 소요=${elapsed}`
    );
    if (job.error) console.log(`   error: ${job.error}`);
    const warnings = Array.isArray(job.warnings) ? job.warnings : [];
    warnings.slice(0, 5).forEach((w: string) => console.log(`   warn: ${w}`));
    if (warnings.length > 5) console.log(`   warn: … 외 ${warnings.length - 5}건`);
  }
}

async function items(jobId: string) {
  const rows = await jobStore.getJobItems(supabase, jobId);
  console.log(`적재 ${rows.length}건`);
  rows.slice(0, 8).forEach((row) => {
    const naver = row.payload.naverItems?.[0];
    console.log(
      `  ${String(row.articleNumber).padEnd(18)} ${String(row.brand).padEnd(12)} ` +
        `평균=${row.payload.avgPrice} 옵션=${row.payload.skuDetails.length} ` +
        `판매30일=${row.payload.salesVolume} 네이버=${row.naverStatus}` +
        (naver ? ` ₩${Number(naver.lprice).toLocaleString()} (${naver.mallName})` : "")
    );
  });
  const payloadBytes = rows.reduce((sum, r) => sum + JSON.stringify(r.payload).length, 0);
  console.log(`payload 합계 약 ${(payloadBytes / 1024).toFixed(0)}KB (건당 평균 ${(payloadBytes / 1024 / Math.max(rows.length, 1)).toFixed(1)}KB)`);
}

const [command, ...args] = process.argv.slice(2);

const run = async () => {
  switch (command) {
    case "check":
      return check();
    case "enqueue":
      return enqueue((args[0] as SearchJobType) ?? "brand", args[1] ?? "Nike", Number(args[2] ?? 3));
    case "status":
      return status();
    case "items":
      return items(args[0]);
    default:
      console.log("사용법: check | enqueue <type> <keyword> <pageSize> | status | items <jobId>");
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
