# 프로젝트 구현 TODO (기반: PRD v0.5)

## 0. 프로젝트 공통 및 인프라
- [x] Next.js 15 (App Router) + Tailwind v4 + shadcn/ui 기반 설정
- [x] Supabase 기본 연결 및 Clerk (Native Integration) 초기 세팅
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-18, 판매량 정합성·POIZON 문의 항목)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-19, SKU 입찰표시·검토완료·상태 DB)

## 1. 프론트엔드 UI 레이아웃 및 디자인 (Completed)
- [x] 전역 테마 및 스타일 파일 (`app/globals.css`) 설정
- [x] `app/(dashboard)/layout.tsx` (고급 사이드바 및 네비게이션)
- [x] 공간 절약형 호버 헤더 (Search Board UI 최적화)
- [x] 테이블 열 너비 조절 및 Local Storage 저장 기능
- [x] 입찰 완료 이력 표시기(Gavel Icon) 및 상세 툴팁 UI — 시스템(파랑) / 수동(빨강) 구분 (`bid-status-indicator.tsx`)
- [x] SKU 행 관리 셀 공통화 (`sku-row-manage-cell.tsx`) — 선택·입찰·검토·메모·스킵
- [x] 검토완료 체크 버튼 공통화 (`review-check-button.tsx`) — none / partial(주황) / all(녹색)

## 2. 데이터베이스 및 서버 액션 (Supabase)
- [x] `system_settings`, `user_configs` 테이블 및 RLS 정책
- [x] `skipped_items` 테이블 구축 및 Clerk-Supabase 동기화 훅 (`use-sync-user.ts`) 연동
- [x] `getSkippedItems`, `addSkippedItems`, `removeSkippedItems` 서버 액션 구현
- [x] **`item_status`** — 품번(SPU) 검토완료·메모 (`app/actions/item-status.ts`)
- [x] **`sku_status`** — 옵션(SKU) 메모·수동 입찰 표기·검토완료 (`app/actions/sku-status.ts`)
- [x] **`bid_history`** — 시스템 입찰 이력 SKU 단위 조회 (`getBidHistoryBySkuIds`)
- [x] Supabase 마이그레이션 파일 추가 (`20260616`~`20260621`, `bid_history`) — **원격 DB 수동 반영 필요**

## 3. Poizon API 연동 및 안정화 (Core)
- [x] `lib/api/poizon.ts` (서명 생성 및 안정적 요청 Wrapper)
- [x] **[Bug Fix]** Poizon API Error 500080002 해결
  - 원인: `spuIds`를 잘못된 명칭으로 사용 및 `pageSize` 과부하
  - 해결: `spuIdList`로 명칭 정정 및 `pageSize` 기본값 50으로 최적화 (2026-06-15)
- [x] 상품 목록 대량 검색 (품번 및 브랜드 단위 2-Step 검색)
- [x] SKU 펼침 UI 및 하위 옵션별 통계(판매량/가격) 바인딩
- [x] 단건 및 일괄 입찰(Batch Bid) 연동 (Server Action)
- [x] **중복 입찰 확인 팝업** — 실데이터 기존 입찰 조회(`getExistingBidsForSkus`) + `91800500` 시 그대로 시도 / 가격 변경 재입찰 / 취소
- [x] **입찰 피드백 메시지** — 신규 입찰만 성공한 경우 분기 누락 수정 (`formatBidFeedback`)
- [x] **SKU 단위 입찰 표시** — hierarchy·flattened·SPU 요약(`SpuBidSummary`) 전반 적용
- [x] **수동 입찰 표기** — `sku_status.manual_bid_marked`, 빨간 Gavel / 점선 `+` 토글
- [x] **검토완료 SKU·SPU 연동** — 옵션 개별 / 품번 일괄 / 부분완료 주황 `검토 n/m` / 전체완료 녹색
- [x] **검토완료 UX** — 낙관적 UI(로딩 스피너 제거), 실패 시 롤백
- [x] **새로고침 후 상태 복원** — `getSkuStatusesBySpuIds` + 검색 결과 로드 시 `item_status`·`sku_status` 일괄 조회
- [x] **`use server` export 오류 수정** — `SkuStatus`·`EMPTY_SKU_STATUS` → `types/sku-status.ts` 분리

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

