-- SKU(옵션) 재고 보유 수동 표기
ALTER TABLE public.sku_status
  ADD COLUMN IF NOT EXISTS stock_marked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_marked_at TIMESTAMPTZ;
