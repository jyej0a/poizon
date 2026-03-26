-- 1. system_settings 테이블 (전역 수수료 및 설정)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    min_fee INTEGER NOT NULL DEFAULT 15000,
    max_fee INTEGER NOT NULL DEFAULT 45000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화 및 권한 설정 (개발 중에는 모든 회원 허용)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read system_settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update system_settings" ON public.system_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert system_settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (true);

-- 기본 설정값 삽입 (한 개만 존재하도록 설계)
INSERT INTO public.system_settings (fee_percentage, min_fee, max_fee) VALUES (10.00, 15000, 45000);

-- 2. mall_whitelist 테이블 (네이버 쇼핑 필터링 화이트리스트)
CREATE TABLE IF NOT EXISTS public.mall_whitelist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mall_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage mall_whitelist" ON public.mall_whitelist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 기본 화이트리스트 목록
INSERT INTO public.mall_whitelist (name) VALUES 
    ('G마켓'), ('롯데홈쇼핑'), ('11번가'), ('옥션'), ('쿠팡')
ON CONFLICT (name) DO NOTHING;

-- 3. user_configs 테이블 (사용자별 Poizon API 설정)
CREATE TABLE IF NOT EXISTS public.user_configs (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    poizon_app_key TEXT,
    poizon_app_secret TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
-- Clerk JWT Sub 클레임(clerk_id)과 users 테이블을 통해 본인 데이터만 접근 가능
CREATE POLICY "Users can manage own configs" ON public.user_configs FOR ALL TO authenticated 
USING (
    exists(select 1 from public.users u where u.id = user_id and u.clerk_id = auth.jwt()->>'sub')
) WITH CHECK (
    exists(select 1 from public.users u where u.id = user_id and u.clerk_id = auth.jwt()->>'sub')
);
