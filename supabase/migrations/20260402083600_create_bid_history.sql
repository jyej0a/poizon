-- bid_history: 입찰 이력 관리 테이블
CREATE TABLE IF NOT EXISTS public.bid_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL,
    spu_id BIGINT,
    article_number TEXT,
    product_name TEXT,
    size_info TEXT,
    bid_price INTEGER NOT NULL,
    seller_bidding_no TEXT,
    status TEXT DEFAULT 'active',  -- active | sold | cancelled | expired | rejected
    bid_type TEXT DEFAULT 'manual', -- manual | auto
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bid_history_user_id ON public.bid_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_sku_id ON public.bid_history(sku_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_status ON public.bid_history(status);
CREATE INDEX IF NOT EXISTS idx_bid_history_seller_bidding_no ON public.bid_history(seller_bidding_no);

-- RLS 활성화
ALTER TABLE public.bid_history ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 접근 가능
CREATE POLICY "Users can view own bid history" ON public.bid_history
    FOR SELECT TO authenticated
    USING (
        EXISTS(SELECT 1 FROM public.users u WHERE u.id = user_id AND u.clerk_id = auth.jwt()->>'sub')
    );

CREATE POLICY "Users can insert own bid history" ON public.bid_history
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS(SELECT 1 FROM public.users u WHERE u.id = user_id AND u.clerk_id = auth.jwt()->>'sub')
    );

CREATE POLICY "Users can update own bid history" ON public.bid_history
    FOR UPDATE TO authenticated
    USING (
        EXISTS(SELECT 1 FROM public.users u WHERE u.id = user_id AND u.clerk_id = auth.jwt()->>'sub')
    );

CREATE POLICY "Users can delete own bid history" ON public.bid_history
    FOR DELETE TO authenticated
    USING (
        EXISTS(SELECT 1 FROM public.users u WHERE u.id = user_id AND u.clerk_id = auth.jwt()->>'sub')
    );
