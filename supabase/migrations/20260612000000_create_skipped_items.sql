-- 20260612000000_create_skipped_items.sql
-- 이미 확인한 품목(SKU)을 체크 표시하고 흐리게 처리하기 위한 테이블

CREATE TABLE IF NOT EXISTS public.skipped_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sku_id TEXT NOT NULL,
    spu_id TEXT,
    article_number TEXT,
    skipped_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, sku_id)
);

-- RLS 비활성화 (기존 테이블 패턴 준수)
ALTER TABLE public.skipped_items DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.skipped_items TO anon;
GRANT ALL ON TABLE public.skipped_items TO authenticated;
GRANT ALL ON TABLE public.skipped_items TO service_role;
