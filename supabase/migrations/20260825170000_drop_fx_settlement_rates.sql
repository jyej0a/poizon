-- POIZON 입찰·수수료·원가는 전부 KRW. 환율 컬럼은 사용하지 않음
ALTER TABLE public.system_settings
  DROP COLUMN IF EXISTS fx_cny_krw,
  DROP COLUMN IF EXISTS fx_settlement_cny_krw;
