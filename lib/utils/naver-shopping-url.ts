const NAVER_SHOPPING_SEARCH_BASE = "https://search.shopping.naver.com/search/all";

export function normalizeNaverSearchKeyword(keyword: string): string {
  return keyword.replace(/#/g, "").trim();
}

export function buildNaverShoppingSearchUrl(articleNumber: string): string {
  const query = normalizeNaverSearchKeyword(articleNumber);
  const params = new URLSearchParams({
    query,
    sort: "price_asc",
    productSet: "total",
    pagingSize: "40",
    viewType: "list",
  });
  return `${NAVER_SHOPPING_SEARCH_BASE}?${params.toString()}`;
}

export function openNaverShoppingSearch(articleNumber: string): void {
  const normalized = normalizeNaverSearchKeyword(articleNumber);
  if (!normalized) return;
  window.open(buildNaverShoppingSearchUrl(normalized), "_blank", "noopener,noreferrer");
}

export function openNaverProductLink(
  link: string | undefined | null,
  fallbackArticleNumber?: string
): void {
  const trimmed = link?.trim();
  if (trimmed) {
    window.open(trimmed, "_blank", "noopener,noreferrer");
    return;
  }
  if (fallbackArticleNumber) {
    openNaverShoppingSearch(fallbackArticleNumber);
  }
}
