import { offerAvailability } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";
import { normalizeArticleNumber, parsePrice } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";

interface GmarketText {
  text?: string;
}

interface GmarketViewModel {
  itemNo?: string;
  isSoldOut?: boolean;
  title?: { title?: GmarketText };
  commonItemInfo?: {
    item?: {
      text?: string;
      imageUrl?: string;
      link?: string;
    };
    price?: {
      binPrice?: string;
      price?: GmarketText;
    };
    brand?: GmarketText;
  };
}

interface GmarketNextData {
  props?: {
    pageProps?: {
      initialStates?: {
        curatorData?: {
          regionsData?: {
            content?: {
              modules?: Array<{
                rows?: Array<{ viewModel?: GmarketViewModel }>;
              }>;
            };
          };
        };
      };
    };
  };
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as GmarketText).text;
    return typeof text === "string" && text.trim() ? text : null;
  }
  return null;
}

function collectViewModels(data: GmarketNextData): GmarketViewModel[] {
  const modules = data.props?.pageProps?.initialStates?.curatorData?.regionsData?.content?.modules ?? [];
  const models: GmarketViewModel[] = [];
  for (const contentModule of modules) {
    for (const row of contentModule.rows ?? []) {
      if (row.viewModel?.commonItemInfo?.item) models.push(row.viewModel);
    }
  }
  return models;
}

export const gmarketProvider: SourceOfferProvider = {
  key: "gmarket",
  label: "G마켓",
  async fetchOffers(articleNumber: string) {
    const normalized = normalizeArticleNumber(articleNumber);
    const response = await fetch(
      `https://www.gmarket.co.kr/n/search?keyword=${encodeURIComponent(normalized)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        cache: "no-store",
        redirect: "follow",
      }
    );

    const html = await response.text();
    // Akamai 봇 챌린지(403 / 검토번호 페이지)는 서버 fetch에서 통과하지 못한다.
    // 검색마다 잡 경고가 쌓이지 않도록 빈 결과로 넘어간다.
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!response.ok || !match?.[1] || html.includes("검토번호")) {
      return { offers: [] };
    }

    const data = JSON.parse(match[1]) as GmarketNextData;
    const fetchedAt = new Date().toISOString();
    const offers: SourceOffer[] = [];

    for (const viewModel of collectViewModels(data)) {
      const item = viewModel.commonItemInfo?.item;
      const priceInfo = viewModel.commonItemInfo?.price;
      const price = parsePrice(textValue(priceInfo?.price) ?? priceInfo?.binPrice);
      const title = item?.text?.trim();
      const link = item?.link;
      if (!price || !title || !link) continue;

      const brand = textValue(viewModel.commonItemInfo?.brand);
      const hints = [
        viewModel.isSoldOut ? "품절" : null,
        viewModel.title?.title?.text === "광고상품" ? "광고" : null,
        brand,
      ].filter(Boolean);

      offers.push({
        source: "gmarket",
        sourceLabel: "G마켓",
        price,
        title: `${brand ? `${brand} ` : ""}${title}`,
        link,
        image: item.imageUrl
          ? item.imageUrl.startsWith("http")
            ? item.imageUrl
            : `https:${item.imageUrl}`
          : null,
        availability: offerAvailability(Boolean(viewModel.isSoldOut)),
        availabilityHint: hints.length > 0 ? hints.join(" · ") : null,
        normalizedArticleNumber: normalized,
        fetchedAt,
      });
    }

    return { offers };
  },
};
