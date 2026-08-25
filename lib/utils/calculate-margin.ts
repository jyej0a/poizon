export interface SystemSettings {
  fee_percentage: number;
  min_fee: number;
  max_fee: number;
  /** 원가 대비 목표 순수익 % */
  target_margin_rate: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  fee_percentage: 10,
  min_fee: 15000,
  max_fee: 45000,
  target_margin_rate: 20,
};

export interface MarginResult {
  salePrice: number;
  fee: number;
  /** 입찰가 − 수수료 (KRW, 원가 차감 전) */
  netProfit: number;
  marginRate: number;
}

/**
 * 마진 및 수수료를 계산하는 함수
 * @param salePrice 판매 가격 (입찰가, KRW)
 * @param settings DB에서 가져온 시스템 설정 (수수료율, 최소/최대 수수료)
 */
export function calculateMargin(salePrice: number, settings: SystemSettings): MarginResult {
  const feePercentage = Number(settings.fee_percentage) / 100;
  const minFee = Number(settings.min_fee);
  const maxFee = Number(settings.max_fee);

  let fee = salePrice * feePercentage;
  fee = Math.max(minFee, Math.min(fee, maxFee));
  fee = Math.ceil(fee);

  const netProfit = salePrice - fee;
  const marginRate = (netProfit / salePrice) * 100;

  return {
    salePrice,
    fee,
    netProfit,
    marginRate: parseFloat(marginRate.toFixed(2)),
  };
}

/** 입찰가(또는 노출가) 대비 원가의 실제 정산 이익 */
export function computeBidVsCostMargin(
  priceStr: string | undefined,
  cost: number | undefined,
  settings: SystemSettings | null
) {
  if (!priceStr || !settings) return null;
  const price = Number(priceStr);
  if (!price || price <= 0) return null;
  const margin = calculateMargin(price, settings);
  const actualProfit = cost ? margin.netProfit - cost : margin.netProfit;
  const actualRate = cost ? (actualProfit / cost) * 100 : margin.marginRate;
  return {
    ...margin,
    actualProfit,
    actualRate: parseFloat(actualRate.toFixed(2)),
  };
}

/**
 * 원가와 목표 마진율(원가 대비 순수익)을 만족하는 최소 입찰가.
 * 수수료 = ceil(clamp(입찰가 × 요율, min, max)).
 */
export function recommendBidFromCost(
  cost: number | null | undefined,
  settings: SystemSettings | null | undefined
): number | null {
  if (cost == null || !settings) return null;
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return null;

  const ratePct = Number(settings.target_margin_rate);
  const rate = Number.isFinite(ratePct) ? ratePct / 100 : 0;
  if (rate <= -1) return null;

  const need = c * (1 + rate);
  if (!(need > 0)) return null;

  let p = Math.max(1, Math.ceil(need));
  for (let i = 0; i < 8000; i++) {
    const { netProfit } = calculateMargin(p, settings);
    if (netProfit + 1e-9 >= need) return p;
    p += Math.max(1, Math.ceil(need - netProfit));
  }
  return p;
}
