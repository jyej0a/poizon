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
  /** 품절/재고/즉시구매 가능성 등 간단 힌트 */
  availabilityHint?: string | null;
  /** 입력 품번과 매칭된 것으로 추정되는 품번 */
  normalizedArticleNumber: string;
  fetchedAt: string;
}

export type SourceOfferStatus = "pending" | "ok" | "empty" | "failed" | "skipped";
