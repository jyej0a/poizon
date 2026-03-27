export interface SystemSettings {
  fee_percentage: number;
  min_fee: number;
  max_fee: number;
}

export interface MarginResult {
  salePrice: number;
  fee: number;
  netProfit: number;
  marginRate: number;
}

/**
 * 마진 및 수수료를 계산하는 함수
 * @param salePrice 판매 가격 (입찰가)
 * @param settings DB에서 가져온 시스템 설정 (수수료율, 최소/최대 수수료)
 * @returns 마진 계산 결과 객체
 */
export function calculateMargin(salePrice: number, settings: SystemSettings): MarginResult {
  const feePercentage = Number(settings.fee_percentage) / 100;
  const minFee = Number(settings.min_fee);
  const maxFee = Number(settings.max_fee);

  // 기본 수수료 계산
  let fee = salePrice * feePercentage;

  // 최소/최대 수수료 캡 적용
  fee = Math.max(minFee, Math.min(fee, maxFee));

  // 정수로 올림 처리 (원 단위)
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
