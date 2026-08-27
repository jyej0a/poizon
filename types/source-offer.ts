export const OFFER_AVAILABILITY = {
  inStock: "in_stock",
  soldOut: "sold_out",
  unknown: "unknown",
} as const;

export type OfferAvailability = (typeof OFFER_AVAILABILITY)[keyof typeof OFFER_AVAILABILITY];

export interface SourceOffer {
  /** 집계 소스 식별자 (`lotteon`, `musinsa` 등) */
  source: string;
  /** UI 표기용 몰 이름 */
  sourceLabel: string;
  /** 최종 구매가 후보. 항상 원 단위 숫자 */
  price: number;
  title: string;
  link: string;
  image?: string | null;
  /** 재고 판정. 없으면 `unknown`으로 보고 hint의 품절 토큰으로 폴백 */
  availability?: OfferAvailability;
  /** 품절/재고/즉시구매 가능성 등 간단 힌트 */
  availabilityHint?: string | null;
  /** 입력 품번과 매칭된 것으로 추정되는 품번 */
  normalizedArticleNumber: string;
  fetchedAt: string;
}

export type SourceOfferStatus = "pending" | "ok" | "empty" | "failed" | "skipped";
