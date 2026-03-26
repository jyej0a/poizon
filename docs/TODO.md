# 프로젝트 구현 TODO (기반: PRD v0.2)

## 0. 프로젝트 공통 및 인프라
- [x] Next.js 15 (App Router) + Tailwind v4 + shadcn/ui 기반 설정
- [x] Supabase 기본 연결 및 Clerk (AGENTS.md 기준) 초기 세팅
- [ ] `.cursor/rules/` 및 `AGENTS.md` 보완

## 1. 프론트엔드 UI 레이아웃 및 디자인 초안 구성 (Frontend First)
- [x] 전역 테마 및 스타일 파일 (`app/globals.css`) 설정 (Poizon 스타일의 프리미엄 디자인 요건 반영)
- [x] `app/(dashboard)/layout.tsx` (사이드바, 네비게이션, 사용자 프로필 UI 마크업)
- [x] `app/(dashboard)/page.tsx` (메인 대시보드 - 상품 검색 및 가격비교 모달 UI 초안)
- [x] `app/(dashboard)/settings/page.tsx` (관리자 설정 페이지 UI 초안)
- [x] 공용 UI 컴포넌트 (`Navbar`, `Sidebar`, `Card` 등) 구축 및 애니메이션 추가

## 2. 데이터베이스 스키마 설계 (Supabase)
- [x] `supabase/migrations/` (DB 테이블 생성)
  - [x] `system_settings` 테이블 (수수료, 기본 설정)
  - [x] `mall_whitelist` 테이블 (네이버 쇼핑 메이저 몰 목록)
  - [x] `user_configs` 테이블 (사용자별 Poizon API Key 등 보관)
- [x] RLS 정책 적용 및 Typescript 타입 제네레이션 수동 반영

## 3. Poizon API 기반 핵심 기능 연동 (Phase 1 & 1.5)
- [x] `lib/api/poizon.ts` (Poizon API Wrapper 생성 - `POIZON_API_PARAMS.md`의 서명 규칙 반영 완료)
- [x] 상품 목록 대량 검색 (품번 및 브랜드 단위 2-Step 검색) API 컴포넌트 연동 성공
- [ ] **[Phase 1.5]** `DW spuId` 기반 상품 통계(최근 30일 판매량/최저가) 및 SKU 상세 조회 API 병합 연동
- [ ] 대시보드 리스트 내 SKU 펼침 UI (Chevron 클릭 시 하위 색상/사이즈 표기 및 판매량순 자체 정렬 적용)
- [ ] 판매 리스팅/입찰 정보 상세 메타 조회 및 UI 연결
- [ ] 자동 입찰기능(Listing) API 연동 및 서버 렌더링 트리거 (`executeBidding.ts`)
- [ ] Poizon 통신 시스템 에러 안정성 테스트 (Sandbox 환경 등)

## 4. 네이버 쇼핑 및 마진 분석 연동 (Phase 2)
- [ ] `lib/api/naver-shopping.ts` (네이버 API 연동 및 DB 기반 화이트리스트 필터 구축)
- [ ] `lib/utils/calculate-margin.ts` (수수료/수익 산출 비즈니스 로직 작성)
- [ ] Poizon 상품 데이터와 네이버 최저가의 비교표 및 결과 상태 UI 시각화
- [ ] 수수료 계산 등 모듈별 단위-통합 테스트
