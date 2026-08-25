import { mapWithConcurrency } from "@/lib/api/retry";
import type { SourceOffer } from "@/types/source-offer";
import {
  decodeHtmlText,
  normalizeArticleNumber,
  parsePrice,
  splitByMarker,
} from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

const ABC_ORIGIN = "https://abcmart.a-rt.com";
const SEARCH_LIST_URL = `${ABC_ORIGIN}/display/search-word/result/list`;
const PRODUCT_INFO_URL = `${ABC_ORIGIN}/product/info`;
const BROWSER_UA = "Mozilla/5.0";

/** 10001 ABC마트 · 10002 그랜드스테이지 */
const CHANNELS = [
  { no: "10001", label: "ABC마트" },
  { no: "10002", label: "그랜드스테이지" },
] as const;

const MAX_PRODUCT_INFO = 12;

interface AbcSearchCard {
  prdtNo: string;
  title: string;
  price: number | null;
  image: string | null;
  soldOut: boolean;
  channelLabel: string;
}

interface AbcProductInfo {
  prdtNo?: string;
  prdtName?: string;
  engPrdtName?: string;
  styleInfo?: string;
  prdtColorInfo?: string;
  displayProductPrice?: number;
  displayName?: string;
  brand?: { brandName?: string };
  productImage?: Array<{ imageUrl?: string }>;
}

function attr(block: string, name: string): string | null {
  const match = block.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeHtmlText(match[1]) : null;
}

function innerByClass(block: string, className: string, tag = "span"): string {
  const open = new RegExp(`<${tag} class="${className}"[^>]*>`, "i").exec(block);
  if (!open) return "";

  const start = open.index + open[0].length;
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  let depth = 1;
  let cursor = start;

  while (cursor < block.length && depth > 0) {
    const nextOpen = block.toLowerCase().indexOf(openTag, cursor);
    const nextClose = block.toLowerCase().indexOf(closeTag, cursor);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + openTag.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return decodeHtmlText(block.slice(start, nextClose));
    cursor = nextClose + closeTag.length;
  }

  return "";
}

function absolute(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${ABC_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * 나이키 스타일-컬러(`CW2288-111`)처럼 끝 구간이 색상 코드면 스타일만 남긴다.
 * ABC 검색은 전체 품번을 거의 못 찾고 스타일 접두만 찾는다.
 */
function styleSearchKeyword(articleNumber: string): string | null {
  const match = articleNumber.match(/^(.+)-(\d{2,4})$/);
  if (!match || match[1].length < 4) return null;
  return match[1];
}

function parseSearchCards(html: string, channelLabel: string): AbcSearchCard[] {
  const blocks = splitByMarker(html, "data-product-no=");
  const cards: AbcSearchCard[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const prdtNo = attr(block, "data-product-no");
    if (!prdtNo || seen.has(prdtNo)) continue;

    const brand = innerByClass(block, "prod-brand");
    const name = innerByClass(block, "prod-name");
    const title = [brand, name].filter(Boolean).join(" ");
    const price =
      parsePrice(block.match(/class="price-cost"[^>]*>\s*([\d,]+)/i)?.[1]) ||
      parsePrice(block.match(/class="price-normal-cost"[^>]*>\s*([\d,]+)/i)?.[1]);
    const image =
      block.match(/<img[^>]*class="search-prod-image"[^>]*src="([^"]+)"/i)?.[1] ??
      block.match(/<img[^>]*src="([^"]+)"[^>]*class="search-prod-image"/i)?.[1] ??
      null;
    const soldOut = /sold-out/i.test(block.slice(0, 240));

    seen.add(prdtNo);
    cards.push({
      prdtNo,
      title,
      price,
      image,
      soldOut,
      channelLabel,
    });
  }

  return cards;
}

async function fetchSearchList(keyword: string, channelNo: string): Promise<string> {
  const params = new URLSearchParams({
    sort: "point",
    page: "1",
    perPage: "30",
    pageColumn: "3",
    smartSearchCheck: "true",
    deviceCode: "10000",
    searchWord: keyword,
    firstSearchWord: keyword,
    tabGubun: "total",
    searchPageGubun: "product",
    firstSearchYn: "Y",
    channel: channelNo,
    resultChannel: channelNo,
  });

  const response = await fetch(`${SEARCH_LIST_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${ABC_ORIGIN}/display/search-word/result?searchWord=${encodeURIComponent(keyword)}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ABC마트 검색 응답 오류 (${response.status})`);
  }

  return response.text();
}

async function fetchProductInfo(prdtNo: string): Promise<AbcProductInfo | null> {
  const params = new URLSearchParams({ prdtNo });
  const response = await fetch(`${PRODUCT_INFO_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${ABC_ORIGIN}/product?prdtNo=${encodeURIComponent(prdtNo)}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const body = (await response.json()) as AbcProductInfo & { status?: number };
  if (typeof body.status === "number" && body.status >= 400) return null;
  if (!body.prdtNo) return null;
  return body;
}

function articleCode(info: AbcProductInfo): string {
  const style = (info.styleInfo ?? "").trim();
  const color = (info.prdtColorInfo ?? "").trim();
  if (style && color) return `${style}-${color}`;
  return style;
}

/**
 * ABC마트 검색 페이지 HTML에는 상품이 없고, 목록은 AJAX `result/list`에 있다.
 * 카드 제목에는 품번이 없어서 `/product/info`의 스타일·컬러로 검증용 제목을 만든다.
 */
export const abcMartProvider: SourceOfferProvider = {
  key: "abcmart",
  label: "ABC마트",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const keywords = [normalized];
    const prefix = styleSearchKeyword(normalized);
    if (prefix && prefix !== normalized) keywords.push(prefix);

    const cardMap = new Map<string, AbcSearchCard>();
    let lastError: Error | null = null;

    for (const keyword of keywords) {
      const pages = await Promise.all(
        CHANNELS.map(async (channel) => {
          try {
            const html = await fetchSearchList(keyword, channel.no);
            return parseSearchCards(html, channel.label);
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            return [] as AbcSearchCard[];
          }
        })
      );

      for (const card of pages.flat()) {
        if (!cardMap.has(card.prdtNo)) cardMap.set(card.prdtNo, card);
      }

      if (cardMap.size > 0) break;
    }

    if (cardMap.size === 0 && lastError) throw lastError;

    const cards = [...cardMap.values()].slice(0, MAX_PRODUCT_INFO);
    const fetchedAt = new Date().toISOString();
    const infos = await mapWithConcurrency(cards, 4, (card) => fetchProductInfo(card.prdtNo));
    const offers: SourceOffer[] = [];

    for (const [index, card] of cards.entries()) {
      const info = infos[index];
      const code = info ? articleCode(info) : "";
      const title = [
        info?.brand?.brandName,
        info?.prdtName ?? card.title,
        info?.engPrdtName,
        info?.displayName,
        code,
      ]
        .filter(Boolean)
        .join(" ");
      const price = parsePrice(info?.displayProductPrice) ?? card.price;
      const link = `${ABC_ORIGIN}/product?prdtNo=${encodeURIComponent(card.prdtNo)}`;
      if (!price || !title || !link) continue;

      const hints = [
        card.channelLabel,
        card.soldOut ? "품절" : null,
        info?.brand?.brandName || null,
      ].filter(Boolean);

      offers.push({
        source: "abcmart",
        sourceLabel: "ABC마트",
        price,
        title,
        link,
        image: card.image ?? info?.productImage?.[0]?.imageUrl ?? null,
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
