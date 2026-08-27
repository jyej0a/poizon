import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface SsgItem {
  itemId?: string;
  itemNm?: string;
  brandNm?: string;
  siteNm?: string;
  soldOutYn?: string;
  displayPrc?: string;
  itemLnkd?: string;
  itemImgUrl?: string;
  advertMarkYn?: string;
}

interface SsgUnit {
  unitType?: string;
  dataList?: SsgItem[];
}

interface SsgSearchResponse {
  res_code?: string;
  res_message?: string;
  data?: {
    dataList?: SsgUnit[];
  };
}

/**
 * 검색 HTML(`/search.ssg`)은 봇 차단(403)이다.
 * 페이지가 상품 목록을 가져올 때 쓰는 `item/all`은 서버 fetch로도 열린다.
 * `collection`은 같은 질의도 빈 배열을 돌려주므로 쓰지 않는다.
 */
const SSG_ITEM_API = "https://search.ssg.com/api/item/all";

export const ssgProvider: SourceOfferProvider = {
  key: "ssg",
  label: "SSG",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(SSG_ITEM_API, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=UTF-8",
        Origin: "https://www.ssg.com",
        Referer: `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(normalized)}`,
      },
      body: JSON.stringify({
        siteNo: "6005",
        query: normalized,
        page: 1,
        target: "pc_item",
        aplTgtMediaCd: "10",
        count: "40",
        typoErrorYn: "N",
        config: {},
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`SSG 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as SsgSearchResponse;
    if (body.res_code && body.res_code !== "200") {
      throw new Error(`SSG 응답 실패 (${body.res_message ?? body.res_code})`);
    }

    const items = (body.data?.dataList ?? [])
      .filter((unit) => unit.unitType === "ITEM_UNIT_LIST")
      .flatMap((unit) => unit.dataList ?? []);

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const item of items) {
      const price = parsePrice(item.displayPrc);
      if (!price || !item.itemNm || !item.itemLnkd) continue;

      const hints = [
        item.soldOutYn === "Y" ? "품절" : null,
        item.advertMarkYn === "Y" ? "광고" : null,
        item.siteNm || null,
        item.brandNm || null,
      ].filter(Boolean);

      offers.push({
        source: "ssg",
        sourceLabel: "SSG",
        price,
        title: `${item.brandNm ? `${item.brandNm} ` : ""}${item.itemNm}`,
        link: item.itemLnkd,
        image: item.itemImgUrl ?? null,
        availability: offerAvailability(item.soldOutYn === "Y"),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
