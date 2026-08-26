-- 가격 워치 Web Push: 도달 1회 발송·재무장, 워커 폴링 시각
-- (docs/PRD.md §5.1, docs/TODO.md §7)

ALTER TABLE public.sku_status
  ADD COLUMN IF NOT EXISTS watch_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS watch_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sku_status_watch_due
  ON public.sku_status (watch_checked_at)
  WHERE watch_price IS NOT NULL;
