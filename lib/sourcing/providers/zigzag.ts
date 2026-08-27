import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://api.zigzag.kr/api/2/graphql";
const BROWSER_UA = "Mozilla/5.0";

const SEARCH_QUERY = `query GetSearchResult($input: SearchResultInput!) {
  search_result(input: $input) {
    total_count
    ui_item_list {
      ... on UxGoodsCardItem {
        product_url
        title
        shop_name
        price
        final_price
        image_url
        catalog_product_id
        goods_id
        sales_status
      }
    }
  }
}`;

interface ZigzagGoodsCard {
  product_url?: string;
  title?: string;
  shop_name?: string;
  price?: number;
  final_price?: number;
  image_url?: string;
  catalog_product_id?: string;
  goods_id?: string;
  sales_status?: string;
}

interface ZigzagSearchResponse {
  data?: {
    search_result?: {
      total_count?: number;
      ui_item_list?: Array<ZigzagGoodsCard | Record<string, never>>;
    };
  };
  errors?: Array<{ message?: string }>;
}

/**
 * 지그재그 검색 HTML은 Next 셸이다. 페이지가 쓰는 GraphQL `GetSearchResult`를 호출한다.
 * 입점 셀러 사이트는 파싱하지 않고, 지그재그 카탈로그 오퍼만 가져온다.
 */
export const zigzagProvider: SourceOfferProvider = {
  key: "zigzag",
  label: "지그재그",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(SEARCH_API, {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://zigzag.kr",
        Referer: `https://zigzag.kr/search?keyword=${encodeURIComponent(normalized)}`,
      },
      body: JSON.stringify({
        operationName: "GetSearchResult",
        query: SEARCH_QUERY,
        variables: {
          input: {
            initial: true,
            page_id: "srp_item",
            q: normalized,
            after: null,
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`지그재그 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as ZigzagSearchResponse;
    if (body.errors?.length) {
      throw new Error(`지그재그 응답 실패 (${body.errors[0]?.message ?? "알 수 없는 오류"})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const item of body.data?.search_result?.ui_item_list ?? []) {
      const card = item as ZigzagGoodsCard;
      const title = card.title?.trim() ?? "";
      const link = card.product_url?.split("?")[0]?.trim() ?? "";
      const price = parsePrice(card.final_price) || parsePrice(card.price);
      const id = String(card.catalog_product_id ?? card.goods_id ?? link).trim();
      if (!title || !link || !price) continue;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);

      const hints = [
        card.shop_name ?? null,
        card.sales_status && card.sales_status !== "ON_SALE" ? "품절" : null,
      ].filter(Boolean);

      offers.push({
        source: "zigzag",
        sourceLabel: "지그재그",
        price,
        title,
        link,
        image: card.image_url ?? null,
        availability: offerAvailability(
          Boolean(card.sales_status && card.sales_status !== "ON_SALE")
        ),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
