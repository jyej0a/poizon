-- user_configs 테이블에 poizon_access_token 컬럼 추가
-- access_token은 Poizon OAuth 인증 후 발급받는 셀러 전용 토큰으로
-- 입찰(Listing), 주문 등 셀러 계정 행위에 필수입니다.

ALTER TABLE public.user_configs 
ADD COLUMN IF NOT EXISTS poizon_access_token TEXT;
