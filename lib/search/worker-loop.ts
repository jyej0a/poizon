/**
 * 검색 잡 워커 폴링 루프.
 * 로컬 CLI(`pnpm worker`)와 `pnpm dev` instrumentation이 동일한 코어를 쓴다.
 */

import { randomUUID } from "node:crypto";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { runWorkerTick } from "@/lib/search/worker-run";

/** 큐가 비었을 때 다음 폴링까지 대기 시간 */
const IDLE_POLL_MS = 3_000;

const DEV_WORKER_FLAG = "__poizonDevSearchWorker";

type GlobalWithDevWorker = typeof globalThis & {
  [DEV_WORKER_FLAG]?: boolean;
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function runSearchWorkerUntilStopped(options?: {
  idPrefix?: string;
  shouldStop?: () => boolean;
  onLog?: (message: string) => void;
}): Promise<void> {
  const workerId = `${options?.idPrefix ?? "local"}-${randomUUID().slice(0, 8)}`;
  const shouldStop = options?.shouldStop ?? (() => false);
  const log =
    options?.onLog ??
    ((message: string) => {
      console.log(`[worker ${workerId}] ${new Date().toISOString()} ${message}`);
    });

  const supabase = getServiceRoleClient();
  log("기동");

  while (!shouldStop()) {
    const result = await runWorkerTick(supabase, workerId, { onLog: log, maxChunks: 50 });
    if (!result.processed) {
      await sleep(IDLE_POLL_MS);
    }
  }

  log("종료");
}

/**
 * `pnpm dev`용. Next 서버와 같은 프로세스에서 루프를 시작하되 register()를 막지 않는다.
 * HMR/재기동으로 register가 여러 번 불려도 루프는 하나다.
 */
export function startDevSearchWorker(): void {
  const g = globalThis as GlobalWithDevWorker;
  if (g[DEV_WORKER_FLAG]) return;
  g[DEV_WORKER_FLAG] = true;

  void runSearchWorkerUntilStopped({ idPrefix: "dev" }).catch((error) => {
    g[DEV_WORKER_FLAG] = false;
    console.error("[dev-worker] 비정상 종료:", error);
  });
}
