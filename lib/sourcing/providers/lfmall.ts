import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://nxapi.lfmall.co.kr/exhibition/search/v1/multiSearch";
const PRODUCT_ORIGIN = "https://www.lfmall.co.kr";
const BROWSER_UA = "Mozilla/5.0";

interface LfImage {
  url?: string;
}

interface LfProduct {
  id?: string;
  name?: string;
  brandName?: string;
  salePrice?: number;
  originalPrice?: number;
  soldout?: boolean;
  representImage?: LfImage;
}

interface LfSearchResult {
  keyword?: string;
  total?: number;
  products?: LfProduct[];
}

interface LfSearchResponse {
  header?: { resultCode?: string; resultData?: string };
  body?: { results?: LfSearchResult[] };
}

/**
 * LF몰 검색 페이지는 SPA다. 목록 POST(`/exhibition/search/v1/products`)는 CSRF가 필요하지만,
 * 같은 키워드를 GET `multiSearch?multiKeywords=` 로도 받을 수 있다.
 */
export const lfMallProvider: SourceOfferProvider = {
  key: "lfmall",
  label: "LF몰",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = new URL(SEARCH_API);
    url.searchParams.set("multiKeywords", normalized);
    url.searchParams.set("page", "0");
    url.searchParams.set("size", "40");

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "device-type": "DESKTOP",
        Origin: PRODUCT_ORIGIN,
        Referer: `${PRODUCT_ORIGIN}/app/search/product?keyword=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`LF몰 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as LfSearchResponse;
    if (body.header?.resultCode && body.header.resultCode !== "Success") {
      throw new Error(`LF몰 응답 실패 (${body.header.resultCode})`);
    }

    const products = (body.body?.results ?? []).flatMap((result) => result.products ?? []);
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const product of products) {
      const id = product.id?.trim() ?? "";
      const title = product.name?.trim() ?? "";
      const price = parsePrice(product.salePrice) || parsePrice(product.originalPrice);
      if (!id || !title || !price) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const hints = [product.brandName ?? null, product.soldout ? "품절" : null].filter(Boolean);

      offers.push({
        source: "lfmall",
        sourceLabel: "LF몰",
        price,
        title,
        link: `${PRODUCT_ORIGIN}/app/product/${encodeURIComponent(id)}`,
        image: product.representImage?.url ?? null,
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
