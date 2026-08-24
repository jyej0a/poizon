-- 외부 원가 수집 몰. 파서(key)는 코드 레지스트리가 원천이고,
-- 이 테이블은 활성 여부·순서·최근 점검 상태를 저장한다.

CREATE TABLE IF NOT EXISTS public.source_malls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    last_checked_at TIMESTAMPTZ,
    last_check_status TEXT CHECK (
        last_check_status IS NULL
        OR last_check_status IN ('ok', 'empty', 'failed')
    ),
    last_check_message TEXT,
    last_check_offer_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS source_malls_sort_order_idx
    ON public.source_malls (sort_order, label);

ALTER TABLE public.source_malls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read source_malls" ON public.source_malls;
CREATE POLICY "Allow authenticated users to read source_malls"
    ON public.source_malls FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update source_malls" ON public.source_malls;
CREATE POLICY "Allow authenticated users to update source_malls"
    ON public.source_malls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert source_malls" ON public.source_malls;
CREATE POLICY "Allow authenticated users to insert source_malls"
    ON public.source_malls FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "service role manages source_malls" ON public.source_malls;
CREATE POLICY "service role manages source_malls"
    ON public.source_malls FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.source_malls (key, label, is_active, sort_order, notes) VALUES
    ('lotteon', '롯데ON', true, 10, NULL),
    ('lottedpt', '롯데백화점몰', true, 20, '롯데ON mall_no=2로 수집'),
    ('lotteimall', '롯데아이몰', true, 30, NULL),
    ('musinsa', '무신사', true, 40, NULL),
    ('kolonmall', '코오롱몰', true, 50, 'persisted query hash 변경 시 파서 갱신 필요'),
    ('ssg', 'SSG', true, 60, NULL),
    ('gmarket', 'G마켓', true, 70, '서버 수집은 Akamai 차단(403)으로 빈 결과가 나올 수 있음')
ON CONFLICT (key) DO NOTHING;
