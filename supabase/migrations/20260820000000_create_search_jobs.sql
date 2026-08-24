-- 20260820000000_create_search_jobs.sql
-- 백그라운드 검색 잡. 브라우저를 닫아도 서버(워커)에서 검색이 계속 진행되고,
-- 결과는 search_job_items에 적재되어 나중에 한 번에 조회한다.
--
-- 기존에는 검색 결과가 React state에만 존재해 새로고침·페이지 이탈 시 전량 소실되었다.
-- (근거: docs/TODO.md 10.2 F1/F2)

CREATE TABLE IF NOT EXISTS public.search_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- 검색 조건
    type TEXT NOT NULL CHECK (type IN ('article', 'brand')),
    keyword TEXT NOT NULL,
    -- pageSize, excludeSkipped, excludeReviewed, brandPage, brandId 등
    options JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- 진행 상태
    -- queued: 대기 / running: 워커 처리 중 / done: 전량 성공
    -- partial: 일부 단계 실패(결과는 존재) / failed: 수집 실패 / cancelled: 사용자 취소
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'done', 'partial', 'failed', 'cancelled')),
    stage TEXT,                                  -- 현재 단계 라벨 (예: '통계 수집', '네이버 최저가')
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_done INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,       -- 최종 적재 건수
    excluded_count INTEGER NOT NULL DEFAULT 0,   -- 스킵/검토완료/영구제외로 걸러낸 건수

    -- 실패 및 재시도
    error TEXT,
    warnings JSONB NOT NULL DEFAULT '[]'::JSONB, -- 부분 실패 사유 누적 (partial 진단용)
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- 워커 잠금 (동시에 여러 워커가 같은 잡을 집지 않도록)
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,

    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 워커의 큐 폴링: status + created_at 순서 조회
CREATE INDEX IF NOT EXISTS idx_search_jobs_queue
    ON public.search_jobs(status, created_at);
-- 사용자별 잡 목록 (최신순)
CREATE INDEX IF NOT EXISTS idx_search_jobs_user
    ON public.search_jobs(user_id, created_at DESC);
-- 유실된 잠금(stale lock) 회수용
CREATE INDEX IF NOT EXISTS idx_search_jobs_locked
    ON public.search_jobs(locked_at)
    WHERE status = 'running';


CREATE TABLE IF NOT EXISTS public.search_job_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.search_jobs(id) ON DELETE CASCADE,

    spu_id TEXT NOT NULL,
    article_number TEXT,
    title TEXT,
    brand TEXT,

    -- 검색 결과 완성본(통계·SKU·네이버 최저가 포함). 화면은 이 값을 그대로 렌더한다.
    payload JSONB NOT NULL,

    -- 단계별 수집 결과 (부분 성공 추적)
    naver_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (naver_status IN ('pending', 'ok', 'empty', 'failed', 'skipped')),

    sort_order INTEGER NOT NULL DEFAULT 0,       -- 워커가 수집한 순서 유지
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

    UNIQUE(job_id, spu_id)                       -- 잡 내 동일 SPU 중복 적재 방지
);

CREATE INDEX IF NOT EXISTS idx_search_job_items_job
    ON public.search_job_items(job_id, sort_order);

-- RLS 활성화 (정책 없음). 서버에서 service_role 키로만 접근하므로
-- service_role은 우회하여 정상 동작하고 anon/authenticated 외부 접근은 차단된다.
-- (item_status와 동일한 패턴)
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_job_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.search_jobs TO anon;
GRANT ALL ON TABLE public.search_jobs TO authenticated;
GRANT ALL ON TABLE public.search_jobs TO service_role;

GRANT ALL ON TABLE public.search_job_items TO anon;
GRANT ALL ON TABLE public.search_job_items TO authenticated;
GRANT ALL ON TABLE public.search_job_items TO service_role;
