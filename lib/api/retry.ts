/**
 * 지수 백오프 재시도.
 *
 * POIZON 오픈 API는 단발성 타임아웃·네트워크 오류가 잦다. 실측 로그(단일 세션)에서
 * 추천가 타임아웃 36건, `Failed to fetch` 6건, fetch 중단 4건이 관측됐으며 기존 코드에는
 * 재시도가 전혀 없었다. (docs/TODO.md 10.2 F3)
 *
 * 파라미터 오류처럼 재시도해도 같은 결과가 나오는 실패는 즉시 포기한다.
 */

export interface RetryOptions {
  /** 총 시도 횟수 (재시도 횟수 + 1). 기본 3 */
  attempts?: number;
  /** 첫 재시도 대기 시간(ms). 이후 2배씩 증가. 기본 800 */
  baseDelayMs?: number;
  /** 대기 시간 상한(ms). 기본 8000 */
  maxDelayMs?: number;
  /** 재시도 대상 판별. 기본은 타임아웃·네트워크·5xx */
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/** 재시도해도 결과가 달라지지 않는 결정적(deterministic) 실패 신호 */
const NON_RETRYABLE_PATTERNS = [
  "invalid request parameter",
  "invalid parameter",
  "unauthorized",
  "app key",
  "appkey",
  "sign",
  "permission",
  "not found",
  "same listing already exists",
  // 호출 빈도 제한은 즉시 재시도하면 한도만 더 채운다. 입찰 제출이 노출가 큐에 밀림.
  "400010007",
  "频次超限",
];

const RETRYABLE_PATTERNS = [
  "timeout",
  "timed out",
  "aborted",
  "abort",
  "fetch failed",
  "failed to fetch",
  "econnreset",
  "econnrefused",
  "etimedout",
  "enotfound",
  "socket",
  "network",
  "502",
  "503",
  "504",
  "gateway",
  // 네이버 등 영문 429. POIZON `400010007`/`频次超限`은 NON_RETRYABLE.
  "too many requests",
  "429",
  "rate limit",
  // 게이트웨이 혼잡. HTTP 404로 오지만 본문이 "前方拥挤了，请稍安勿躁。"
  "前方拥挤",
  "稍安勿躁",
];

export function isRetryableError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (NON_RETRYABLE_PATTERNS.some((p) => msg.includes(p))) return false;
  if (RETRYABLE_PATTERNS.some((p) => msg.includes(p))) return true;

  // 판단 근거가 없으면 재시도하지 않는다 (POIZON 비즈니스 에러를 무의미하게 반복하지 않기 위함)
  return false;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 800,
    maxDelayMs = 8_000,
    isRetryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= attempts || !isRetryable(error)) throw error;

      // 지수 백오프 + 지터 (동시 재시도가 한꺼번에 몰리는 것을 방지)
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delay = Math.round(backoff * (0.75 + Math.random() * 0.5));

      onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 동시 실행 개수를 제한하며 매핑한다.
 * 네이버 최저가 조회가 품번당 1건씩 무제한 fan-out되던 문제(F14) 대응.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
