import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://apis.11st.co.kr/search/api/tab";
const BROWSER_UA = "Mozilla/5.0";

interface ElevenStItem {
  id?: string | number;
  title?: string;
  finalPrc?: number | string;
  selPrc?: number | string;
  imageUrl?: string;
  linkUrl?: string;
  isSoldOut?: boolean;
  soldOut?: boolean;
  brandEngNm?: string;
}

interface ElevenStGroup {
  groupName?: string;
  items?: ElevenStItem[];
}

interface ElevenStSearchResponse {
  data?: ElevenStGroup[];
}

/**
 * 11번가 검색 HTML(`/pc/search`)은 빈 셸이다.
 * 페이지가 목록을 가져올 때 쓰는 `search/api/tab`을 그대로 호출한다.
 */
export const elevenStProvider: SourceOfferProvider = {
  key: "11st",
  label: "11번가",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = new URL(SEARCH_API);
    url.searchParams.set("poc", "pc");
    url.searchParams.set("tabId", "TOTAL_SEARCH");
    url.searchParams.set("tier", "A");
    url.searchParams.set("searchKeyword", normalized);

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: "https://search.11st.co.kr",
        Referer: `https://search.11st.co.kr/pc/search?kwd=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`11번가 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as ElevenStSearchResponse;
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const group of body.data ?? []) {
      for (const item of group.items ?? []) {
        const id = item.id != null ? String(item.id) : "";
        const title = item.title?.trim() ?? "";
        const price = parsePrice(item.finalPrc ?? item.selPrc);
        const link =
          item.linkUrl?.trim() ||
          (id ? `https://www.11st.co.kr/products/${id}` : "");
        if (!title || !price || !link) continue;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);

        const soldOut = Boolean(item.isSoldOut || item.soldOut);
        const hints = [item.brandEngNm ?? null, soldOut ? "품절" : null].filter(Boolean);

        offers.push({
          source: "11st",
          sourceLabel: "11번가",
          price,
          title,
          link,
          image: item.imageUrl ?? null,
          availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
          normalizedArticleNumber: normalized,
          fetchedAt,
        });
      }
    }

    return { offers };
  },
};
