# 프로젝트 구현 TODO (기반: PRD v1.0)

## 0. 프로젝트 공통 및 인프라
- [x] Next.js 15 (App Router) + Tailwind v4 + shadcn/ui 기반 설정
- [x] Supabase 기본 연결 및 Clerk (Native Integration) 초기 세팅
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-18, 판매량 정합성·POIZON 문의 항목)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-19, SKU 입찰표시·검토완료·상태 DB)
- [x] `.cursor/rules/docs-sync.mdc` — 스펙 변경 시 PRD/TODO 선행 갱신 규칙 (2026-08-24)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 4단계 UI 재구성 착수)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, §5.7 수집 몰 상태·추가 절차)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 몰 커버리지 +나이키KR·이랜드몰)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 파서 회귀 감시 자동화)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 검색 워커 cron Route Handler)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 5단계 F12 `search-board` 분해 착수)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, F12 검색·추천가·원가 오퍼 훅)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, F15 접근성)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 색 의존 해소)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, §8.2 추천가 응답 매핑)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 노출가 표기 현행 유지·후속은 이월)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 10.1 위생·순수익 헤더 정렬 현행)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 효자 상품 강조)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 컬럼 9→7 병합)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 노출가 호버 툴팁)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 가격 알림 인앱 워치)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 목표 마진율 역산 권장 입찰가)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 몰 커버리지 +ABC마트)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 몰 커버리지 29CM·W컨셉 등 의류 몰 재프로브)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 몰 커버리지 +29CM·W컨셉)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 고밀도 보드 행 가독성)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 보드 미세 애니메이션)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 글래스 크롬)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 환율 철회 — POIZON은 KRW)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 검색 워커 미기동 안내)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 백그라운드 연속 수집 최대 500)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 사이드바 IA — 검색/판매/시스템, 주문 관리)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 주문 관리 API — generic_list·delivery)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 입찰 관리 API — general-type-bidding-list·update-bid)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 입찰 관리 최저가 필터·품번/이미지 보강)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-25, 총건수 안내·주문 분할/QC·자동 재입찰·수익 현황)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, 검색 잡 완료 Web Push)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, 가격 워치 Web Push)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, sku_status 부분 upsert 보존)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, 몰 커버리지 +11번가)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, 몰 커버리지 +GS샵·Hmall·더현대·CJ온스타일)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-26, 몰 커버리지 +LF몰·하이버)

## 1. 프론트엔드 UI 레이아웃 및 디자인 (Completed)
- [x] 전역 테마 및 스타일 파일 (`app/globals.css`) 설정
- [x] `app/(dashboard)/layout.tsx` (고급 사이드바 및 네비게이션)
- [x] 공간 절약형 호버 헤더 (Search Board UI 최적화)
- [x] 테이블 열 너비 조절 및 Local Storage 저장 기능
- [x] 입찰 완료 이력 표시기(Gavel Icon) 및 상세 툴팁 UI — 시스템(파랑) / 수동(빨강) 구분 (`bid-status-indicator.tsx`)
- [x] SKU 행 관리 셀 공통화 (`sku-row-manage-cell.tsx`) — 선택·입찰·검토·메모·스킵
- [x] 검토완료 체크 버튼 공통화 (`review-check-button.tsx`) — none / partial(주황) / all(녹색)
- [x] 사이드바 그룹화 (2026-08-25) — 검색 / 판매 / 시스템. 라벨 한국어
- [x] Item Search `comingSoon` 제거 — 검색은 `/dashboard`가 담당
- [x] **주문 관리** (PRD §5.9) — 목록·발송 대기 송장 등록
  - [x] 오픈플랫폼 주문 API 확인 — `order/generic_list`(목록, 생성일 최대 7일), `order/delivery`(발송)
  - [x] 주문 목록·상태 보드 (발송 대기·검수·배송·완료·취소·반품)
  - [x] 발송 대기건 운송사+송장 등록. 입찰 관리와 화면을 섞지 않음
  - [x] 7일 넘는 기간은 윈도 분할 조회 후 합침 (상한 90일)
  - [x] QC는 목록 identify 필드 + `Query Order QC Result`(살아 있으면). 운송사는 문서 ID + 직접 입력, 목록 API는 프로브
- [x] **입찰 관리** (PRD §5.8) — 공식 목록·가격 수정·취소·CSV
  - [x] 오픈플랫폼 목록 API 확인 — `retrieve-bid/general-type-bidding-list` (`tradeStatus`, 커서 `exclusiveStartOffsetId`)
  - [x] 구 `listing/list` 제거. 상태 탭(활성/거래중/매진/취소) + 중국·한국 미노출(현재 페이지)
  - [x] 가격 수정 `update-bid/normal-autonomous-bidding`. 선택 행 일괄 조정·CSV 내보내기
  - [x] 현재 페이지 보강 — 품번·이미지(`by-spu`) + 중국/한국 최저가 미달 필터(`recommend-bid/price`). `by-sku-ids`·price-batch는 404
  - [x] 총건수 없음 — 「이 페이지 N건 · 다음으로 이어 조회」만
