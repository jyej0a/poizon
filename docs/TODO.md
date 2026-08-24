# 프로젝트 구현 TODO (기반: PRD v0.9)

## 0. 프로젝트 공통 및 인프라
- [x] Next.js 15 (App Router) + Tailwind v4 + shadcn/ui 기반 설정
- [x] Supabase 기본 연결 및 Clerk (Native Integration) 초기 세팅
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-18, 판매량 정합성·POIZON 문의 항목)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-06-19, SKU 입찰표시·검토완료·상태 DB)
- [x] `.cursor/rules/docs-sync.mdc` — 스펙 변경 시 PRD/TODO 선행 갱신 규칙 (2026-08-24)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 4단계 UI 재구성 착수)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, §5.7 수집 몰 상태·추가 절차)
- [x] `docs/PRD.md` 및 `docs/TODO.md` 현행화 (2026-08-24, 몰 커버리지 +나이키KR·이랜드몰)

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

> **주의 (2026-08-20 확인)**: ESLint가 실제로는 **전혀 실행되지 않고 있다.**
> `eslint-plugin-react-hooks`가 미설치라 `eslint-config-next` 로드가 실패하며,
> `pnpm add`로 설치를 시도하면 pnpm store 위치 불일치로 거부된다
> (`.pnpm-store/`가 프로젝트에 생성된 상태). 빌드는 이 실패를 치명적으로 보지 않아 통과한다.
> → `pnpm install`로 store를 재정리한 뒤 플러그인을 설치해야 린트 커버리지가 복원된다.
> 위 "경고 목록"은 린트가 동작하던 시점의 기록이므로 실제 현황과 다를 수 있다.

#### 1단계 중 확인된 잔여 이슈 (미착수)

- [ ] **죽은 코드** — `lib/supabase.ts`, `lib/supabase/client.ts` 모두 **참조 0건**.
      `AGENTS.md`가 `lib/supabase.ts`를 "레거시, 사용 지양"으로 표기 중이므로 삭제 검토
- [ ] **스캐폴드 페이지 잔존** — `/auth-test`, `/storage-test`가 프로덕션 빌드에 포함(각 204kB, 최대 번들)
- [ ] **Realtime 경고** — 빌드 중 `Failed to set initial Realtime auth token: TypeError: a is not a function` 2회.
      `useClerkSupabaseClient`의 `accessToken` 콜백이 SSR 시점에 평가되며 발생(위 스캐폴드 페이지 기인).
      **2단계 Realtime 잡 구독 시 반드시 `useEffect` 내부(클라이언트 전용)에서 채널 생성**할 것

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
- [ ] 배포 시 Route Handler + 크론으로 워커 이식 (현재는 로컬 상시 프로세스)
- [ ] (검토) 화면을 닫아두는 사용 패턴 대응 — Web Push / Notification API

### 10.3A [신규 최우선] 외부 원가 소스 전환

> 네이버 쇼핑 검색 종료로 인해, 원가 추정의 기준을 `네이버 최저가 1개`에서
> `여러 몰 종합 오퍼 상위 10개`로 전환한다.

- [x] **S1** 오퍼 데이터 모델 정의 — 품번당 상위 10개 오퍼 (`types/source-offer.ts`)
  - 필드: `source`, `sourceLabel`, `price`, `title`, `link`, `image`, `availabilityHint`, `normalizedArticleNumber`, `fetchedAt`
  - 같은 몰 중복 허용 (같은 몰이라도 다른 페이지/옵션/프로모션이면 별도 오퍼), 동일 링크만 dedupe
- [x] **S2** 저장 구조 결정 — `search_job_items.payload.sourceOffers`에 포함
- [x] **S3** 백그라운드 잡 단계 교체 — `naver` 단계를 `sourceOffers` 수집으로 교체
- [x] **S4** 초기 타깃 몰 연결 — 롯데ON, 롯데백화점몰(`mall_no=2`), 롯데아이몰, 무신사, 코오롱몰, SSG, G마켓
  - (+2026-08-24) **나이키 코리아**(`nike`), **이랜드몰**(`elandmall`)
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
  - **품번 검증 필수** (`matchesArticleNumber`) — 몰 검색은 품번으로 질의해도 무관한 상품을 섞어 준다.
        실측: `CW2288-111` 60건 중 13건이 다른 상품이고 최저가(77,420원)가 전혀 다른 모델,
        `DD1391-100` 9건 중 8건이 5,070원대 잡화. 걸러내지 않으면 원가·마진이 그대로 어긋난다
  - 몰별 상한 5개 — 한 몰이 상위 10개를 독점해 품절 시 대안이 보이지 않는 것을 방지
- [x] **S5** 입찰 계산 규칙 전환 — 마진 기본 원가 = 1등 오퍼 가격(`getBestSourceOfferPrice`), 모달에서 10개 전체 제공
- [x] **S6** 제약 명시
  - 네이버 경유 쿠폰/네이버페이 추가 할인까지 100% 재현하는 것은 범위 밖
  - 1차 목표는 **직접 구매 가능한 원가 상한선** 확보

#### S4 남은 과제

