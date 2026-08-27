import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://www.uniqlo.com/kr/api/commerce/v5/ko/products";
const PRODUCT_ORIGIN = "https://www.uniqlo.com/kr/ko";
const BROWSER_UA = "Mozilla/5.0";

interface UniqloPrice {
  value?: number;
}

interface UniqloItem {
  productId?: string;
  l1Id?: string;
  name?: string;
  prices?: { base?: UniqloPrice; promo?: UniqloPrice | null };
  images?: { main?: Record<string, { image?: string }> };
  representativeColorDisplayCode?: string;
  representative?: { sales?: boolean };
  storeStockOnly?: boolean;
}

interface UniqloSearchResponse {
  status?: string;
  result?: { items?: UniqloItem[] };
}

function mainImage(item: UniqloItem): string | null {
  const byColor = item.images?.main;
  if (!byColor) return null;
  const preferred = item.representativeColorDisplayCode
    ? byColor[item.representativeColorDisplayCode]?.image
    : undefined;
  if (preferred) return preferred;
  return Object.values(byColor).find((entry) => entry.image)?.image ?? null;
}

/**
 * 유니클로 코리아 검색은 SPA지만, 페이지가 쓰는 commerce v5 products API는 서버 fetch가 된다.
 * 공식몰 품번(`l1Id`, 예: 482758) 검색에 강하고, 일반 의류 품번은 `empty`가 정상이다.
 */
export const uniqloKrProvider: SourceOfferProvider = {
  key: "uniqlo",
  label: "유니클로",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = new URL(SEARCH_API);
    url.searchParams.set("q", normalized);
    url.searchParams.set("offset", "0");
    url.searchParams.set("limit", "24");

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Origin: "https://www.uniqlo.com",
        Referer: `${PRODUCT_ORIGIN}/search?q=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`유니클로 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as UniqloSearchResponse;
    if (body.status && body.status !== "ok") {
      throw new Error(`유니클로 응답 실패 (${body.status})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const item of body.result?.items ?? []) {
      const productId = item.productId?.trim() ?? "";
      const goodsId = item.l1Id?.trim() ?? "";
      const name = item.name?.trim() ?? "";
      const price = parsePrice(item.prices?.promo?.value) || parsePrice(item.prices?.base?.value);
      if (!productId || !name || !price) continue;
      if (seen.has(productId)) continue;
      seen.add(productId);

      const hints = [
        item.representative?.sales === false ? "품절" : null,
        item.storeStockOnly ? "매장재고" : null,
      ].filter(Boolean);

      offers.push({
        source: "uniqlo",
        sourceLabel: "유니클로",
        price,
        // 상품명에는 품번이 없고 l1Id(482758)에만 있다. 검증·표시를 위해 붙인다.
        title: `${name} ${goodsId || productId}`,
        link: `${PRODUCT_ORIGIN}/products/${encodeURIComponent(productId)}`,
        image: mainImage(item),
        availability: offerAvailability(item.representative?.sales === false),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
