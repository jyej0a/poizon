import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import {
  decodeHtmlText,
  normalizeArticleNumber,
  parsePrice,
  splitByMarker,
} from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const SEARCH_URL = "https://www.gsshop.com/shop/search/main.gs";
const BROWSER_UA = "Mozilla/5.0";

function productLink(prdId: string): string {
  return `https://www.gsshop.com/prd/prd.gs?prdid=${prdId}`;
}

/**
 * GS샵 검색 HTML(`/shop/search/main.gs`)에 상품 카드가 포함되어 있다.
 * `#searchPrdList` 안의 `data-prdid` 카드만 파싱한다.
 */
export const gsShopProvider: SourceOfferProvider = {
  key: "gsshop",
  label: "GS샵",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const url = `${SEARCH_URL}?tq=${encodeURIComponent(normalized)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
        Referer: `${SEARCH_URL}?tq=${encodeURIComponent(normalized)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`GS샵 응답 오류 (${response.status})`);
    }

    const html = await response.text();
    const listStart = html.indexOf('id="searchPrdList"');
    const section = listStart >= 0 ? html.slice(listStart) : html;
    const blocks = splitByMarker(section, "data-prdid=");
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      const prdId = block.match(/data-prdid="(\d+)"/i)?.[1];
      if (!prdId || seen.has(prdId)) continue;

      const title = decodeHtmlText(
        block.match(/<dt class="prd-name">([\s\S]*?)<\/dt>/i)?.[1] ?? ""
      );
      const price =
        parsePrice(block.match(/<span class="set-price">\s*<strong>([\d,]+)<\/strong>/i)?.[1]) ||
        parsePrice(block.match(/<del class="price-upper">([\d,]+)/i)?.[1]);
      const image = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
      const soldOut = /품절/.test(block);

      if (!title || !price) continue;
      seen.add(prdId);

      offers.push({
        source: "gsshop",
        sourceLabel: "GS샵",
        price,
        title,
        link: productLink(prdId),
        image,
        availability: offerAvailability(soldOut),
        availabilityHint: soldOut ? "품절" : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