- [~] 몰 커버리지 확대 — **2026-08-24**: `nike`(나이키 코리아, `__NEXT_DATA__` Wall) · `elandmall`(이랜드몰 HTML 카드) 추가.
      스니커즈(품번 검색) 공백을 줄이는 1차 확장. 하이버/29CM/W컨셉은 공개 검색 API가 서버 fetch에 닫혀 보류.
      코오롱 계열 외 의류·잡화 빈 칸은 추가 몰·파서로 계속 확대
- [x] **수집 몰 게시판 상태 관리** (`/dashboard/malls`, PRD §5.7) — 활성·품질·점검 상태(`ok`/`empty`/`failed`/미점검),
      상태 필터·요약 카운트·개별/전체 연결 점검·캐시 비우기. 몰 추가 절차는 레지스트리+파서 (UI 전용 등록 없음)
- [ ] 파서 회귀 감시 자동화 — `scripts/check-source-offers.ts` 주기 실행 + (선택) 워커/크론 연동.
      코오롱몰 persisted query hash 변경 시 `lib/sourcing/providers/kolonmall.ts`의 `SEARCH_HASH` 갱신

### 10.3 [3단계] 캐시·동시성

- [x] **F5** TTL 캐시 테이블 — `source_offer_cache`(1h), `poizon_spu_cache`(통계 6h).
      마이그레이션 `20260820173000_create_search_caches.sql` 실데이터 DB 적용 완료
  - 그 전까지 마이그레이션을 대시보드에서 수동 적용해 원격 이력이 비어 있었다.
        `supabase migration repair --status applied`로 기존 11건을 기록한 뒤 `db push`로 적용.
        이후로는 `supabase db push`가 정상 동작하므로 수동 적용하지 말 것
- [~] **F6** `getSpuStatistics` 청크 병렬도·delay를 `SpuStatisticsOptions`로 분리 (2단계에서 처리).
      청크 **내부**의 SPU → globalSKU → fallbackSKU 순차 `await`는 데이터 의존성 때문에 남아 있음
- [x] **F14** 네이버 동시성 상한 5 + 화이트리스트 잡당 1회 로드 (2단계에서 처리)

### 10.4 [4단계] UI 재구성 — **착수 중 (2026-08-24)**

> PRD v0.7 §5.1 반영. 뷰(데이터 모델)와 표시(필터)를 분리하고 툴바를 2단·오버플로로 정리한다.

- [x] **F8** 툴바 2단 분리 — 1행(검색: 타입·입력·조회·백그라운드) / 2행(결과: 뷰 탭·표시·분류·건수·일괄 입찰),
      부가 액션(너비 초기화·목록 비우기·마진·조회수·검색 제외 옵션)은 오버플로 메뉴 (`MoreHorizontal`)
- [x] **F9** 관리 열 6슬롯 정규화 — SKU와 동일 순서 `선택·입찰·재고·검토·메모·스킵`.
      SPU는 입찰/재고 자리만 유지, 제외·삭제는 케밥 (`spu-row-manage-cell.tsx`)
- [x] **F10** '검토' 개념 통합 — 「표시」 드롭다운(`전체`/`미처리`/`스킵 숨김`/`검토 숨김`).
      검색 시 스킵·검토완료 제외는 오버플로 「검색 옵션」+ localStorage + `search_jobs.options` 유지
- [x] **F11** '수익 상품만'을 뷰 탭으로 승격 — `품번 | 옵션 | 수익 옵션`
      (`workspaceView`: hierarchy | sku | profitable). 표시 필터와 독립
- [ ] 컬럼 9 → 7 병합 — `선택·상태` / `상품` / `POIZON`(거래가+노출가) / `원가 오퍼` / `마진` / `판매(중국·현지)` / `입찰`.
      **선행**: 8.2 노출가 기준값 확정 (SKU는 `leakPrice`, SPU는 `minPrice`로 같은 컬럼에서 소스 불일치)

#### 4단계 구현 메모 (2026-08-24)

- `components/dashboard/dashboard-view-tabs.tsx` — 뷰 탭 + `DisplayFilterSelect`
- `components/dashboard/spu-row-manage-cell.tsx` — SPU 관리 열
- `search-board.tsx` — `showOnlyProfitable`/`showOnlyUnprocessed` 제거 → `workspaceView`/`displayFilter`

### 10.5 [5단계] 컴포넌트 분해·접근성

- [ ] **F12** `search-board.tsx` 3,501줄 분해 — 데이터 훅 / 툴바 / 테이블 / 행 단위. 파생 상태는 `useMemo`로 흡수해 `useState` 53개 축소
- [ ] **F15** 접근성 — 22px 아이콘 단독 버튼에 `aria-label` 부여, md 이상에서 텍스트 라벨 노출,
      수익/손실에 부호(`+₩`/`-₩`) 병기, 파괴적 액션(목록 비우기·삭제)에 확인 단계 추가
- [ ] 색 의존 해소 — 주황색이 '부분 검토'와 '스킵' 두 의미를 겸함. 아이콘 형태로 구분

### 10.6 이월 과업 (루트 `TODO.md` 통합)

- [ ] 수익 정렬 기능 (수익 높은 순/낮은 순)
- [ ] 효자 상품(고수익 품목) 자동 시각적 강조 및 알림
- [ ] 입찰 알림 (특정 가격 이하 도달 시)