- [x] **자동 재입찰** (PRD §5.10) — 입찰 관리에서 follow-bidding 등록·조회
- [x] **수익 현황** (PRD §5.11) — `/dashboard/revenue` 기간 집계. 주문 관리와 화면 분리

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
- [x] 고밀도 대시보드 가독성 — 행 상태 색이 전 열에 관통 (2026-08-25)
  - 원인: POIZON·원가·순수익·판매 셀의 열 틴트가 `tr` 상태 배경을 덮어 입찰/스킵/재고가 앞 2열에만 보임
  - 셀 배경 틴트 제거. 헤더는 불투명 `bg-muted` + 열 상단 액센트. 호버는 셀 inset overlay
  - 검토완료 행 왼쪽 에메랄드 테두리+흐림 (스킵 슬레이트와 구분)
  - 펼친 옵션은 점선·들여쓰기 레일만 (자식 행 배경으로 상태 색을 가리지 않음)
- [x] 미세 애니메이션 (2026-08-25)
  - 품번 펼침: ChevronRight 90° 회전 (`motion-safe:duration-200`)
  - 관리 열 22px·검토·알림·입찰 BID·뷰 탭·검색 타입·효자/알림 칩: 누름 스케일
  - 자식 행 fade-in은 쓰지 않음 (검토/스킵 `opacity-40`과 충돌, 대량 행에서 버벅임)
  - `prefers-reduced-motion`은 Tailwind `motion-safe:`로 비활성. 스피너는 유지
- [x] 글래스 크롬 (2026-08-25)
  - `glass-panel`: 반투명 카드 + blur + 이너 하이라이트. 대시보드 메쉬 배경 위에서만 티가 남
  - 적용: 사이드바·워크스페이스 카드·툴바·최근검색/더보기/케밥·메모 팝오버·토스트·내비바
  - 테이블 스크롤 영역은 `bg-card` 불투명 유지 (행 상태 색·고정 헤더)
  - `prefers-reduced-transparency`면 솔리드 폴백
- [x] 목표 마진율 입력 시 역산으로 권장 입찰가 도출 로직 추가 (2026-08-24)
  - `system_settings.target_margin_rate`(원가 대비 순수익 %). 기본 20
  - `recommendBidFromCost`: 수수료율·min/max 캡 반영. 입찰 열 `권장 ₩` 클릭 시 입력 채움
- [x] 실수령액 표기 (입찰가 − 수수료, 전부 KRW, 2026-08-25)
  - 입찰 열 `실수령 ₩`. 순수익 = 실수령 − 원가
- [x] **환율 반영은 해당 없음·철회** (2026-08-25)
  - 구 TODO 「환율 반영」은 POIZON이 원화 정산인 줄 모르고 구현했음
  - API `currency=KRW`, 수수료·원가 오퍼도 원. CNY 환산 설정·시세 불러오기 제거
  - `fx_*` 컬럼 drop (`20260825170000_drop_fx_settlement_rates.sql`)

## 7. 향후 추가 과제 (Roadmap)
- [x] **주문 관리** — 목록·발송·7일 분할·QC 조회. 운송사 목록 API는 문서 ID+직접 입력 폴백
- [x] **입찰 관리** — 목록·가격 수정·취소·CSV·최저가 필터·품번/이미지·커서 안내
- [x] 자동 재입찰 — `follow-bidding/submit`·`auto-follow-bidding/list` (플랫폼이 가격 조정)
- [x] 수익 현황 — `/dashboard/revenue` 집계. 원가 차감 순수익은 범위 밖
- [x] 입찰 알림(Notification) 시스템 연동 (2026-08-26) — 인앱 워치 + 가격 도달 Web Push. 검색 잡 완료 푸시는 §10.2
  - 워커가 구독이 있는 계정의 `watch_price` SKU를 약 5분마다 `recommend-bid/price`로 조회
  - 도달 시 푸시 1회(`watch_notified_at`). 노출가가 목표를 다시 넘으면 재무장
  - 같은 `push_subscriptions` 구독. 워커/크론이 없으면 푸시도 멈춤

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

### 8.2 "중국 노출가" 가격 소스 — **표기 현행 유지 (2026-08-24)**

> SKU 「중국 노출가」·입찰 자동입력은 기존처럼 `leakInfos[CN].leakPrice`(노출 보장)를 쓴다. 화면 숫자는 바꾸지 않음.
> 최저 입찰가·기회 확대·접힌 품번 출처는 호버 툴팁. 이상하면 그때 다시 본다.

- 현황:
  - 옵션(SKU) 행·입찰 자동입력 = `recommend-bid/price`의 `leakInfos[buyerRegion="CN"].leakPrice` (**노출 보장**)
  - 품번(SPU, 접힌 행)은 통계 API `minPrice/marketPrice`라 SKU와 숫자가 다를 수 있음 (호버로 출처 안내, 표기는 유지)
  - 실데이터 상품검색 목록의 「중국 구매자 페이지 노출」 라벨은 사실상 최저 입찰가에 가깝다 (혼동 주의, 내 사이트 표기는 바꾸지 않음)
- [x] 추천 API 원시 응답 덤프 — `scripts/dump-recommend-price.ts` (`pnpm dump:recommend`)
      ① 노출 보장 = `leakInfos[CN].leakPrice` / ② 최저 입찰 = `globalMinPrice`(=`asiaMinPrice`) /
      ③ 기회 확대 = `effectiveExposurePrice` / 분포 = `priceRangeItems`

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

- [x] 검색 → 옵션 표기 → 새로고침 → 동일 검색 후 상태 유지 확인
- [x] 원격 DB `sku_status.handled`, `manual_bid_*` 컬럼 upsert 동작 확인
  - 단건 객체 upsert는 빠진 컬럼을 null/기본값으로 덮어 수동 표기↔검토완료가 서로 지워졌음
  - 배열 upsert(`columns` + `defaultToNull: false`)로 보낸 컬럼만 갱신. `item_status`·입찰 성공 시 `sku_status.handled`도 동일

