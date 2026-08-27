import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_PAGE_URL = "https://display.wconcept.co.kr/search";
const PRODUCT_SEARCH_URL = "https://api-display.wconcept.co.kr/display/api/v3/search/result/product";
const BROWSER_UA = "Mozilla/5.0";
const KEY_TTL_MS = 60 * 60 * 1000;

interface WconceptProduct {
  itemCd?: string;
  itemName?: string;
  imageUrlMobile?: string;
  statusCd?: string;
  brandNameKr?: string;
  brandNameEn?: string;
  salePrice?: number;
  finalPrice?: number;
  webViewUrl?: string;
}

interface WconceptSearchResponse {
  result?: string;
  message?: string;
  errorCode?: number;
  data?: {
    productList?: {
      content?: WconceptProduct[];
    };
  };
}

let cachedDisplayApiKey: { value: string; fetchedAt: number } | null = null;

function extractDisplayApiKey(html: string): string | null {
  const match = html.match(/"DISPLAY_API_KEY":"([^"]+)"/);
  return match?.[1] ?? null;
}

async function getDisplayApiKey(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cachedDisplayApiKey && now - cachedDisplayApiKey.fetchedAt < KEY_TTL_MS) {
    return cachedDisplayApiKey.value;
  }

  const response = await fetch(`${SEARCH_PAGE_URL}?keyword=_`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`W컨셉 검색 페이지 응답 오류 (${response.status})`);
  }

  const key = extractDisplayApiKey(await response.text());
  if (!key) {
    throw new Error("W컨셉 DISPLAY_API_KEY를 찾지 못했습니다");
  }

  cachedDisplayApiKey = { value: key, fetchedAt: now };
  return key;
}

async function postProductSearch(keyword: string, apiKey: string): Promise<Response> {
  return fetch(PRODUCT_SEARCH_URL, {
    method: "POST",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      "DISPLAY-API-KEY": apiKey,
      Origin: "https://display.wconcept.co.kr",
      Referer: `${SEARCH_PAGE_URL}?keyword=${encodeURIComponent(keyword)}`,
    },
    body: JSON.stringify({
      keyword,
      pageNo: 1,
      pageSize: 40,
      sort: "WCK",
    }),
    cache: "no-store",
  });
}

/**
 * W컨셉 검색 HTML은 건수만 SSR하고 상품 목록은 api-display JSON이다.
 * DISPLAY-API-KEY는 검색 페이지 runtimeConfig의 프론트 공개값이다.
 */
export const wconceptProvider: SourceOfferProvider = {
  key: "wconcept",
  label: "W컨셉",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    let apiKey = await getDisplayApiKey();
    let response = await postProductSearch(normalized, apiKey);

    if (response.status === 401) {
      apiKey = await getDisplayApiKey(true);
      response = await postProductSearch(normalized, apiKey);
    }

    if (!response.ok) {
      throw new Error(`W컨셉 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as WconceptSearchResponse;
    if (body.result && body.result !== "SUCCESS") {
      throw new Error(`W컨셉 응답 실패 (${body.message ?? body.result})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const item of body.data?.productList?.content ?? []) {
      const title = [item.brandNameKr ?? item.brandNameEn, item.itemName].filter(Boolean).join(" ");
      const price = parsePrice(item.salePrice ?? item.finalPrice);
      const path = item.webViewUrl || (item.itemCd ? `/Product/${item.itemCd}` : null);
      const link = path
        ? path.startsWith("http")
          ? path
          : `https://www.wconcept.co.kr${path.startsWith("/") ? path : `/${path}`}`
        : null;
      if (!price || !title || !link) continue;

      const soldOut = item.statusCd === "04";
      const hints = [item.brandNameKr || null, soldOut ? "품절" : null].filter(Boolean);

      offers.push({
        source: "wconcept",
        sourceLabel: "W컨셉",
        price,
        title,
        link,
        image: item.imageUrlMobile ?? null,
        availability: offerAvailability(soldOut),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
