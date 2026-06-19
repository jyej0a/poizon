-- SKU(옵션) 단위 검토완료 표시
ALTER TABLE public.sku_status
  ADD COLUMN IF NOT EXISTS handled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