---

## 10. 사용성·구조 개선 로드맵 (2026-08-13)

> 코드베이스 실측 리뷰로 도출한 개선사항 16건. 근거: 소스 61개 파일 정적 분석 +
> `.cursor/debug-c4e436.log`(단일 세션 POIZON 호출 1,409건).

### 10.0 측정된 문제 (근거)

| 항목 | 실측값 |
|---|---|
| `sku-basic-info/by-spu` 최장 성공 응답 | **41,291ms** (25s 중단선 초과했으나 성공 처리됨) |
| `listing/list` 최장 성공 응답 | 15,130ms |
| 추천가 조회 타임아웃 | **36건** / 단일 세션 |
| `Failed to fetch` · fetch 중단 | 6건 · 4건 |
| 브랜드 50건 검색 POIZON HTTP | 약 21~31회, 블로킹 20~60초 |
| `search-board.tsx` | **3,501줄**, `useState` 53개, 기타 훅 43개 |
| 툴바 인터랙티브 컨트롤 | 20개 (단일 행) |
| 테이블 컬럼 | 9개 (가격·숫자 6개) |
| 캐시 계층 / 재시도·백오프 | **0 / 0** |

### 10.1 [1단계] 기반 정리 — 완료 (2026-08-13)

- [x] **F4** 디버그 계측 코드 제거 — `#region agent log` + `127.0.0.1:7677` POST 19블록을
      `lib/api/poizon.ts`, `app/actions/recommendations.ts`, `components/dashboard/search-board.tsx`,
      `app/api/sync-user/route.ts`, `hooks/use-sync-user.ts` 5개 파일에서 삭제
  - `lib/api/poizon.ts`: 로깅 전용으로 감싸져 있던 `try/catch`(재throw만 수행) 해체 → 단순 `await fetch`로 복원
  - `app/api/sync-user/route.ts`: `await fetch(localhost)` 4건이 동기화 응답을 **블로킹**하고 있었음.
    로그 공급 목적뿐이던 Supabase URL 파싱 블록도 함께 제거
- [x] **F7** POIZON 자격증명 조회 지점 통합 — `lib/api/poizon-context.ts` 신설
  - `app/actions/poizon.ts`의 `getPoizonClient()`와 `app/actions/bidding.ts`의 `getBiddingContext()`가
    **동일한 `users` + `user_configs` 조회를 중복 구현**하고 있던 것을 하나로 통합
  - ⚠️ **검증 결과: 서버 액션에서는 `React.cache`로 DB 왕복을 줄일 수 없음.**
    React 공식 문서상 `cache`는 Server Component 전용이며, 요청 컨텍스트가 없으면
    메모이제이션 없이 그대로 통과한다(에러는 발생하지 않음). 즉 이 항목은
    **중복 코드 제거에는 성공했으나 호출 횟수 감소 효과는 없다.**
  - → 실제 해소는 2단계에서 **워커가 잡 시작 시 자격증명을 1회 로드**해 클라이언트를
    파이프라인 전체에 전달하는 구조로 처리 (10.2에 반영)
- [x] **F16** 문서·저장소 위생
  - `docs/DIR.md` 삭제 (초기 스캐폴드 구조에 정체, `AGENTS.md`의 Directory Convention과 중복)
  - 루트 `TODO.md` 삭제 → 잔여 과업은 아래 10.6으로 이관
  - `test-poizon-brand.ts`·`test-spu-region.ts` → `scratch/`로 이동, `tsconfig.json`에서 `scratch` 제외
  - `.cursor/debug-*.log` gitignore 추가 + 추적 해제 (852KB 로그가 커밋되어 있었음)

#### 1단계에서 추가로 발견·수정한 것 — **빌드가 깨져 있었음**

- [x] `date-fns` 미설치 상태로 `app/dashboard/excluded/page.tsx`가 import (커밋된 상태) → `pnpm build` 실패
  - 의존성 추가 대신 `lib/utils/format-date.ts`의 `formatDateTime()`으로 대체
    (프로젝트가 이미 `formatBidDate`·`formatSalesVolume` 등 네이티브 포매팅을 쓰고 있어 컨벤션 일치)
- [x] ESLint 에러 2건이 빌드 차단 중
  - `app/actions/listing.ts` — 빈 인터페이스(`interface ListingItem extends ParsedListingItem {}`) → `type` 별칭
  - `app/actions/settings.ts` — `userError`가 재할당되지 않는데 `let` 구조분해. `user`만 `let`으로 분리
- [x] `app/storage-test/page.tsx` — 로컬 `FileObject`가 `bucket_id`를 필수로 선언해 storage-js 타입과 충돌 → optional 정렬

**결과**: `npx tsc --noEmit` 무오류, `pnpm build` 성공(9개 라우트). 이전에는 두 단계 모두 실패.

> ESLint **경고**는 미해결 상태로 남음 (미사용 import 다수, `<img>` → `next/image`,
> `alt` 누락 3건, `react-hooks/exhaustive-deps` 3건). 5단계 컴포넌트 분해와 함께 처리.

> **린트 (2026-08-24)**: `pnpm remove` 시 기존 글로벌 store를 지정해 의존성을 맞춘 뒤
> `next build`에서 ESLint가 다시 실행된다. 경고는 빌드 통과, `@next/next/no-assign-module-variable`
> (G마켓 파서 `module` 식별자)만 에러라 `contentModule`로 변경. 미사용 import·`<img>` 경고는 잔여.

