export const SEARCH_HISTORY_KEY = "poizon_search_history";
export const SEARCH_HISTORY_LIMIT = 10;

export interface SearchHistoryEntry {
  keyword: string;
  type: "article" | "brand";
  ts: number;
}

export function readSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry: unknown) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as SearchHistoryEntry).keyword === "string" &&
          ((entry as SearchHistoryEntry).type === "article" ||
            (entry as SearchHistoryEntry).type === "brand")
      )
      .sort((a: SearchHistoryEntry, b: SearchHistoryEntry) => b.ts - a.ts);
  } catch {
    return [];
  }
}

function writeSearchHistory(entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to persist search history", error);
  }
}

export function addSearchHistory(keyword: string, type: "article" | "brand"): SearchHistoryEntry[] {
  const trimmed = keyword.trim();
  if (!trimmed) return readSearchHistory();
  const key = trimmed.toLowerCase();
  const others = readSearchHistory().filter(
    (entry) => !(entry.keyword.trim().toLowerCase() === key && entry.type === type)
  );
  const next = [{ keyword: trimmed, type, ts: Date.now() }, ...others].slice(0, SEARCH_HISTORY_LIMIT);
  writeSearchHistory(next);
  return next;
}

export function removeSearchHistory(keyword: string, type: "article" | "brand"): SearchHistoryEntry[] {
  const key = keyword.trim().toLowerCase();
  const next = readSearchHistory().filter(
    (entry) => !(entry.keyword.trim().toLowerCase() === key && entry.type === type)
  );
  writeSearchHistory(next);
  return next;
}

export function clearSearchHistory(): SearchHistoryEntry[] {
  writeSearchHistory([]);
  return [];
}
