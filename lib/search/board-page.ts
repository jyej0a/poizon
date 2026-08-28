export const SEARCH_BOARD_PAGE_SIZE = 100;
export const SEARCH_BOARD_INDEX_COL_PX = 40;

export function uniqueKeysInOrder(keys: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

export function articleIndexMap(keysInOrder: string[]): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  for (const key of keysInOrder) {
    if (map.has(key)) continue;
    map.set(key, ++n);
  }
  return map;
}

export function pageCount(total: number, pageSize = SEARCH_BOARD_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

export function pageBounds(
  page: number,
  total: number,
  pageSize = SEARCH_BOARD_PAGE_SIZE
): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return { start, end };
}

export function visiblePageNumbers(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push("gap");
    out.push(p);
  }
  return out;
}
