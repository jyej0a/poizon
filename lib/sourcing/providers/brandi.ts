import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_API = "https://capi.brandi.co.kr/v1/web/search/products";
const PRODUCT_ORIGIN = "https://www.brandi.co.kr";
const BROWSER_UA = "Mozilla/5.0";

/**
 * 브랜디·하이버는 같은 capi 게스트 토큰을 쓴다.
 * 401이면 하이버 `_app` 청크의 `CM` 값을 이 상수에 맞춰 갱신한다.
 */
const GUEST_TOKEN =
  "3b17176f2eb5fdffb9bafdcc3e4bc192b013813caddccd0aad20c23ed272f076_1423639497";

interface BrandiSeller {
  name?: string;
}

interface BrandiProduct {
  id?: string | number;
  name?: string;
  price?: number;
  sale_price?: number;
  expect_sale_price?: number;
  is_sell?: boolean;
  image_url?: string;
  web_image_url?: string;
  seller?: BrandiSeller;
}

interface BrandiSearchResponse {
  meta?: { code?: number; message?: string };
  data?: { total_count?: number; products?: BrandiProduct[] };
}

/**
 * 검색 HTML은 빈 SPA다. 페이지가 쓰는 `capi.brandi.co.kr/.../search/products/{q}` 를 호출한다.
 * 하이버와 동일 게스트 토큰. 품번 미판매는 `empty`.
 */
export const brandiProvider: SourceOfferProvider = {
  key: "brandi",
  label: "브랜디",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const keyword = normalized.replace(/[/|]/g, "").trim();
    const url = new URL(`${SEARCH_API}/${encodeURIComponent(keyword)}`);
    url.searchParams.set("version", "2301");
    url.searchParams.set("total-count", "true");
    url.searchParams.set("offset", "0");
    url.searchParams.set("limit", "30");
    url.searchParams.set("service-type", "brandi");

    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        Origin: PRODUCT_ORIGIN,
        Referer: `${PRODUCT_ORIGIN}/search?q=${encodeURIComponent(keyword)}`,
        Authorization: GUEST_TOKEN,
        sid: GUEST_TOKEN,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`브랜디 응답 오류 (${response.status})`);
    }

    const body = (await response.json()) as BrandiSearchResponse;
    if (body.meta?.code && body.meta.code !== 200) {
      throw new Error(`브랜디 응답 실패 (${body.meta.message ?? body.meta.code})`);
    }

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const product of body.data?.products ?? []) {
      const id = String(product.id ?? "").trim();
      const title = product.name?.trim() ?? "";
      const price =
        parsePrice(product.sale_price) ||
        parsePrice(product.expect_sale_price) ||
        parsePrice(product.price);
      if (!id || !title || !price) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const hints = [
        product.seller?.name ?? null,
        product.is_sell === false ? "품절" : null,
      ].filter(Boolean);

      offers.push({
        source: "brandi",
        sourceLabel: "브랜디",
        price,
        title,
        link: `${PRODUCT_ORIGIN}/products/${encodeURIComponent(id)}`,
        image: product.image_url ?? product.web_image_url ?? null,
        availability: offerAvailability(product.is_sell === false),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
