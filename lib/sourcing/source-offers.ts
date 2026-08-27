import { mapWithConcurrency } from "@/lib/api/retry";
import { loadActiveSourceProviders } from "@/lib/sourcing/source-malls";
import type { SourceOfferProvider } from "@/lib/sourcing/types";
import {
  dedupeAndSortOffers,
  matchesArticleNumber,
  normalizeArticleNumber,
} from "@/lib/sourcing/utils";
import type { SourceOffer, SourceOfferStatus } from "@/types/source-offer";

export interface AggregatedSourceOfferResult {
  offers: SourceOffer[];
  status: SourceOfferStatus;
  warnings: string[];
}

export function filterOffersByActiveSources(
  offers: SourceOffer[],
  providers: SourceOfferProvider[]
): SourceOffer[] {
  const activeKeys = new Set(providers.map((provider) => provider.key));
  return offers.filter((offer) => activeKeys.has(offer.source));
}

/**
 * 여러 몰에서 품번 기준 오퍼를 모아 상위 10개를 만든다.
 * 살 수 있는 오퍼를 품절보다 앞에 두고, 같은 몰이라도 다른 상품/페이지면
 * 중복 허용하되 동일 링크는 dedupe한다.
 */
export async function fetchTopSourceOffers(
  articleNumber: string,
  options?: { providers?: SourceOfferProvider[] }
): Promise<AggregatedSourceOfferResult> {
  const normalized = normalizeArticleNumber(articleNumber);
  if (!normalized || normalized === "N/A") {
    return { offers: [], status: "skipped", warnings: [] };
  }

  const providers = options?.providers ?? (await loadActiveSourceProviders());
  if (providers.length === 0) {
    return {
      offers: [],
      status: "skipped",
      warnings: ["활성화된 수집 몰이 없습니다."],
    };
  }

  // 수집 실패와 단순 필터링 결과를 나눠 둔다. 품번이 안 맞아 비는 것은 정상이며,
  // 이를 실패로 올리면 잡이 불필요하게 `partial`로 남는다.
  const providerErrors: string[] = [];
  const notices: string[] = [];

  const collected = await mapWithConcurrency(providers, 4, async (provider) => {
    try {
      return await provider.fetchOffers(normalized);
    } catch (error) {
      providerErrors.push(
        `${provider.label} 수집 실패: ${error instanceof Error ? error.message : String(error)}`
      );
      return { offers: [] };
    }
  });

  const gathered = collected.flatMap((result) => result.offers);

  // 몰 검색은 품번으로 질의해도 무관한 상품을 섞어 돌려준다. 걸러내지 않으면
  // 최저가가 다른 모델의 가격이 되어 원가와 마진이 함께 어긋난다.
  const matched = gathered.filter(
    (offer) =>
      matchesArticleNumber(offer.title, normalized) || matchesArticleNumber(offer.link, normalized)
  );
  const droppedCount = gathered.length - matched.length;
  if (droppedCount > 0) {
    notices.push(`품번 불일치 오퍼 ${droppedCount}건 제외`);
  }

  const offers = dedupeAndSortOffers(matched, 10);
  const status: SourceOfferStatus =
    offers.length > 0 ? "ok" : providerErrors.length > 0 ? "failed" : "empty";

  return {
    offers,
    status,
    // 오퍼를 확보했으면 필터링 안내는 잡 경고로 올리지 않는다
    warnings: offers.length > 0 ? providerErrors : [...providerErrors, ...notices],
  };
}
