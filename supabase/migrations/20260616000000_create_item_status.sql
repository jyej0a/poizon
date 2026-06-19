-- 20260616000000_create_item_status.sql
-- 품번(SPU) 단위 '처리 완료(handled)' 상태 및 메모(memo)를 영구 저장하기 위한 테이블.
-- 브랜드 대량 디깅 시 이미 처리/검토한 상품을 식별하고 새 검색에서 자동 숨김 처리하는 데 사용한다.

CREATE TABLE IF NOT EXISTS public.item_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    spu_id TEXT NOT NULL,                 -- 품번(SPU) ID
    article_number TEXT,                  -- 품번 코드 (참고/표시용)
    title TEXT,                           -- 상품명 (참고용)
    handled BOOLEAN NOT NULL DEFAULT false, -- 처리 완료 여부 (입찰/제외/수동 토글)
    memo TEXT,                            -- 사용자 메모
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, spu_id)              -- 동일 유저-품번 중복 방지 (upsert 대상)
);

-- 조회 최적화
CREATE INDEX IF NOT EXISTS idx_item_status_user_id ON public.item_status(user_id);
CREATE INDEX IF NOT EXISTS idx_item_status_handled ON public.item_status(user_id, handled);

-- RLS 활성화 (정책 없음). 이 테이블은 서버에서 service_role 키로만 접근하므로
-- RLS를 켜면 service_role은 우회하여 정상 동작하고, anon/authenticated 외부 접근은 차단된다.
ALTER TABLE public.item_status ENABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.item_status TO anon;
GRANT ALL ON TABLE public.item_status TO authenticated;
GRANT ALL ON TABLE public.item_status TO service_role;
