/**
 * Poizon API 관련 고정 상수 및 비즈니스 규칙 정의
 */

export const POIZON_CONSTANTS = {
  // 입찰 관련 기본값
  BIDDING: {
    // 20: Ship-to-Verify (검수 후 발송 - 해외 셀러 표준)
    // 25: Consignment (위탁 판매)
    DEFAULT_BIDDING_TYPE: 20,
    
    // 0: 일반 판매 (Normal Sale)
    DEFAULT_SALE_TYPE: 0,
    
    // 기본 국가 및 통화 코드
    DEFAULT_COUNTRY: "KR",
    DEFAULT_CURRENCY: "KRW",
    
    // 사이트 타입 (EU 기준이 가장 범용적)
    DEFAULT_SIZE_TYPE: "EU",
  },
  
  // 엔드포인트 모음
  ENDPOINTS: {
    // 상품 조회
    SEARCH_BY_ARTICLE: "/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-article-number",
    SPU_STATISTICS: "/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu-ids",
    
    // 입찰 실행 (Normal Bidding - 80000014 에러 해결책)
    SUBMIT_BID: "/dop/api/v1/pop/api/v1/submit-bid/normal-autonomous-bidding",
    
    // 입찰 추천
    RECOMMEND_PRICE: "/dop/api/v1/pop/api/v1/recommend-bid/price",
    
    // 입찰 관리 (Listing Management)
    LISTING_LIST: "/dop/api/v1/pop/api/v1/listing/list",
    CANCEL_BID: "/dop/api/v1/pop/api/v1/cancel-bid/cancel-bidding",
    AUTO_FOLLOW_LIST: "/dop/api/v1/pop/api/v1/auto-follow-bidding/list",
  }
} as const;
