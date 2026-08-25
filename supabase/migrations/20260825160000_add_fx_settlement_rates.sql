-- 정산 환율: 1 CNY당 KRW. 참고(시장)와 정산이 같으면 실수령은 입찰가-수수료와 동일
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS fx_cny_krw DECIMAL(10,4) NOT NULL DEFAULT 190.0000,
  ADD COLUMN IF NOT EXISTS fx_settlement_cny_krw DECIMAL(10,4) NOT NULL DEFAULT 190.0000;
