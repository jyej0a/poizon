import type { SourceOffer } from "@/types/source-offer";
import {
  decodeHtmlText,
  normalizeArticleNumber,
  parsePrice,
  splitByMarker,
} from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const ELAND_ORIGIN = "https://www.elandmall.com";

function absolute(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${ELAND_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function attr(block: string, name: string): string | null {
  const match = block.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeHtmlText(match[1]) : null;
}

/**
 * 이랜드몰 검색 HTML의 상품 카드(`data-item-no` / `data-saleprice`)를 파싱한다.
 * 검색 결과는 서버 HTML에 포함되어 있어 별도 API 키가 필요 없다.
 */
export const elandMallProvider: SourceOfferProvider = {
  key: "elandmall",
  label: "이랜드몰",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = `https://www.elandmall.com/search/search.action?kwd=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`이랜드몰 응답 오류 (${response.status})`);
    }

    const html = await response.text();
    const blocks = splitByMarker(html, "data-item-no=");
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      const itemNo = attr(block, "data-item-no");
      if (!itemNo || seen.has(itemNo)) continue;

      const title =
        attr(block, "data-item-name") ||
        decodeHtmlText(block.match(/<p class="prd">\s*([\s\S]*?)\s*<\/p>/i)?.[1] ?? "");
      const price =
        parsePrice(attr(block, "data-saleprice")) ||
        parsePrice(attr(block, "data-sellprice")) ||
        parsePrice(block.match(/최종할인가<\/strong><em>([\d,]+)<\/em>/)?.[1]) ||
        parsePrice(block.match(/판매가<\/strong><em>([\d,]+)<\/em>/)?.[1]);

      const href =
        block.match(/href="(\/i\/item\?[^"]+)"/i)?.[1]?.replace(/&amp;/g, "&") ??
        (itemNo ? `/i/item?itemNo=${itemNo}` : null);
      const link = absolute(href);
      const image = attr(block, "data-image-path");
      const brand = attr(block, "data-brand-name");

      if (!price || !title || !link) continue;
      seen.add(itemNo);

      offers.push({
        source: "elandmall",
        sourceLabel: "이랜드몰",
        price,
        title: brand && !title.includes(brand) ? `${brand} ${title}` : title,
        link,
        image,
        availabilityHint: brand,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