#### 1단계 중 확인된 잔여 이슈 — 위생 완료 (2026-08-24)

- [x] **죽은 코드** — `lib/supabase.ts`, `lib/supabase/client.ts` 삭제 (참조 0건).
      `useClerkSupabaseClient`는 클라이언트 Realtime용으로 `lib/supabase/clerk-client.ts`에 유지
- [x] **스캐폴드 페이지** — `/auth-test`, `/storage-test` 삭제. 유일한 `react-icons` 사용처라 의존성도 제거
- [x] **Realtime 경고** — 스캐폴드 SSR이 원인이었음. 재발 방지: 잡 구독은 `useEffect` 내부(클라이언트 전용)에서 채널 생성

### 10.2 [2단계] 백그라운드 검색 잡 — 구현 완료 (2026-08-20)

> 목표: 화면을 닫아둔 채 조회를 걸고, 완료 후 돌아와 결과를 한 번에 확인.
> 기존에는 결과가 React state에만 있어 새로고침·페이지 이탈 시 전량 소실됨.

- [x] **F1** 결과 영속화 — `supabase/migrations/20260820000000_create_search_jobs.sql`
  - `search_jobs`: 검색 조건(`type`, `keyword`, `options`) + 상태(`status`, `stage`,
    `progress_total`, `progress_done`, `item_count`, `excluded_count`) +
    실패 진단(`error`, `warnings`, `retry_count`) + 워커 잠금(`locked_at`, `locked_by`)
  - `search_job_items`: `payload jsonb`에 화면용 완성본(통계·SKU·네이버 최저가)을 담아
    조회 시 추가 API 호출이 없다. `UNIQUE(job_id, spu_id)`로 중복 적재 방지
  - RLS 활성화 + 정책 없음 (`item_status`와 동일 패턴, service_role 전용)
- [x] **F2** 잡 등록 액션 — `app/actions/search-jobs.ts`의 `enqueueSearchJob()`은
      행 1개만 INSERT하고 즉시 반환. 검색 화면의 `백그라운드` 버튼이 이를 호출한다
- [x] **F3** 지수 백오프 재시도 — `lib/api/retry.ts`
  - 타임아웃·네트워크·5xx·429만 재시도하고, 파라미터 오류 등 결정적 실패는 즉시 포기
  - 지터를 섞어 동시 재시도가 몰리는 것을 방지
  - 잡 단위로는 결과가 있으면서 일부 단계가 실패한 경우 `partial`로 남겨 판단을 사용자에게 넘긴다
- [x] **F13** 상시 Node 워커 — `workers/search-worker.ts` (`pnpm worker`)
  - `status='queued'` 조건부 UPDATE로 낙관적 잠금 (별도 트랜잭션 불필요)
  - 진행률 갱신이 `locked_at`을 겸해 heartbeat 역할. 5분 이상 정지 시 `reclaimStaleJobs()`가 큐로 회수
  - SIGINT/SIGTERM 시 진행 중 잡을 마치고 종료 (두 번 누르면 즉시)
- [x] **F7 후속** 워커가 잡 시작 시 `createPoizonClientForUser()`로 자격증명을 1회 로드해
      파이프라인 전체에 주입 → 액션마다 반복됐던 DB 왕복이 잡당 1회로 축소
- [x] **F14 (조기 해소)** 동시성 상한 — `mapWithConcurrency()`로 품번 조회 5, 네이버 5로 제한.
      화이트리스트도 잡당 1회만 로드 (기존에는 품번마다 재조회)
- [x] `/dashboard/jobs` 화면 — 상태 배지·단계별 진행률·제외 건수·부분 실패 사유·취소/재실행/삭제
- [x] 완료 알림 — 사이드바 `검색 작업` 배지 (진행 중 파란색 / 미확인 완료 초록색)
- [x] 결과 인계 — `결과 보기` → `/dashboard?job=<id>` → 검색 화면이 잡 결과를 그대로 로드.
      브랜드 잡은 `brandPage`·`brandId`를 복원해 `더 보기`가 이어진다

#### 아키텍처 결정: Realtime 대신 폴링

당초 Supabase Realtime 구독을 계획했으나 폴링으로 변경했다.

- `search_jobs`는 다른 테이블과 동일하게 **RLS 활성화 + 정책 없음**(service_role 전용)이라
  클라이언트 구독이 차단된다. 구독을 위해서는 `authenticated` 대상 SELECT 정책을 새로 열어야 한다
- 10.1에서 확인된 `Failed to set initial Realtime auth token` 문제와도 맞닿아 있다
- 잡은 길어도 수 분, 동시 건수도 적어 폴링 비용이 무시할 만하다
- `components/providers/search-jobs-provider.tsx`가 **한 곳에서만** 폴링하고
  사이드바 배지와 잡 목록이 이를 공유한다. 진행 중 3초 / 유휴 30초, 탭 복귀 시 즉시 갱신

#### 2단계에서 함께 정리한 것

- **파이프라인 단일화** — `search-board.tsx`에 있던 순수 변환 로직(약 150줄)을
  `lib/search/search-item.ts`로 추출해 클라이언트와 워커가 같은 코드를 쓴다 (F12 선행 작업)
- **POIZON 호출부 단일화** — `lib/api/poizon-search.ts`가 `PoizonClient`를 주입받는 형태로 분리되고
  `app/actions/poizon.ts`는 이를 위임만 한다 (기존에는 액션 안에만 존재)
- **네이버 클라이언트 Clerk 의존 제거** — `lib/api/naver-shopping.ts`에서 `createClerkSupabaseClient`를
  걷어내고 화이트리스트를 주입받는 형태로 변경. Next 런타임 밖(워커)에서도 호출 가능

