export const SEARCH_EXCLUDE_SKIPPED_KEY = "poizon_search_exclude_skipped";
export const SEARCH_EXCLUDE_REVIEWED_KEY = "poizon_search_exclude_reviewed";

export function readSearchExcludePref(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
}

export function writeSearchExcludePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}
