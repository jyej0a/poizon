-- SKU 옵션별 수동 입찰 표기
ALTER TABLE public.sku_status
  ADD COLUMN IF NOT EXISTS manual_bid_marked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_bid_at TIMESTAMPTZ;
