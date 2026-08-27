import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://www.hmall.com/api/hf/dp/v1/search/search";
const BROWSER_UA = "Mozilla/5.0";

interface HmallItem {
  slitmCd?: string;
  slitmNm?: string;
  sellPrc?: number;
  bbprc?: number;
  brndNm?: string;
  ostkYn?: string;
  orglImgNm?: string;
}

interface HmallSearchResponse {
  respCode?: string;
  successYn?: string;
  respMsg?: string;
  respData?: {
    searchResult?: {
      hmallItemSearchResultList?: HmallItem[];
    };
  };
}

function imageUrl(slitmCd: string, fileName: string | undefined): string | null {
  if (!fileName) return null;
  if (slitmCd.length < 8) {
    return `https://image.hmall.com/static/${fileName}`;
  }
  const path = `${slitmCd.slice(-3, -2)}/${slitmCd.slice(-4, -3)}/${slitmCd.slice(-6, -4)}/${slitmCd.slice(-8, -6)}`;
  return `https://image.hmall.com/static/${path}/${fileName}`;
}

/**
 * 현대Hmall 검색 HTML(`/md/pde/search`)은 SPA 셸이다.
 * 페이지가 목록을 가져올 때 쓰는 `search/search`를 그대로 호출한다.
 */
export const hmallProvider: SourceOfferProvider = {
  key: "hmall",
  label: "현대Hmall",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = `${SEARCH_API}?searchTerm=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: "https://www.hmall.com",
        Referer: `https://www.hmall.com/md/pde/search?searchTerm=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`현대Hmall 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as HmallSearchResponse;
    if (body.successYn && body.successYn !== "Y") {
      throw new Error(`현대Hmall 응답 실패 (${body.respMsg ?? body.respCode})`);
    }

    const items = body.respData?.searchResult?.hmallItemSearchResultList ?? [];
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const id = item.slitmCd?.trim() ?? "";
      const title = item.slitmNm?.trim() ?? "";
      const price = parsePrice(item.bbprc) || parsePrice(item.sellPrc);
      if (!id || !title || !price) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const soldOut = item.ostkYn === "Y";
      const hints = [item.brndNm ?? null, soldOut ? "품절" : null].filter(Boolean);

      offers.push({
        source: "hmall",
        sourceLabel: "현대Hmall",
        price,
        title,
        link: `https://www.hmall.com/md/pda/itemPtc?slitmCd=${encodeURIComponent(id)}`,
        image: imageUrl(id, item.orglImgNm),
        availability: offerAvailability(soldOut),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
