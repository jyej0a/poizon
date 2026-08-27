import { offerAvailability } from "@/lib/sourcing/availability";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOffer } from "@/types/source-offer";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface MusinsaGoods {
  goodsNo?: number;
  goodsName?: string;
  goodsLinkUrl?: string;
  thumbnail?: string;
  imageUrl?: string;
  price?: number;
  finalPrice?: number;
  isSoldOut?: boolean;
  isAd?: boolean;
  brandName?: string;
}

interface MusinsaResponse {
  meta?: { result?: string; message?: string };
  data?: {
    list?: MusinsaGoods[];
    pagination?: { totalCount?: number };
  };
}

/**
 * 검색 페이지 HTML에는 상품이 1건만 직렬화되어 있어 목록 전체를 얻을 수 없다.
 * 페이지가 실제로 호출하는 공개 JSON 엔드포인트를 그대로 사용한다.
 */
const MUSINSA_SEARCH_API = "https://api.musinsa.com/api2/dp/v2/plp/goods";

function buildSearchUrl(articleNumber: string): string {
  const params = new URLSearchParams({
    gf: "A",
    keyword: articleNumber,
    sortCode: "POPULAR",
    isUsed: "false",
    page: "1",
    size: "60",
    caller: "SEARCH",
  });

  return `${MUSINSA_SEARCH_API}?${params.toString()}`;
}

export const musinsaProvider: SourceOfferProvider = {
  key: "musinsa",
  label: "무신사",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(buildSearchUrl(normalized), {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Musinsa 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as MusinsaResponse;
    if (body.meta?.result !== "SUCCESS") {
      throw new Error(`Musinsa 응답 실패 (${body.meta?.message ?? "알 수 없는 오류"})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const goods of body.data?.list ?? []) {
      const price = parsePrice(goods.finalPrice ?? goods.price);
      if (!price || !goods.goodsName || !goods.goodsLinkUrl) continue;

      const soldOut = Boolean(goods.isSoldOut);
      const hints = [
        soldOut ? "품절" : null,
        goods.isAd ? "광고" : null,
        goods.brandName || null,
      ].filter(Boolean);

      offers.push({
        source: "musinsa",
        sourceLabel: "무신사",
        price,
        title: goods.goodsName,
        link: goods.goodsLinkUrl.startsWith("http")
          ? goods.goodsLinkUrl
          : `https://www.musinsa.com${goods.goodsLinkUrl}`,
        image: goods.thumbnail ?? goods.imageUrl ?? null,
        availability: offerAvailability(soldOut),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
