# Poizon (Dewu) API - General Parameters (공식 문서 기준)

Poizon Open Platform 공식 API 문서(`open.poizon.com/docs`)를 바탕으로 작성된 **공통 파라미터(General Parameters) 및 서명(Signature) 알고리즘**의 정확한 명세입니다.

---

## 1. 공통 파라미터 목록 (General Parameters)

Poizon API 호출 시 기본으로 요구되거나 사용되는 파라미터 목록입니다. (주의: `appKey`가 아닌 `app_key` 등 snake_case가 기본 스펙입니다.)

| 파라미터 (Name) | 타입 (Type) | 필수여부 (Req) | 설명 (Description) | 예시 (Example) |
|---|---|:---:|---|---|
| **`app_key`** | String | O | 애플리케이션 식별 키 (App Key). Console에서 발급받은 값. | `abc123xyz` |
| **`timestamp`** | Long | O | 현재 시점의 **밀리초(ms)** 기준 타임스탬프 13자리 숫자. | `1711333748000` |
| **`sign`** | String | O | 생성된 서명 문자열 (32-bit MD5 해시, **대문자**). | `AC9B6E14F...` |
| **`access_token`** | String | △ (조건부) | 셀러(판매자)의 권한이 필요한 API 호출 시 필요한 인증 토큰. | `tok_xyz123` |
| **`language`** | String | 권장 | 응답 언어 코드. | `en`, `zh`, `ko` 등 |
| **`timeZone`** | String | 권장 | 날짜/시간 데이터를 처리하기 위한 타임존. | `Asia/Seoul`, `UTC` 등 |

---

## 2. 서명 방식 (Signature Algorithm) - 정확한 생성 절차

Poizon API의 서명(`sign`)을 생성하는 엄격한 규칙은 다음과 같습니다. 데이터의 무결성과 송신자 인증을 위해 필수적입니다.

### 📌 서명 생성 프로세스:

1. **파라미터 수집 및 필터링**
   - 전송할 모든 파라미터(General + Business 데이터)를 모읍니다.
   - ❌ **제외 대상**: `appSecret`, 빈 값(null 또는 empty string), `sign` 파라미터 본인은 서명 생성 시 제외합니다.
2. **사전순 정렬 (ASCII Order)**
   - 남은 파라미터들의 Key 값을 기준으로 **오름차순(a-z)** 으로 정렬합니다.
3. **배열(Array) 값의 특별한 직렬화 법칙**
   - 만약 파라미터의 값이 JSON 배열(`[]`) 형태인 경우, **대괄호(`[]`)를 제거**하고 내부 요소를 오직 **쉼표(`,`)**로 연결한 문자열 상태로 만들어야 합니다.
   - 예시: `sku_list=[{"id":1}, {"id":2}]` ➡️ 변환 ➡️ `{"id":1},{"id":2}`
4. **URL 포맷 결합 (String A)**
   - 정렬된 각 요소를 `key=value` 형태로 묶고, 요소 간에는 `&`를 붙여 하나의 긴 문자열을 생성합니다.
   - ⚠️ **매우 중요 (URL 인코딩)**: 문자열 결합 시 **Key와 Value 모두 반드시 `UTF-8` 언어로 URL 인코딩(URLEncoder)** 처리해야 합니다. (공백이 `%20`으로 처리되는지, `+`로 처리되는지 사용하는 라이브러리 검증 필수)
   - 예시: `app_key=xyz&sku_list=%7B...%7D&timestamp=1234567890000`
5. **App Secret 덧붙이기**
   - 결합된 문자열(String A)의 가장 마지막에 있는 `&`를 제거한 후, 당신의 **`appSecret` 값을 문자열 맨 뒷부분에 바로 이어 붙입니다.**
   - 예시 결과: `urlEncode(key1)=urlEncode(val1)&...&urlEncode(keyN)=urlEncode(valN)appSecret`
6. **MD5 해시 암호화 및 대문자화**
   - 완성된 텍스트 원문에 대해 **32-bit MD5** 해시를 돌립니다.
   - 해시된 결과를 전부 **대문자(Uppercase)** 로 변환하면 최종 `sign` 값이 완성됩니다.

---
> **참고사항**: `lib/api/poizon.ts` 제작 시, 이 직렬화 및 해시 알고리즘을 구현하는 `generateSignature(params, secret)` 유틸리티 함수를 반드시 먼저 작성해야 합니다.