#### end-to-end 검증 결과 (2026-08-20, 실데이터)

마이그레이션 적용 후 실제 POIZON/네이버 API로 검증 완료.

| 잡 | 결과 | 소요 |
|---|---|---|
| 브랜드 Nike ×3 | 3건 적재 | 4.3s |
| 브랜드 Nike ×30 | 30건 적재 | 10.1s |
| 품번 3개 (1개는 존재하지 않는 값) | 2건 적재 + `조회 결과 없음` 경고 | 4.5s |

- 잡 잠금·진행률(30/30)·부분 실패(`partial`)·정상 종료(SIGTERM 후 현재 잡 완료) 모두 확인
- payload 건당 약 29KB (`raw` 축약 적용 후). 30건 기준 881KB
- 데이터 정확성 확인 — 평균가 `₩119,574`, 옵션 25개, 30일 판매량 `27,700+` 등 실데이터와 동일한 표기

#### 검증 중 발견해 수정한 결함

- [x] **재시도가 실제로는 동작하지 않던 경로** — `searchNaverShoppingWithWhitelist()`는 실패를
      예외가 아닌 `{ success: false }`로 반환하는데, 이를 `withRetry()`로 감싸고 있어
      재시도가 **한 번도 걸리지 않았다**. 반환값을 예외로 승격시켜 해결
- [x] **호출 빈도 제한이 재시도 대상에서 누락** — POIZON은 중국어로 응답(`400010007: 调用频次超限`)하고
      네이버는 `Rate limit exceeded`를 쓰는데 패턴 목록에 영문 `too many requests`·`429`만 있었다.
      30건 검색에서 KR 통계 1건 + 네이버 20건이 재시도 없이 실패 → 패턴 추가 후 **전부 흡수됨**
- [x] **청크 분산이 무의미했던 문제** — 첫 청크 외 전부가 동일하게 500ms만 대기해 결국 한꺼번에 발사됐다.
      윈도 내 순번에 비례한 지연으로 변경, 동시성 4→3, 네이버 동시성 5→3
- [x] **경고·로그 폭증** — 동일 사유가 품번마다 쌓여 30건 검색에 경고 30개 + 스택 트레이스 30개가 남았다.
      사유별로 건수와 예시 3개만 남기는 집계 방식으로 변경 (로그도 사유당 1회)
- [x] **CN 통계 실패를 경고로 올리던 문제** — `Overseas region information not found`는
      계정/상품에 따라 정상 발생하며 KR 폴백이 설계된 동작이므로 경고에서 제외
- [x] **결과 없는 품번을 조용히 누락** — 어느 품번이 비었는지 알 수 없었다. `조회 결과 없음` 경고 추가

#### 남은 작업

- [x] UI 육안 확인 — 메인 검색 화면 자체는 거의 바뀌지 않아 체감이 약함을 확인.
      2단계는 백그라운드 잡 구현 단계였고, 메인 UI 재구성은 4단계로 남겨둔다
- [x] **외부·차단성 확인 완료** — 네이버 개발자센터 `검색 > 쇼핑 API`는 2026-07-31 종료.
      기존 키 포함 호출 불가이며 NAVER API HUB에도 대체 API가 없다.
      → 아래 10.3A의 **다중 몰 오퍼 집계**로 원가 소스 전략 전환
- [x] 배포 시 Route Handler + 크론으로 워커 이식 — `app/api/cron/search-worker/route.ts`
      + `lib/search/worker-run.ts` 공유 코어. `pnpm worker`는 동일 코어를 루프로 호출.
      Vercel Cron: `vercel.json` (`* * * * *`, 매분). 인증: `Authorization: Bearer $CRON_SECRET`
      (로컬 장시간 잡은 계속 `pnpm worker` 권장. 서버리스는 호출당 1잡·maxDuration 내 완료)
- [x] **워커 미기동 감지** (2026-08-25) — `kolon` 브랜드 잡 2건이 18~21시간 `queued`로 방치.
      원인: 로컬에 `pnpm worker` 없음, `.env`에 `CRON_SECRET` 없음(배포 크론도 로컬 큐를 안 집어감).
      `/dashboard/jobs`에서 45초+ 대기는 안내 배너. 사이드바는 실제 `running`만 스피너
- [x] **연속 수집 (최대 500)** (2026-08-25) — 1페이지 단발이 아니라 브랜드 페이지를 넘기며 손 안 댄 품번 500개까지 적재.
      페이지마다 중간 저장. 로컬 워커는 이어서 처리, 크론은 호출당 1페이지. `running`+잠금 없음도 claim.
      워커가 원가 오퍼+SKU 노출가까지 payload에 넣어 `결과 보기` 시 추가 조회 없음. 진행 중이어도 결과 보기.
      손댄 품번(검토·메모·스킵·입찰·재고·알림·영구제외)은 다음 수집에서 제외. `손댄 품번 합치기`·`선택 가격 갱신`
- [x] 화면을 닫아두는 사용 패턴 대응 — Web Push (2026-08-26)
      - 이벤트: 검색 잡 `done` / `partial` / `failed`. 재시도 대기·사용자 취소는 안 보냄
      - VAPID + `public/sw.js` + `push_subscriptions`. 워커가 종료 시 발송
      - `/dashboard/jobs`에서 허용·해제·테스트. 클릭은 적재 건이 있으면 결과, 없으면 잡 목록
      - 가격 워치 도달 푸시는 같은 구독으로 §7에서 처리

