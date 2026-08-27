import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://hi.thehyundai.com/proxy/v1/dp/search/searchResult";
const IMAGE_ORIGIN = "https://image.thehyundai.com";
const BROWSER_UA = "Mozilla/5.0";

interface TheHyundaiItem {
  slitmCd?: string;
  slitmNm?: string;
  sellPrc?: number;
  bnftPrc?: number;
  ostkYn?: string;
  itemImageUrl?: string;
  expsBrndNm?: string;
}

interface TheHyundaiSearchResponse {
  result?: string;
  message?: string;
  data?: {
    productList?: {
      productInfoList?: TheHyundaiItem[];
    };
  };
}

function imageUrl(path: string | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${IMAGE_ORIGIN}${path}`;
}

/**
 * 더현대닷컴(더현대Hi) 검색 HTML에는 오퍼가 없다.
 * 페이지가 쓰는 `/proxy/v1/dp/search/searchResult`를 그대로 호출한다.
 * (`/proxy-mall/pub/v1` 은 검색어를 무시하고 기본 목록만 돌려준다)
 */
export const theHyundaiProvider: SourceOfferProvider = {
  key: "thehyundai",
  label: "더현대닷컴",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = new URL(SEARCH_API);
    url.searchParams.set("searchQuery", normalized);
    url.searchParams.set("searchType", "NCP_PRODUCT");
    url.searchParams.set("page", "1");
    url.searchParams.set("disPlaySize", "36");

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: "https://hi.thehyundai.com",
        Referer: `https://hi.thehyundai.com/search?keyword=${encodeURIComponent(normalized)}&tab=product&q=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`더현대닷컴 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as TheHyundaiSearchResponse;
    if (body.result && body.result !== "SUCCESS") {
      throw new Error(`더현대닷컴 응답 실패 (${body.message ?? body.result})`);
    }

    const items = body.data?.productList?.productInfoList ?? [];
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const id = item.slitmCd?.trim() ?? "";
      const title = item.slitmNm?.trim() ?? "";
      const price = parsePrice(item.bnftPrc) || parsePrice(item.sellPrc);
      if (!id || !title || !price) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const soldOut = item.ostkYn === "Y" || item.ostkYn === "1";
      const hints = [item.expsBrndNm ?? null, soldOut ? "품절" : null].filter(Boolean);

      offers.push({
        source: "thehyundai",
        sourceLabel: "더현대닷컴",
        price,
        title,
        link: `https://hi.thehyundai.com/product/${encodeURIComponent(id)}`,
        image: imageUrl(item.itemImageUrl),
        availability: offerAvailability(soldOut),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
