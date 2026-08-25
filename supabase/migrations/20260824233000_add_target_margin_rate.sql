-- 목표 마진율(%): 원가 대비 순수익. 권장 입찰가 역산에 사용
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS target_margin_rate DECIMAL(6,2) NOT NULL DEFAULT 20.00;
