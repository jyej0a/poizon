import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface KolonPrice {
  price?: number;
  wishPrice?: number;
}

interface KolonProduct {
  code?: string;
  name?: string;
  supplierBrandName?: string;
  representationImage?: string;
  soldOutYn?: string;
  price?: KolonPrice;
}

interface KolonSearchResponse {
  data?: {
    products?: {
      results?: KolonProduct[];
    };
  };
  errors?: Array<{ message?: string }>;
}

/**
 * 코오롱몰 검색 페이지가 쓰는 persisted GraphQL 쿼리.
 * HTML(`/search?searchKeyword=`)은 404이며, 실제 경로는 `/Search?keyword=`.
 */
const SEARCH_HASH = "e8d4514f2e43cdcb733cdbfad69f52a636363579c3656e46cdb9e20f119a0c96";
const GRAPHQL_URL = "https://www.kolonmall.com/graphql";

function buildSearchUrl(articleNumber: string): string {
  const variables = {
    categoryId: "",
    keyword: articleNumber,
    inStock: "TRUE",
    sort: "recommendScore-desc",
    page: 1,
    pageSize: 60,
    isApp: false,
    customerId: "",
    isMember: false,
    gender: "u",
    testGroup: "B",
  };
  const extensions = { persistedQuery: { version: 1, sha256Hash: SEARCH_HASH } };
  const params = new URLSearchParams({
    operationName: "getVertexProductItemsForPaging",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });
  return `${GRAPHQL_URL}?${params.toString()}`;
}

export const kolonMallProvider: SourceOfferProvider = {
  key: "kolonmall",
  label: "코오롱몰",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(buildSearchUrl(normalized), {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Kolonmall 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as KolonSearchResponse;
    if (body.errors?.length) {
      throw new Error(`Kolonmall 응답 실패 (${body.errors[0]?.message ?? "알 수 없는 오류"})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const product of body.data?.products?.results ?? []) {
      const price = parsePrice(product.price?.price);
      if (!price || !product.name || !product.code) continue;

      const hints = [
        product.soldOutYn === "Y" ? "품절" : null,
        product.supplierBrandName || null,
      ].filter(Boolean);

      offers.push({
        source: "kolonmall",
        sourceLabel: "코오롱몰",
        price,
        // 상품명에는 품번이 없고 상품코드(TLTCM26521BLK)에만 있다. 검증·표시를 위해 붙인다.
        title: `${product.supplierBrandName ? `${product.supplierBrandName} ` : ""}${product.name} ${product.code}`,
        link: `https://www.kolonmall.com/Product/${encodeURIComponent(product.code)}`,
        image: product.representationImage ?? null,
        availability: offerAvailability(product.soldOutYn === "Y"),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
