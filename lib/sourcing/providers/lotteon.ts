import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import {
  extractJsonObjectsContainingKey,
  normalizeArticleNumber,
  parsePrice,
} from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface LotteProduct {
  pdName?: string;
  pdLink?: string;
  pdImage?: string;
  storeName?: string;
  brandName?: string;
  soldOutYn?: string;
  adImpUrl?: string;
  priceInfo?: {
    original?: string;
    discount?: string;
    finalPrice?: string;
  };
}

const LOTTE_ORIGIN = "https://www.lotteon.com";
const LOTTE_IMAGE_ORIGIN = "https://contents.lotteon.com";

function absolute(origin: string, path: string | undefined | null): string | null {
  if (!path) return null;
  const cleaned = path.replace(/\\\//g, "/");
  return cleaned.startsWith("http") ? cleaned : `${origin}${cleaned}`;
}

function buildSearchUrl(articleNumber: string, mallNo?: number): string {
  const params = new URLSearchParams({
    render: "search",
    platform: "pc",
    q: articleNumber,
  });
  if (mallNo != null) params.set("mall_no", String(mallNo));
  return `https://www.lotteon.com/search/search/search.ecn?${params.toString()}`;
}

function createLotteOnProvider(options: {
  key: string;
  label: string;
  mallNo?: number;
}): SourceOfferProvider {
  return {
    key: options.key,
    label: options.label,
    async fetchOffers(articleNumber: string) {
      const normalized = normalizeArticleNumber(articleNumber);
      const response = await fetch(buildSearchUrl(normalized, options.mallNo), {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`${options.label} 응답 오류 (${response.status})`);
      }

      const html = await response.text();
      const products = extractJsonObjectsContainingKey<LotteProduct>(html, "priceInfo");
      const fetchedAt = new Date().toISOString();
      const offers: SourceOffer[] = [];

      for (const product of products) {
        const price = parsePrice(product.priceInfo?.finalPrice);
        const link = absolute(LOTTE_ORIGIN, product.pdLink ? `/p${product.pdLink}` : null);
        if (!price || !product.pdName || !link) continue;

        const hints = [
          product.soldOutYn === "Y" ? "품절" : null,
          product.adImpUrl ? "광고" : null,
          product.storeName || null,
        ].filter(Boolean);

        offers.push({
          source: options.key,
          sourceLabel: options.label,
          price,
          title: product.pdName,
          link,
          image: absolute(LOTTE_IMAGE_ORIGIN, product.pdImage),
          availability: offerAvailability(product.soldOutYn === "Y"),
          availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
          normalizedArticleNumber: normalized,
          fetchedAt,
        });
      }

      return { offers };
    },
  };
}

export const lotteOnProvider = createLotteOnProvider({
  key: "lotteon",
  label: "롯데ON",
});

/** ellotte.com은 롯데ON `mall_no=2`로 리다이렉트된다. */
export const lotteDepartmentProvider = createLotteOnProvider({
  key: "lottedpt",
  label: "롯데백화점몰",
  mallNo: 2,
});