### 10.3A [신규 최우선] 외부 원가 소스 전환

> 네이버 쇼핑 검색 종료로 인해, 원가 추정의 기준을 `네이버 최저가 1개`에서
> `여러 몰 종합 오퍼 상위 10개`로 전환한다.

- [x] **S1** 오퍼 데이터 모델 정의 — 품번당 상위 10개 오퍼 (`types/source-offer.ts`)
  - 필드: `source`, `sourceLabel`, `price`, `title`, `link`, `image`, `availabilityHint`, `normalizedArticleNumber`, `fetchedAt`
  - 같은 몰 중복 허용 (같은 몰이라도 다른 페이지/옵션/프로모션이면 별도 오퍼), 동일 링크만 dedupe
- [x] **S2** 저장 구조 결정 — `search_job_items.payload.sourceOffers`에 포함
- [x] **S3** 백그라운드 잡 단계 교체 — `naver` 단계를 `sourceOffers` 수집으로 교체
- [x] **S4** 초기 타깃 몰 연결 — 롯데ON, 롯데백화점몰(`mall_no=2`), 롯데아이몰, 무신사, 코오롱몰, SSG, G마켓
  - (+2026-08-24) **나이키 코리아**(`nike`), **이랜드몰**(`elandmall`), **ABC마트**(`abcmart`)
  - (+2026-08-25) **29CM**(`29cm`), **W컨셉**(`wconcept`)
  - (+2026-08-26) **11번가**(`11st`) — 가격비교에 반복되는 오픈마켓. `apis.11st.co.kr/search/api/tab`
  - (+2026-08-26) **GS샵**(`gsshop`) · **현대Hmall**(`hmall`) · **더현대닷컴**(`thehyundai`) · **CJ온스타일**(`cjonstyle`)
    — 다나와 가격비교에 반복되는 홈쇼핑·백화점 플랫폼. 롯데홈쇼핑은 롯데아이몰(`lotteimall.com`)과 동일 사이트라 별도 파서 없음
  - 롯데ON은 정규식 필드 조립 대신 `priceInfo` 포함 **상품 객체 단위** 파싱 (`extractJsonObjectsContainingKey`).
  - 롯데백화점몰은 ellotte.com이 롯데ON `mall_no=2`로 리다이렉트되므로 같은 파서에 몰 번호만 넣어 분리 수집
  - 롯데아이몰은 `searchMain.lotte?isTemplate=Y` JSON (`search_result_goods_info`)
  - 무신사는 검색 HTML에 상품이 1건만 직렬화되어 페이지가 호출하는 공개 JSON 엔드포인트를 사용
  - 코오롱몰은 `/search?searchKeyword=`가 404. 실제 검색은 `/Search?keyword=` + persisted GraphQL.
        상품명에는 품번이 없고 상품코드(`TLTCM26521BLK`)에만 있으므로 제목에 코드를 붙여 검증한다
  - SSG 검색 HTML(`/search.ssg`)은 403. 상품 목록은 `POST /api/item/all`(target=`pc_item`)로 수집.
  - G마켓은 `__NEXT_DATA__` 파서를 넣었으나 서버 `fetch`는 Akamai 403. 브라우저에서는 검색됨
  - 나이키 코리아는 Wall SSR `__NEXT_DATA__`의 `productGroupings` (공식몰 품번 검색)
  - 이랜드몰은 검색 HTML 상품 카드의 `data-item-no` / `data-saleprice` / `data-item-name`
  - ABC마트는 검색 목록 HTML이 비어 있고 AJAX `result/list`에 카드가 있다. 품번 전체(`CW2288-111`)는 0건인 경우가 많아 스타일 접두(`CW2288`)로 재검색한 뒤 `/product/info`의 `styleInfo`+`prdtColorInfo`로 검증한다. 채널 10001(ABC마트)·10002(그랜드스테이지) 모두 수집
  - 29CM 검색 HTML(`/store/search`)은 오퍼가 없고, 페이지가 쓰는 `display-bff-api` `POST /api/v1/listing/items`(pageType=`SRP`)로 수집. 상품명에 스타일 코드가 있으면 품번 검증에 쓴다
  - W컨셉 검색 HTML은 건수만 SSR되고 목록은 `api-display` `POST /display/api/v3/search/result/product`. 키는 페이지 `runtimeConfig.DISPLAY_API_KEY`(프론트 공개값)이며 401이면 페이지에서 다시 읽는다
  - 11번가는 검색 HTML이 빈 셸이고, 페이지가 쓰는 `apis.11st.co.kr/search/api/tab`(poc=`pc`, tabId=`TOTAL_SEARCH`)로 수집
  - GS샵은 검색 HTML(`/shop/search/main.gs`)의 `#searchPrdList` 카드(`data-prdid` · `prd-name` · `set-price`)
  - 현대Hmall은 Next 검색 페이지가 쓰는 `GET /api/hf/dp/v1/search/search?searchTerm=` (`hmallItemSearchResultList`)
  - 더현대닷컴(더현대Hi)은 `GET /proxy/v1/dp/search/searchResult` (`searchQuery` · `searchType=NCP_PRODUCT`)
  - CJ온스타일은 검색 HTML이 빈 셸이고 `search.cjonstyle.com/search-web/search/cjmall/item.json?k=`
  - 롯데홈쇼핑 도메인(`lottehomeshopping.com`)은 롯데아이몰로 연결되므로 `lotteimall` 파서가 담당
  - **품번 검증 필수** (`matchesArticleNumber`) — 몰 검색은 품번으로 질의해도 무관한 상품을 섞어 준다.
        실측: `CW2288-111` 60건 중 13건이 다른 상품이고 최저가(77,420원)가 전혀 다른 모델,
        `DD1391-100` 9건 중 8건이 5,070원대 잡화. 걸러내지 않으면 원가·마진이 그대로 어긋난다
  - 몰별 상한 5개 — 한 몰이 상위 10개를 독점해 품절 시 대안이 보이지 않는 것을 방지
