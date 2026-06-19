-- SKU(옵션) 단위 메모 저장
CREATE TABLE IF NOT EXISTS public.sku_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL,
    spu_id BIGINT,
    memo TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_sku_status_user_id ON public.sku_status(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_status_sku_id ON public.sku_status(user_id, sku_id);

ALTER TABLE public.sku_status ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.sku_status TO anon;
GRANT ALL ON TABLE public.sku_status TO authenticated;
GRANT ALL ON TABLE public.sku_status TO service_role;
