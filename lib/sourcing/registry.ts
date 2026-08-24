import { gmarketProvider } from "@/lib/sourcing/providers/gmarket";
import { kolonMallProvider } from "@/lib/sourcing/providers/kolonmall";
import { lotteImallProvider } from "@/lib/sourcing/providers/lotteimall";
import { lotteDepartmentProvider, lotteOnProvider } from "@/lib/sourcing/providers/lotteon";
import { musinsaProvider } from "@/lib/sourcing/providers/musinsa";
import { ssgProvider } from "@/lib/sourcing/providers/ssg";
import type { SourceOfferProvider } from "@/lib/sourcing/types";
import type { SourceMallReliability } from "@/types/source-mall";

export interface SourceMallDefinition {
  provider: SourceOfferProvider;
  homepage: string;
  reliability: SourceMallReliability;
  notes: string | null;
}

/**
 * 수집 가능한 몰의 코드 원천.
 * 대시보드 목록과 원가 수집 대상은 이 배열에서 파생된다.
 */
export const SOURCE_MALL_DEFINITIONS: SourceMallDefinition[] = [
  {
    provider: lotteOnProvider,
    homepage: "https://www.lotteon.com",
    reliability: "ok",
    notes: null,
  },
  {
    provider: lotteDepartmentProvider,
    homepage: "https://www.lotteon.com",
    reliability: "ok",
    notes: "롯데ON mall_no=2로 수집",
  },
  {
    provider: lotteImallProvider,
    homepage: "https://www.lotteimall.com",
    reliability: "ok",
    notes: null,
  },
  {
    provider: musinsaProvider,
    homepage: "https://www.musinsa.com",
    reliability: "ok",
    notes: null,
  },
  {
    provider: kolonMallProvider,
    homepage: "https://www.kolonmall.com",
    reliability: "ok",
    notes: "persisted query hash 변경 시 파서 갱신 필요",
  },
  {
    provider: ssgProvider,
    homepage: "https://www.ssg.com",
    reliability: "ok",
    notes: null,
  },
  {
    provider: gmarketProvider,
    homepage: "https://www.gmarket.co.kr",
    reliability: "limited",
    notes: "서버 수집은 Akamai 차단(403)으로 빈 결과가 나올 수 있음",
  },
];

export function getSourceMallDefinition(key: string): SourceMallDefinition | undefined {
  return SOURCE_MALL_DEFINITIONS.find((definition) => definition.provider.key === key);
}

export function listRegisteredProviders(): SourceOfferProvider[] {
  return SOURCE_MALL_DEFINITIONS.map((definition) => definition.provider);
}

export function getProviderByKey(key: string): SourceOfferProvider | undefined {
  return getSourceMallDefinition(key)?.provider;
}
