import type { SearchJob } from "@/types/search-job";

/**
 * 폴링 결과가 화면과 같으면 setState를 생략한다.
 * 진행률·상태·경고 등 목록에 보이는 필드만 비교한다.
 */
export function searchJobsUnchanged(prev: SearchJob[], next: SearchJob[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.stage !== b.stage ||
      a.progressDone !== b.progressDone ||
      a.progressTotal !== b.progressTotal ||
      a.itemCount !== b.itemCount ||
      a.excludedCount !== b.excludedCount ||
      a.updatedAt !== b.updatedAt ||
      a.error !== b.error ||
      a.retryCount !== b.retryCount ||
      a.keyword !== b.keyword ||
      a.type !== b.type ||
      a.startedAt !== b.startedAt ||
      a.finishedAt !== b.finishedAt
    ) {
      return false;
    }
    if (a.warnings.length !== b.warnings.length) return false;
    for (let w = 0; w < a.warnings.length; w++) {
      if (a.warnings[w] !== b.warnings[w]) return false;
    }
  }

  return true;
}
