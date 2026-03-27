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

## 3. Poizon API 기반 핵심 기능 연동 (Phase 1 & 1.5 & Final)
- [x] `lib/api/poizon.ts` (Poizon API Wrapper 생성 - `POIZON_API_PARAMS.md`의 서명 규칙 반영 완료)
- [x] 상품 목록 대량 검색 (품번 및 브랜드 단위 2-Step 검색) API 컴포넌트 연동 성공
- [x] **[Phase 1.5]** `DW spuId` 기반 상품 통계(최근 30일 판매량/최저가) 및 단건 조회 배열 누수 버그까지 완벽 수리
- [x] 대시보드 리스트 내 SKU 펼침 UI (Chevron 클릭 시 하위 옵션 렌더링 및 4대 통계 개별 바인딩 완료)
- [x] **[Phase 1 Final]** 전제 조건: SKU 테이블 행(Row) 내부에 '본인 입찰가'를 직접 적어넣을 수 있는 `Input` UI 컴포넌트 추가
- [x] **[Phase 1 Final]** 전제 조건: 입력된 가격과 기존 통계를 바탕으로 UI 내에서 '마진 예상 수익'을 미리 가계산해 주는 프론트엔드 연산 로직 연결
- [x] **[Phase 1 Final]** 단건 입찰: 개별 SKU 행 단위의 `[바로 입찰]` 버튼 클릭 시, 입력된 가격 페이로드가 담긴 Server Action(`executeBidding.ts`) 통신 발송
- [x] **[Phase 1 Final]** 일괄 입찰: 좌측 체크박스로 여러 SKU/품번 다중 선택 후, 상단 `[일괄 입찰]` 버튼 클릭 ➡ 다수 페이로드 동시/순차 API 처리 로직 구현
- [x] **[Phase 1 Final]** 실제 Poizon API를 향한 입찰(Bidding/Listing) 객체 생성 및 에러 샌드박스 안정성 테스트
- [x] **[해결 완료]** 입찰 API 에러 80000014 해결
  - 원인: `direct-autonomous-bidding` 대신 `normal-autonomous-bidding` 엔드포인트 사용 필요
  - 해결: `biddingType: 20` (검수 후 발송) 및 `sizeType: "EU"` 상수로 일원화 적용 완료 (2026-03-27)

## 4. 입찰가 자동 선정 로직 (Phase 1 추가)
- [x] 포이즌 제공 데이터 기반 입찰가 추천 로직 설계 (Listing Recommendations 연동)
  - [x] 중국 최저가(globalMinPrice) 파싱 및 UI 렌더링
  - [x] 중국 노출 가능 가격(exposurePrice) 파싱 및 UI 렌더링
  - [ ] 목표 마진율 입력 시 역산으로 권장 입찰가 도출
  - [x] SKU별 중국/한국 최근 30일 판매량 병기
- [x] 대시보드 UI에 '추천 입찰가' 컬럼 추가 및 클릭 시 자동 입력 기능
- [x] 검색 결과 페이징(Pagination) 관리 기능 도입 (브랜드 검색 시 50개 단위)
- [x] 테이블 헤더 스크롤 고정 시 투명도/겹침 현상 해결
- [x] 작업 영역 확장 및 초압축 대국 레이아웃 (가로 스크롤 제거) 적용
- [ ] 수수료 정산 후 실수령액(net) 실시간 가계산 고도화 (환율 및 단계적 수수료 반영)

## 5. 네이버 쇼핑 및 마진 분석 연동 (Phase 2)
- [x] `lib/api/naver-shopping.ts` (네이버 API 연동 및 DB 기반 화이트리스트 필터 구축)
- [x] `lib/utils/calculate-margin.ts` (수수료/수익 산출 비즈니스 로직 작성)
- [x] Poizon 상품 데이터와 네이버 최저가의 비교표 및 결과 상태 UI 시각화
- [x] 수수료 계산 등 모듈별 단위-통합 테스트

## 6. 레이아웃 및 UX 고도화 (Layout & UX Refinement)
- [ ] 전반적인 레이아웃 균형 및 여백(Spacing) 재조정
- [ ] 색상 체계 및 타이포그래피(Inter 13px 등) 재검토 및 세련미 강화
- [ ] 고밀도 대시보드의 가독성 개선을 위한 시각적 구분자(Divider) 및 배경색 최적화
- [ ] 사용자 인터랙션 강화를 위한 미세 애니메이션(Micro-animations) 추가
- [ ] 프리미엄 SaaS 느낌의 컴포넌트 스타일링 (Glassmorphism, 고품질 그림자 등)
- [ ] 상단 Navbar 및 사이드바 컴포넌트의 시각적 완성도 보완
