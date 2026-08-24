import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface NikeWallProduct {
  productCode?: string;
  copy?: { title?: string; subTitle?: string };
  prices?: { currentPrice?: number; initialPrice?: number; currency?: string };
  colorwayImages?: { squarishURL?: string; portraitURL?: string };
  pdpUrl?: { url?: string; path?: string };
  badgeLabel?: string | null;
  featuredAttributes?: string[] | null;
}

interface NikeWallState {
  productGroupings?: Array<{ products?: NikeWallProduct[] }>;
  pageData?: { totalResources?: number };
}

/**
 * 나이키 코리아 검색 Wall SSR(`__NEXT_DATA__`)에서 상품을 읽는다.
 * 품번(style-color) 검색에 강하고, 공식몰 정가/할인가를 바로 쓸 수 있다.
 */
export const nikeKrProvider: SourceOfferProvider = {
  key: "nike",
  label: "나이키",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = `https://www.nike.com/kr/w?q=${encodeURIComponent(normalized)}&vst=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        Accept: "text/html",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`나이키 코리아 응답 오류 (${response.status})`);
    }

    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      throw new Error("나이키 코리아 검색 데이터를 찾지 못했습니다");
    }

    const nextData = JSON.parse(match[1]) as {
      props?: { pageProps?: { initialState?: { Wall?: NikeWallState } } };
    };
    const wall = nextData.props?.pageProps?.initialState?.Wall;
    const products =
      wall?.productGroupings?.flatMap((group) => group.products ?? []) ?? [];

    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const product of products) {
      const price = parsePrice(product.prices?.currentPrice ?? product.prices?.initialPrice);
      const title = [product.copy?.title, product.copy?.subTitle, product.productCode]
        .filter(Boolean)
        .join(" ");
      const link = product.pdpUrl?.url ?? (product.pdpUrl?.path ? `https://www.nike.com${product.pdpUrl.path}` : null);
      if (!price || !title || !link) continue;

      const hints = [
        product.badgeLabel || null,
        ...(product.featuredAttributes ?? []),
      ].filter(Boolean);

      offers.push({
        source: "nike",
        sourceLabel: "나이키",
        price,
        title,
        link,
        image: product.colorwayImages?.squarishURL ?? product.colorwayImages?.portraitURL ?? null,
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
