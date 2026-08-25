/**
 * 백그라운드 검색 워커 (로컬 상시 프로세스).
 *
 * `search_jobs` 큐를 폴링해 한 건씩 처리한다. 브랜드는 페이지를 이어서 넘겨
 * 손 안 댄 품번 최대 500개까지 적재한다. Next 서버리스 제약을 받지 않는다.
 *
 * 실행:
 *   pnpm worker
 *
 * 배포 환경에서는 `/api/cron/search-worker` + 크론을 사용한다 (동일 코어: `lib/search/worker-run.ts`).
 *
 * 필요 환경변수 (.env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * POIZON 자격증명은 잡 소유자의 `user_configs`에서 잡 시작 시 1회 로드한다.
 */

import { randomUUID } from "node:crypto";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { runWorkerTick } from "@/lib/search/worker-run";

/** 큐가 비었을 때 다음 폴링까지 대기 시간 */
const IDLE_POLL_MS = 3_000;

const workerId = `${process.env.WORKER_ID ?? "local"}-${randomUUID().slice(0, 8)}`;
const supabase = getServiceRoleClient();

let shuttingDown = false;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function log(message: string) {
  console.log(`[worker ${workerId}] ${new Date().toISOString()} ${message}`);
}

async function main() {
  log("기동");

  while (!shuttingDown) {
    const result = await runWorkerTick(supabase, workerId, { onLog: log, maxChunks: 50 });
    if (!result.processed) {
      await sleep(IDLE_POLL_MS);
    }
  }

  log("종료");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1);
    log(`${signal} 수신 — 현재 잡 완료 후 종료합니다. (다시 누르면 즉시 종료)`);
    shuttingDown = true;
  });
}

main().catch((error) => {
  console.error("워커 비정상 종료:", error);
  process.exit(1);
});
