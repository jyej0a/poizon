# 프로젝트 구현 TODO (기반: PRD v0.3)

## 0. 프로젝트 공통 및 인프라
- [x] Next.js 15 (App Router) + Tailwind v4 + shadcn/ui 기반 설정
- [x] Supabase 기본 연결 및 Clerk (Native Integration) 초기 세팅
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-15)

## 1. 프론트엔드 UI 레이아웃 및 디자인 (Completed)
- [x] 전역 테마 및 스타일 파일 (`app/globals.css`) 설정
- [x] `app/(dashboard)/layout.tsx` (고급 사이드바 및 네비게이션)
- [x] 공간 절약형 호버 헤더 (Search Board UI 최적화)
- [x] 테이블 열 너비 조절 및 Local Storage 저장 기능
- [x] **[New]** 입찰 완료 이력 표시기(Clock Icon) 및 상세 툴팁 UI 구현

## 2. 데이터베이스 및 서버 액션 (Supabase)
- [x] `system_settings`, `user_configs` 테이블 및 RLS 정책
- [x] **[New]** `skipped_items` 테이블 구축 및 Clerk-Supabase 동기화 훅 (`use-sync-user.ts`) 연동
- [x] `getSkippedItems`, `addSkippedItems`, `removeSkippedItems` 서버 액션 구현

## 3. Poizon API 연동 및 안정화 (Core)
- [x] `lib/api/poizon.ts` (서명 생성 및 안정적 요청 Wrapper)
- [x] **[Bug Fix]** Poizon API Error 500080002 해결
  - 원인: `spuIds`를 잘못된 명칭으로 사용 및 `pageSize` 과부하
  - 해결: `spuIdList`로 명칭 정정 및 `pageSize` 기본값 50으로 최적화 (2026-06-15)
- [x] 상품 목록 대량 검색 (품번 및 브랜드 단위 2-Step 검색)
- [x] SKU 펼침 UI 및 하위 옵션별 통계(판매량/가격) 바인딩
- [x] 단건 및 일괄 입찰(Batch Bid) 연동 (Server Action)

## 4. 건너뛰기 및 지능형 필터링 (New)
- [x] SKU/SPU 건너뛰기(Skip) 토글 기능 구현
- [x] 낙관적 업데이트(Optimistic Update) 적용으로 쾌적한 UX 제공
- [x] 수익 상품(Flattened View) 모드에서 건너뛰기 필터링 연동
- [x] 품번 영구 제외(Exclude) 기능 및 전용 모달 UI

## 5. 네이버 쇼핑 및 마진 분석 (Phase 2)
- [x] 네이버 쇼핑 검색 API 연동 및 서버 액션 구축
- [x] 실시간 마진(순수익) 계산 로직 완성 (수수료 정책 반영)
- [x] 추천 입찰가(중국 노출가) 자동 입력 기능 및 수익률 가계산 UI

## 6. 레이아웃 및 고도화 (Remaining)
- [ ] **[In Progress]** 고밀도 대시보드 가독성 개선을 위한 배경색 및 구분자 세밀 조정
- [ ] 사용자 인터랙션 강화를 위한 추가 미세 애니메이션 적용
- [ ] 프리미엄 SaaS 느낌의 컴포넌트 스타일링 (Glassmorphism 강화)
- [ ] 목표 마진율 입력 시 역산으로 권장 입찰가 도출 로직 추가
- [ ] 수수료 정산 후 실수령액(net) 실시간 가계산 고도화 (환율 반영)

## 7. 향후 추가 과제 (Roadmap)
- [ ] 자동 재입찰(Auto-rebidding) 엔진 프로토타입 설계
- [ ] 수익 현황 통계 대시보드 및 리포트 화면
- [ ] 입찰 알림(Notification) 시스템 연동
