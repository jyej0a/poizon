/**
 * 백그라운드 검색 워커 (로컬 상시 프로세스).
 *
 * `search_jobs` 큐를 폴링해 한 건씩 처리한다. 브랜드는 페이지를 이어서 넘겨
 * 손 안 댄 품번 최대 500개까지 적재한다. Next 서버리스 제약을 받지 않는다.
 *
 * 실행:
 *   pnpm worker
 *
 * 로컬 `pnpm dev`는 instrumentation으로 같은 루프를 같이 기동한다.
 * 배포 환경에서는 `/api/cron/search-worker` + 크론을 사용한다 (동일 코어: `lib/search/worker-run.ts`).
 *
 * 필요 환경변수 (.env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * POIZON 자격증명은 잡 소유자의 `user_configs`에서 잡 시작 시 1회 로드한다.
 */

import { runSearchWorkerUntilStopped } from "@/lib/search/worker-loop";

let shuttingDown = false;

async function main() {
  await runSearchWorkerUntilStopped({
    idPrefix: process.env.WORKER_ID ?? "local",
    shouldStop: () => shuttingDown,
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1);
    console.log(
      `[worker] ${signal} 수신 — 현재 잡 완료 후 종료합니다. (다시 누르면 즉시 종료)`
    );
    shuttingDown = true;
  });
}

main().catch((error) => {
  console.error("워커 비정상 종료:", error);
  process.exit(1);
});