- [x] **S5** 입찰 계산 규칙 전환 — 마진 기본 원가 = 1등 오퍼 가격(`getBestSourceOfferPrice`), 모달에서 10개 전체 제공
- [x] **S6** 제약 명시
  - 네이버 경유 쿠폰/네이버페이 추가 할인까지 100% 재현하는 것은 범위 밖
  - 1차 목표는 **직접 구매 가능한 원가 상한선** 확보

#### S4 남은 과제

- [~] 몰 커버리지 확대 — **2026-08-26**: `lfmall`(GET `nxapi` multiSearch, CSRF 불필요) · `hiver`(capi `search/products`, 공개 guest Authorization) 추가.
      무신사는 S4부터 `musinsa`로 이미 연결. 품번 미판매는 `empty`.
      입점 셀러·스마트스토어는 가게마다 HTML/API가 달라 파서 대량 추가 대상이 아님 (PRD §5.7).
      같은 날: `gsshop` · `hmall` · `thehyundai` · `cjonstyle` · `11st` 추가. 롯데홈쇼핑은 `lotteimall`과 동일.
      보류: 쿠팡·옥션·아디다스 KR(서버 fetch 403). 빈 `limited` 스텁은 넣지 않음.
      네이버 카탈로그는 봇 418이라 같은 품번(`JWJGX25211`) 다나와 가격비교의 **플랫폼 몰**을 기준으로 함.
      2026-08-25: `29cm`(display-bff listing SRP) · `wconcept`(api-display 검색, 공개 DISPLAY-API-KEY) 추가.
      2026-08-24: `nike` · `elandmall` · `abcmart`로 스니커즈 공백을 줄임
- [x] **수집 몰 게시판 상태 관리** (`/dashboard/malls`, PRD §5.7) — 활성·품질·점검 상태(`ok`/`empty`/`failed`/미점검),
      상태 필터·요약 카운트·개별/전체/오래된만 연결 점검·캐시 비우기. 몰 추가 절차는 레지스트리+파서 (UI 전용 등록 없음)
- [x] **파서 회귀 감시** — `pnpm check:offers` (`scripts/check-source-offers.ts`)
      - 몰×품번 프로브, `failed` 시 exit 1 (파서/차단 회귀)
      - `--write-db`로 `source_malls` 점검 컬럼 갱신, `--json` 리포트
      - 기본 품번: `CW2288-111`(스니커즈), `TLTCM26521`(코오롱 의류)
      - (선택) CI/cron에서 `pnpm check:offers --write-db` 주기 실행. 워커 Route Handler 이식과 별개
      - 코오롱몰 hash 변경 시 `lib/sourcing/providers/kolonmall.ts`의 `SEARCH_HASH` 수동 갱신

### 10.3 [3단계] 캐시·동시성

- [x] **F5** TTL 캐시 테이블 — `source_offer_cache`(1h), `poizon_spu_cache`(통계 6h).
      마이그레이션 `20260820173000_create_search_caches.sql` 실데이터 DB 적용 완료
  - 그 전까지 마이그레이션을 대시보드에서 수동 적용해 원격 이력이 비어 있었다.
        `supabase migration repair --status applied`로 기존 11건을 기록한 뒤 `db push`로 적용.
        이후로는 `supabase db push`가 정상 동작하므로 수동 적용하지 말 것
- [~] **F6** `getSpuStatistics` 청크 병렬도·delay를 `SpuStatisticsOptions`로 분리 (2단계에서 처리).
      청크 **내부**의 SPU → globalSKU → fallbackSKU 순차 `await`는 데이터 의존성 때문에 남아 있음
- [x] **F14** 네이버 동시성 상한 5 + 화이트리스트 잡당 1회 로드 (2단계에서 처리)

### 10.4 [4단계] UI 재구성 — **완료 (2026-08-24)**

> PRD v0.7 §5.1 반영. 뷰(데이터 모델)와 표시(필터)를 분리하고 툴바를 2단·오버플로로 정리한다.

- [x] **F8** 툴바 2단 분리 — 1행(검색: 타입·입력·조회·백그라운드) / 2행(결과: 뷰 탭·표시·분류·건수·일괄 입찰),
      부가 액션(너비 초기화·목록 비우기·마진·조회수·검색 제외 옵션)은 오버플로 메뉴 (`MoreHorizontal`)
- [x] **F9** 관리 열 6슬롯 정규화 — SKU와 동일 순서 `선택·입찰·재고·검토·메모·스킵`.
      SPU는 입찰/재고 자리만 유지, 제외·삭제는 케밥 (`spu-row-manage-cell.tsx`)
- [x] **F10** '검토' 개념 통합 — 「표시」 드롭다운(`전체`/`미처리`/`스킵 숨김`/`검토 숨김`).
      검색 시 스킵·검토완료 제외는 오버플로 「검색 옵션」+ localStorage + `search_jobs.options` 유지
- [x] **F11** '수익 상품만'을 뷰 탭으로 승격 — `품번 | 옵션 | 수익 옵션`
      (`workspaceView`: hierarchy | sku | profitable). 표시 필터와 독립