## 8. 데이터 정합성 / 가격 소스 검증 (2026-06-18)

### 8.1 판매량 데이터 정합성 (2026-06-18 갱신)

#### 완료 (코드 반영됨)

- [x] **[Fix]** `getSpuStatistics`: `globalSpuId` 확보 후 `by-global-spu` 우선 → `by-spu` 폴백
- [x] **[Fix]** `region=KR` + `region=CN` 이중 조회 복구, CN 통계 우선·KR 폴백 (`getSkuSalesValue`)
- [x] **[Fix]** `resolveSkuDetails` skuId union 머지 → 18개 옵션 전부 행 표시
- [x] **[Fix]** 판매량 표기: `0` / `—` / `<5` / `100+` (`lib/utils/sales-volume.ts`)
- [x] **[Fix]** SPU 30일 판매량 = SKU 합산
- [x] **[Cleanup]** 탐색용 임시 API 라우트 제거 (`diag-sku`, `test*`, `debug-data` 등)

#### 이전 조치 (유지)

- [x] 품번 검색 결과 dedupe + "목록 비우기"
- [x] Poizon API 500080002 (`spuIds` 명칭·pageSize) 해결

#### 알려진 한계 (오픈 API)

- 블랙 KR100 등 일부 SKU: 오픈 API `globalSoldNum30` ≠ 판매자센터 30일 값 (예: 25 vs 2,100+)
- `localSoldNum30`이 오픈 API에서 전 SKU 0 → 현지 열 센터 parity 불가
- `region=CN` 차단 (`20899003`)

### 8.2 "중국 노출가" 가격 소스 검증 및 변경 (To-Do / 보류)
- 현황(확인 완료):
  - 옵션(SKU) 행의 "중국 노출가"는 `recommend-bid/price` API 응답의 `leakInfos[buyerRegion==="CN"].leakPrice`를 사용 → 즉 **"중국 구매자 페이지 노출 보장 가격"**(예시 블랙 100: 70,000원)
  - "내 입찰가" 자동 입력값도 동일한 `leakPrice` 사용 (`search-board.tsx` 자동 입력 effect)
  - **"중국 시장 현재 최저 입찰가"**(예시 71,000원)는 별도 값이며 현재 화면에 표시하지 않음
  - 품번(SPU, 접힌 행)의 "중국 노출가"는 추천 API가 아니라 통계 API의 `minPrice/marketPrice`(`item.minPrice`)를 사용 → SKU 행과 값이 다를 수 있음
  - 참고: 판매자센터 "상품검색" 화면의 "중국 구매자 페이지 노출" 컬럼은 사실상 "현재 최저 입찰가"(71,000)를 보여주는 라벨 불일치가 있음
- [ ] 추천 API(`recommend-bid/price`) 원시 응답 전체를 덤프하여 입찰화면 3개 박스(노출 보장 / 현재 최저 입찰가 / 판매 기회 확대)와 각 필드(`leakInfos.leakPrice`, `globalMinPrice` 등) 1:1 매핑 확정
- [ ] 매핑 확정 후, "중국 노출가" 컬럼에 어떤 값을 표기할지 결정(노출 보장 vs 현재 최저 입찰가) 및 SPU/SKU 행 소스 일관화
- [ ] (선택) 두 값을 동시 표기하거나 툴팁으로 구분 노출하는 UI 검토

### 8.3 POIZON 오픈플랫폼 문의 (추후 / 필요 시)

> 판매자센터와 오픈 API 판매량 불일치 해소를 위해 POIZON 측 확인이 필요할 때 진행.

