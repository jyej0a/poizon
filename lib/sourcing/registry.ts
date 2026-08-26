import { abcMartProvider } from "@/lib/sourcing/providers/abcmart";
import { twentyNineCmProvider } from "@/lib/sourcing/providers/29cm";
import { elevenStProvider } from "@/lib/sourcing/providers/11st";
import { cjOnstyleProvider } from "@/lib/sourcing/providers/cjonstyle";
import { elandMallProvider } from "@/lib/sourcing/providers/elandmall";
import { gmarketProvider } from "@/lib/sourcing/providers/gmarket";
import { gsShopProvider } from "@/lib/sourcing/providers/gsshop";
import { hiverProvider } from "@/lib/sourcing/providers/hiver";
import { hmallProvider } from "@/lib/sourcing/providers/hmall";
import { lfMallProvider } from "@/lib/sourcing/providers/lfmall";
import { theHyundaiProvider } from "@/lib/sourcing/providers/thehyundai";
import { kolonMallProvider } from "@/lib/sourcing/providers/kolonmall";
import { lotteImallProvider } from "@/lib/sourcing/providers/lotteimall";
import { lotteDepartmentProvider, lotteOnProvider } from "@/lib/sourcing/providers/lotteon";
import { musinsaProvider } from "@/lib/sourcing/providers/musinsa";
import { nikeKrProvider } from "@/lib/sourcing/providers/nike";
import { ssgProvider } from "@/lib/sourcing/providers/ssg";
import { wconceptProvider } from "@/lib/sourcing/providers/wconcept";
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
    provider: nikeKrProvider,
    homepage: "https://www.nike.com/kr",
    reliability: "ok",
    notes: "공식몰 Wall SSR(__NEXT_DATA__). 나이키 품번에 강함",
  },
  {
    provider: elandMallProvider,
    homepage: "https://www.elandmall.com",
    reliability: "ok",
    notes: "검색 HTML 상품 카드 파싱",
  },
  {
    provider: abcMartProvider,
    homepage: "https://abcmart.a-rt.com",
    reliability: "ok",
    notes: "검색 AJAX result/list + 상품 info 스타일/컬러 검증. 채널 10001·10002",
  },
  {
    provider: twentyNineCmProvider,
    homepage: "https://www.29cm.co.kr",
    reliability: "ok",
    notes: "display-bff POST listing/items (pageType=SRP). 검색 HTML에는 오퍼 없음",
  },
  {
    provider: wconceptProvider,
    homepage: "https://www.wconcept.co.kr",
    reliability: "ok",
    notes: "api-display 검색. DISPLAY-API-KEY는 검색 페이지 runtimeConfig 공개값",
  },
  {
    provider: elevenStProvider,
    homepage: "https://www.11st.co.kr",
    reliability: "ok",
    notes: "검색 HTML은 빈 셸. apis.11st.co.kr/search/api/tab (poc=pc, TOTAL_SEARCH)",
  },
  {
    provider: gsShopProvider,
    homepage: "https://www.gsshop.com",
    reliability: "ok",
    notes: "검색 HTML #searchPrdList 카드 (data-prdid)",
  },
  {
    provider: hmallProvider,
    homepage: "https://www.hmall.com",
    reliability: "ok",
    notes: "검색 SPA. GET /api/hf/dp/v1/search/search?searchTerm=",
  },
  {
    provider: theHyundaiProvider,
    homepage: "https://hi.thehyundai.com",
    reliability: "ok",
    notes: "GET /proxy/v1/dp/search/searchResult (searchQuery, searchType=NCP_PRODUCT)",
  },
  {
    provider: cjOnstyleProvider,
    homepage: "https://www.cjonstyle.com",
    reliability: "ok",
    notes: "검색 HTML은 빈 셸. search.cjonstyle.com/search-web/search/cjmall/item.json",
  },
  {
    provider: lfMallProvider,
    homepage: "https://www.lfmall.co.kr",
    reliability: "ok",
    notes: "검색 POST는 CSRF 필요. GET nxapi multiSearch?multiKeywords= 사용",
  },
  {
    provider: hiverProvider,
    homepage: "https://www.hiver.co.kr",
    reliability: "ok",
    notes: "capi search/products. Authorization은 프론트 공개 guest 토큰(CM). 401 시 갱신",
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
