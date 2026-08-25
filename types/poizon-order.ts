export const ORDER_TYPES = {
  NORMAL_SALE: "NORMAL_SALE",
  CONSIGN: "CONSIGN",
  PRE_SALE: "PRE_SALE",
  DIRECT: "DIRECT",
} as const;

export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

export const ORDER_TYPE_LABEL: Record<string, string> = {
  NORMAL_SALE: "현물",
  CONSIGN: "위탁",
  PRE_SALE: "프리세일",
  DIRECT: "직배",
};

/** 실데이터 order_status. 문서 apiDetail/102 */
export const ORDER_STATUS = {
  PENDING_PAY: 1000,
  PENDING_SHIP: 2000,
  SELLER_SHIPPED: 2100,
  PLATFORM_RECEIVED: 2200,
  QC_DONE: 2500,
  WAIT_PLATFORM_SHIP: 2550,
  PLATFORM_SHIPPED: 2600,
  CUSTOMS_PICKED: 2650,
  LOGISTICS_COLLECTED: 2700,
  DELIVERED: 2800,
  WAIT_BUYER: 3040,
  SUCCESS: 4000,
  FAILED: 7000,
  CLOSING: 8000,
  CLOSED_NO_RETURN: 8010,
  REFUND_RETURN: 8080,
} as const;

export type OrderStatusTab = "all" | "pendingShip" | "inspect" | "transit" | "done" | "closed";

export const ORDER_STATUS_TABS: { key: OrderStatusTab; label: string; statuses?: number[] }[] = [
  { key: "all", label: "전체" },
  { key: "pendingShip", label: "발송 대기", statuses: [ORDER_STATUS.PENDING_SHIP] },
  {
    key: "inspect",
    label: "검수",
    statuses: [
      ORDER_STATUS.SELLER_SHIPPED,
      ORDER_STATUS.PLATFORM_RECEIVED,
      ORDER_STATUS.QC_DONE,
      ORDER_STATUS.WAIT_PLATFORM_SHIP,
    ],
  },
  {
    key: "transit",
    label: "배송",
    statuses: [
      ORDER_STATUS.PLATFORM_SHIPPED,
      ORDER_STATUS.CUSTOMS_PICKED,
      ORDER_STATUS.LOGISTICS_COLLECTED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.WAIT_BUYER,
    ],
  },
  { key: "done", label: "완료", statuses: [ORDER_STATUS.SUCCESS] },
  {
    key: "closed",
    label: "취소·반품",
    statuses: [
      ORDER_STATUS.PENDING_PAY,
      ORDER_STATUS.FAILED,
      ORDER_STATUS.CLOSING,
      ORDER_STATUS.CLOSED_NO_RETURN,
      ORDER_STATUS.REFUND_RETURN,
    ],
  },
];

export const ORDER_STATUS_LABEL: Record<number, { label: string; color: string }> = {
  [ORDER_STATUS.PENDING_PAY]: { label: "결제 대기", color: "text-yellow-700 bg-yellow-500/10 border-yellow-500/20" },
  [ORDER_STATUS.PENDING_SHIP]: { label: "발송 대기", color: "text-amber-700 bg-amber-500/10 border-amber-500/20" },
  [ORDER_STATUS.SELLER_SHIPPED]: { label: "판매자 발송", color: "text-blue-700 bg-blue-500/10 border-blue-500/20" },
  [ORDER_STATUS.PLATFORM_RECEIVED]: { label: "플랫폼 입고", color: "text-blue-700 bg-blue-500/10 border-blue-500/20" },
  [ORDER_STATUS.QC_DONE]: { label: "검수 완료", color: "text-cyan-700 bg-cyan-500/10 border-cyan-500/20" },
  [ORDER_STATUS.WAIT_PLATFORM_SHIP]: { label: "플랫폼 발송 대기", color: "text-cyan-700 bg-cyan-500/10 border-cyan-500/20" },
  [ORDER_STATUS.PLATFORM_SHIPPED]: { label: "플랫폼 발송", color: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20" },
  [ORDER_STATUS.CUSTOMS_PICKED]: { label: "통관·집하", color: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20" },
  [ORDER_STATUS.LOGISTICS_COLLECTED]: { label: "택배 집하", color: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20" },
  [ORDER_STATUS.DELIVERED]: { label: "배송 완료", color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20" },
  [ORDER_STATUS.WAIT_BUYER]: { label: "구매자 수령 대기", color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20" },
  [ORDER_STATUS.SUCCESS]: { label: "거래 성공", color: "text-emerald-700 bg-emerald-500/15 border-emerald-500/25" },
  [ORDER_STATUS.FAILED]: { label: "거래 실패", color: "text-red-600 bg-red-500/10 border-red-500/20" },
  [ORDER_STATUS.CLOSING]: { label: "거래 마감", color: "text-slate-600 bg-slate-500/10 border-slate-500/20" },
  [ORDER_STATUS.CLOSED_NO_RETURN]: { label: "마감(반품 없음)", color: "text-slate-600 bg-slate-500/10 border-slate-500/20" },
  [ORDER_STATUS.REFUND_RETURN]: { label: "환불·반품", color: "text-red-600 bg-red-500/10 border-red-500/20" },
};

export const IDENTIFY_TYPE_LABEL: Record<number, string> = {
  1: "일반 검수",
  2: "검수 면제",
  3: "온라인 검수",
};

export const ONLINE_IDENTIFY_STATUS_LABEL: Record<number, string> = {
  0: "검수 대기",
  1: "검수 중",
  2: "검수 통과",
  3: "검수 실패",
  4: "검수 취소",
  5: "보완 중",
};

/** 문서에 공개된 운송사 ID. KR 전용 목록 API는 실데이터 404 */
export const KNOWN_CARRIERS: { id: number; label: string }[] = [
  { id: 7, label: "UPS" },
  { id: 8, label: "FedEx" },
  { id: 9, label: "USPS" },
  { id: 10, label: "YAMATO" },
  { id: 11, label: "SAGAWA" },
  { id: 22, label: "DHL" },
  { id: 100, label: "직접 배송" },
];

export function canShipOrder(status: number) {
  return status === ORDER_STATUS.PENDING_SHIP;
}

export interface ParsedOrder {
  orderNo: string;
  orderType: string;
  orderStatus: number;
  skuId: number;
  spuId: number;
  articleNumber: string;
  productName: string;
  sizeInfo: string;
  image: string;
  quantity: number;
  amount: number;
  payAmount: number;
  currency: string;
  payTime: string;
  createdAt: string;
  earliestDeliveryTime: string;
  expressNo: string;
  carrier: string;
  platformAddress: string;
  identifyType: number;
  onlineIdentifyStatus: number;
  poundagePercent: number;
  poundageAmount: number;
  deliveryLimitTime: string;
  sellerBiddingNo: string;
}

export interface OrderListResult {
  orders: ParsedOrder[];
  pageNo: number;
  pageSize: number;
  total: number;
}