- [x] 컬럼 9 → 7 병합 — `관리` / `상품` / `POIZON`(거래가+노출가) / `원가 오퍼` / `순수익` / `판매`(중국·현지) / `입찰`.
      병합 열은 서브라벨 클릭으로 각각 정렬. 표기 소스는 현행 유지(SKU `leakPrice`, 접힌 품번 통계 `minPrice`).
      너비 저장 키 `poizon_dashboard_widths_v5`.

#### 4단계 구현 메모 (2026-08-24)

- `components/dashboard/dashboard-view-tabs.tsx` — 뷰 탭 + `DisplayFilterSelect`
- `components/dashboard/spu-row-manage-cell.tsx` — SPU 관리 열
- `search-board.tsx` — `showOnlyProfitable`/`showOnlyUnprocessed` 제거 → `workspaceView`/`displayFilter`
- `stacked-metric-cell.tsx` — POIZON·판매 2줄 셀. 헤더 서브라벨 정렬 (`avg`/`exposure`/`salesChina`/`salesLocal`)
- 플랫 뷰 순수익 정렬·수익 옵션 필터는 화면과 같은 `skuOfferProfit`(추천가 반영)을 씀

### 10.5 [5단계] 컴포넌트 분해·접근성 — **완료 (2026-08-24)**

> 4단계 컬럼 9→7은 표기 소스 변경 없이 완료. F12·F15·색 의존 해소 완료.

- [x] **F12** `search-board.tsx` 분해 — 데이터 훅 / 툴바 / 테이블 / 행 단위. 파생 상태는 `useMemo`로 흡수해 `useState` 축소
  - [x] 순수 헬퍼 분리: `lib/search/search-history.ts`, `brand-progress.ts`, `client-exclusion.ts`,
        `lib/utils/exposure-price.ts`, `getChildSkuIds` → `search-item.ts`
  - [x] 2단 툴바 → `components/dashboard/search-board-toolbar.tsx`
  - [x] 테이블 헤더·행 — `search-board-results-table.tsx` + `search-board-spu-row.tsx` /
        `search-board-sku-row.tsx` + `search-board-table-context.tsx`
  - [x] 검색·추천가 큐·원가 오퍼 훅 — `hooks/use-poizon-search.ts`,
        `use-sku-recommendation-queue.ts`, `use-source-offers.ts`
- [x] **F15** 접근성 — 관리 열 22px는 `aria-label`만(밀도 유지). 툴바·사이드바 아이콘 단독은 md+ 텍스트.
      수익/손실 `▲ +₩` / `▼ -₩`. 목록 비우기·행 삭제 확인. 색 의존 해소는 별도 항목
  - [x] 22px 아이콘 단독 버튼 `aria-label`
  - [x] 툴바 더보기·사이드바 접기/펴기 md+ 텍스트
  - [x] 수익/손실 `▲ +₩` / `▼ -₩`
  - [x] 행 삭제·최근 검색 전체 삭제 확인 (목록 비우기는 기존 confirm 유지)
- [x] 색 의존 해소 — 부분 검토는 CircleDot+골드, 스킵은 EyeOff+슬레이트. 행 테두리·배지 음영 동시 맞춤

### 10.6 이월 과업 (루트 `TODO.md` 통합 + 노출가 후속)

- [x] 수익 정렬 기능 (수익 높은 순/낮은 순) — 테이블 「순수익」 헤더 클릭 (`SortKey: profit`)
- [x] 효자 상품(고수익 품목) 자동 시각적 강조 및 알림 (2026-08-24)
  - 기준: 추정 순수익 ≥ `system_settings.min_fee × 2` (수익 옵션 `> 0`보다 한 단계 위)
  - 시각: 순수익 셀 Sparkles + 바이올렛 + `효자`. 행 왼쪽 테두리는 상태용으로 유지
  - 알림: 푸시 아님. 툴바 `효자 n` 칩, 클릭 시 수익 옵션 뷰 + 순수익 내림차순
- [x] 입찰 알림 (특정 가격 이하 도달 시) — 인앱 워치 (2026-08-24) + **Web Push (2026-08-26)**
  - SKU 입찰 열 Bell. 목표가 = 입찰 입력값 또는 현재 노출가. 도달 = 노출가 ≤ 목표가
  - `sku_status.watch_price` / `watch_at`. 툴바 `알림 n` → 옵션 뷰에서 도달 건만 (화면이 열려 있을 때)
  - 화면을 닫아 두면 워커가 약 5분마다 노출가를 조회해 푸시. `watch_notified_at` / `watch_checked_at`
  - 원격 DB: `20260824220000_add_sku_watch_price.sql`, `20260826123000_add_sku_watch_push.sql`
- [x] **노출가 후속 (표기 현행 유지, 2026-08-24)**
  - 접힌 품번(SPU)은 통계 `minPrice` 유지. 호버로 SKU `leakPrice`와 소스가 다를 수 있음을 안내 (같은 소스로 맞추지 않음)
  - SKU 호버: 노출 보장(표기) + 최저 입찰가(`globalMinPrice`) + 기회 확대(`effectiveExposurePrice`, 있을 때만)
  - `lib/utils/exposure-price.ts` 분해 헬퍼, `components/dashboard/exposure-price-hint.tsx`
- [x] 목표 마진율 역산 권장 입찰가 (2026-08-24, §6)
  - 마진 설정에 목표 마진율. 원가가 있는 SKU 입찰 열 `권장 ₩` → 클릭 채움
