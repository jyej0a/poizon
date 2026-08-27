/**
 * Next 서버 기동 훅.
 * 로컬 `pnpm dev`에서 검색 워커 루프를 같이 시작해, 별도 `pnpm worker` 없이도
 * 백그라운드 수집이 진행되게 한다. 배포(NODE_ENV=production)에서는 크론만 사용한다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.DISABLE_DEV_WORKER === "1") return;

  try {
    const { startDevSearchWorker } = await import("./lib/search/worker-loop");
    startDevSearchWorker();
  } catch (error) {
    console.error("[dev-worker] 기동 실패:", error);
  }
}
