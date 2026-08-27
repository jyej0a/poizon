import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const LISTING_URL = "https://display-bff-api.29cm.co.kr/api/v1/listing/items";
const BROWSER_UA = "Mozilla/5.0";

interface Cm29ItemUrl {
  webLink?: string;
}

interface Cm29ItemInfo {
  productName?: string;
  thumbnailUrl?: string;
  isSoldOut?: boolean;
  displayPrice?: number;
  sellPrice?: number;
  brandName?: string;
}

interface Cm29ItemEvent {
  eventProperties?: {
    isAd?: boolean;
    itemName?: string;
    brandName?: string;
    price?: number;
    isSoldout?: boolean;
  };
}

interface Cm29ListingItem {
  itemId?: number;
  itemType?: string;
  itemUrl?: Cm29ItemUrl;
  itemEvent?: Cm29ItemEvent;
  itemInfo?: Cm29ItemInfo;
}

interface Cm29ListingResponse {
  meta?: { result?: string; message?: string };
  data?: { list?: Cm29ListingItem[] };
}

/**
 * 29CM 검색 HTML(`/store/search`)에는 오퍼가 없다.
 * 페이지가 목록을 가져올 때 쓰는 display-bff `listing/items`(pageType=SRP)를 그대로 호출한다.
 */
export const twentyNineCmProvider: SourceOfferProvider = {
  key: "29cm",
  label: "29CM",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(LISTING_URL, {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://www.29cm.co.kr",
        Referer: `https://www.29cm.co.kr/store/search?keyword=${encodeURIComponent(normalized)}`,
      },
      body: JSON.stringify({
        keyword: normalized,
        pageRequest: { page: 1, size: 40 },
        pageType: "SRP",
        sortType: "RECOMMENDED",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`29CM 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as Cm29ListingResponse;
    if (body.meta?.result && body.meta.result !== "SUCCESS") {
      throw new Error(`29CM 응답 실패 (${body.meta.message ?? body.meta.result})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const item of body.data?.list ?? []) {
      if (item.itemType && item.itemType !== "PRODUCT") continue;
      if (item.itemEvent?.eventProperties?.isAd) continue;

      const info = item.itemInfo;
      const events = item.itemEvent?.eventProperties;
      const title = [info?.brandName ?? events?.brandName, info?.productName ?? events?.itemName]
        .filter(Boolean)
        .join(" ");
      const price = parsePrice(info?.displayPrice ?? info?.sellPrice ?? events?.price);
      const link = item.itemUrl?.webLink ?? (item.itemId ? `https://product.29cm.co.kr/catalog/${item.itemId}` : null);
      if (!price || !title || !link) continue;

      const soldOut = Boolean(info?.isSoldOut ?? events?.isSoldout);
      const hints = [info?.brandName ?? events?.brandName ?? null, soldOut ? "품절" : null].filter(Boolean);

      offers.push({
        source: "29cm",
        sourceLabel: "29CM",
        price,
        title,
        link,
        image: info?.thumbnailUrl ?? null,
        availability: offerAvailability(soldOut),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