- [ ] **문의 초안 작성**: 아래 내용을 `poizon.open.platform@poizon.com` 또는 오픈플랫폼 콘솔 문의로 전달
  - **증상**: 판매자센터 30일 판매량 ≠ 오픈 API `commoditySales.globalSoldNum30` / `localSoldNum30`
  - **재현 품번**: `TLTCM26521` (SPU `40700983`, globalSpuId `14013480901`)
  - **재현 SKU**: 블랙 KR100 `1079098338` — 센터 `2,100+`, 오픈 API `25` (`by-spu`·`by-global-spu`·`by-sku` 동일)
  - **판매자센터 API**: `seller.poizon.com/.../admin/global/sku/sku-info/by-global-spu`
  - **오픈 API 시도**: `intl/sku/sku-basic-info/by-global-spu`, `by-spu`, `region=CN`(실패 `20899003`)
  - **질문**: 센터와 동일한 30일 판매량(중국·현지)을 오픈 API로 받으려면 어떤 엔드포인트·권한 패키지·파라미터가 필요한가?
- [ ] **권한 패키지 확인**: 오픈플랫폼 콘솔 → 앱 상세 → API Permission Package에 Item/통계 관련 패키지 누락 여부 점검
- [ ] **문의 후 재검증**: 응답에 따라 `getSpuStatistics` 엔드포인트/파라미터 조정 및 `TLTCM26521` 18옵션 전수 대조
- [ ] **(대안)** POIZON이 별도 필드/엔드포인트를 안내하지 못할 경우, 현 오픈 API 값 + 표기 규칙 유지 여부 사용자와 재협의

## 9. 입찰·검토 상태 관리 (2026-06-19)

### 9.1 완료 (2026-06-18~19)

- [x] `item_status` / `sku_status` / `bid_history` 테이블 및 Server Actions
- [x] SKU 입찰 표시 — 시스템(파랑) / 수동(빨강) Gavel, SPU 요약 툴팁
- [x] 중복 입찰 확인 Dialog (`executeBidding` mode: `normal` / `forceRetry` / `updatePrice`)
- [x] 검토완료 — SKU 개별, SPU 일괄, 부분완료 주황 표시
- [x] 검색 결과 로드 시 SPU 기준 상태 복원 (`fetchAllItemAndSkuStatuses`)
- [x] 스킵(EyeOff) vs 입찰(Gavel) vs 검토(Check) 아이콘 역할 분리

### 9.2 완료 (2026-06-19) — 입찰·검토 UX 개선

- [x] **입찰 행 시각 분리** — `getSkuRowVisualState`: 입찰=선명+배경 음영, 검토·스킵=흐림 (hierarchy·flattened 공통)
- [x] **SPU 입찰 요약 위치** — 관리 열 Gavel 제거, 상품명 영역 `SpuBidSummary variant="inline"`
- [x] **수동 입찰 표기 해제 UX** — Gavel/배지 클릭 해제, 호버 X, 툴팁·토스트
- [x] **입찰 성공 ↔ SKU 검토 정합성** — SPU `handled` 일괄 설정 제거, 입찰 SKU만 `sku_status.handled`
- [x] **미처리 필터** — 검토완료(SPU 또는 전 SKU)만 숨김, 입찰만 있는 품번 유지
- [x] **활동 히스토리** — `lib/utils/sku-activity.ts`, `최종 · 날짜 · 활동` 1줄 UI
- [x] **상태 복원 피드백** — `fetchAllItemAndSkuStatuses` 실패 시 `showFeedback`
- [x] **`search-board.tsx` TypeScript** — `SkuStatus` import, `buildStatsMaps`/`sales-volume` 타입
- [x] **알짜배기(Flattened) 모드** — 입찰·검토·행 강조 hierarchy와 동일 규칙 적용

### 9.3 수동 검증 (로컬)

- [ ] 검색 → 옵션 표기 → 새로고침 → 동일 검색 후 상태 유지 확인
- [ ] 원격 DB `sku_status.handled`, `manual_bid_*` 컬럼 upsert 동작 확인
