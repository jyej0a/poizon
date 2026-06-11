-- 20260417_create_excluded_articles.sql
-- 품번 제외(블랙리스트) 기능을 위한 테이블 생성

CREATE TABLE IF NOT EXISTS public.excluded_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    article_number TEXT NOT NULL,         -- 제외할 품번
    title TEXT,                           -- 상품명 (참고용)
    reason TEXT,                          -- 제외 사유 메모
    excluded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, article_number)       -- 동일 유저가 같은 품번 중복 추가 방지
);

-- RLS 비활성화 (개발 편의를 위해, 실제 프로덕션에서는 활성화 후 정책 추가 필요)
ALTER TABLE public.excluded_articles DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.excluded_articles TO anon;
GRANT ALL ON TABLE public.excluded_articles TO authenticated;
GRANT ALL ON TABLE public.excluded_articles TO service_role;
