import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://search.cjonstyle.com/search-web/search/cjmall/item.json";
const IMAGE_ORIGIN = "https://itemimage.cjonstyle.net";
const BROWSER_UA = "Mozilla/5.0";

interface CjItem {
  itemCd?: string;
  itemNm?: string;
  pmgItemNm?: string;
  pmgWebDispItemNm?: string;
  pmgSalePrice?: string | number;
  pmgCustomerPrice?: string | number;
  pmgItemImgUrl?: string;
  repBrandNm?: string;
  restockAlarmYn?: string;
}

interface CjSearchGroup {
  type?: string;
  rowDatas?: CjItem[];
}

interface CjSearchResponse {
  status?: number;
  errorMessage?: string;
  result?: CjSearchGroup[];
}

function imageUrl(path: string | undefined): string | null {
  if (!path) return null;
  const clean = path.split("?")[0];
  if (clean.startsWith("http")) return clean;
  return `${IMAGE_ORIGIN}/${clean.replace(/^\//, "")}`;
}

/**
 * CJ온스타일 검색 HTML(`/p/search/searchAllList`)은 빈 셸이다.
 * 페이지가 목록을 가져올 때 쓰는 `item.json`을 그대로 호출한다.
 */
export const cjOnstyleProvider: SourceOfferProvider = {
  key: "cjonstyle",
  label: "CJ온스타일",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = new URL(SEARCH_API);
    url.searchParams.set("k", normalized);
    url.searchParams.set("dt", "PC");

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: "https://display.cjonstyle.com",
        Referer: `https://display.cjonstyle.com/p/search/searchAllList?k=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`CJ온스타일 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as CjSearchResponse;
    if (body.status && body.status !== 200) {
      throw new Error(`CJ온스타일 응답 실패 (${body.errorMessage ?? body.status})`);
    }

    const items = (body.result ?? [])
      .filter((group) => group.type === "CJMALL_ITEM")
      .flatMap((group) => group.rowDatas ?? []);

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const id = item.itemCd?.trim() ?? "";
      const title =
        item.itemNm?.trim() ||
        item.pmgWebDispItemNm?.trim() ||
        item.pmgItemNm?.trim() ||
        "";
      const price = parsePrice(item.pmgCustomerPrice) || parsePrice(item.pmgSalePrice);
      if (!id || !title || !price) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const hints = [
        item.repBrandNm ?? null,
        item.restockAlarmYn === "Y" ? "재입고알림" : null,
      ].filter(Boolean);

      offers.push({
        source: "cjonstyle",
        sourceLabel: "CJ온스타일",
        price,
        title,
        link: `https://display.cjonstyle.com/p/item/${encodeURIComponent(id)}`,
        image: imageUrl(item.pmgItemImgUrl),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
