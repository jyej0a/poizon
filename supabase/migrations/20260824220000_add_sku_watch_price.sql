-- SKU(옵션) 가격 알림: 노출가가 이 값 이하이면 도달
ALTER TABLE public.sku_status
  ADD COLUMN IF NOT EXISTS watch_price INTEGER,
  ADD COLUMN IF NOT EXISTS watch_at TIMESTAMPTZ;
