-- 20260826120000_create_push_subscriptions.sql
-- 검색 잡 완료 Web Push 구독. 탭을 닫아 두어도 워커가 종료 시 알림을 보낸다.
-- (docs/PRD.md §5.6, docs/TODO.md §10.2)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON public.push_subscriptions(user_id);

-- RLS 활성화 (정책 없음). 서버에서 service_role 키로만 접근.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
