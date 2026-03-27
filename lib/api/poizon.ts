import crypto from "crypto";

export interface PoizonConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string; // 셀러 OAuth 토큰: 입찰/리스팅 등 셀러 행위에 필수
  baseUrl?: string;
  version?: string;
}

export class PoizonClient {
  private appKey: string;
  private appSecret: string;
  private accessToken?: string;
  private baseUrl: string;
  private version: string;

  constructor(config: PoizonConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl || "https://open.poizon.com";
  }

  /**
   * Java의 URLEncoder.encode("UTF-8")와 동일하게 동작하도록 하는 인코딩 유틸리티
   */
  private javaUrlEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/%20/g, "+") // 공백은 + 로
      .replace(/[!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * 공식 문서에 기반한 서명(Signature) 생성 로직
   */
  public generateSignature(params: Record<string, any>): string {
    const filteredParams: Record<string, string> = {};

    // 1. null, undefined, 빈 문자열, sign, appSecret 제외
    for (const [key, value] of Object.entries(params)) {
      if (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        key !== "sign" &&
        key !== "appSecret"
      ) {
        // 3. 배열(Array) 직렬화 법칙 (대괄호 제외, 쉼표 연결)
        if (Array.isArray(value)) {
          filteredParams[key] = value.map(item => 
            typeof item === "object" ? JSON.stringify(item) : String(item)
          ).join(",");
        } 
        // 객체는 JSON 문자열로 변환
        else if (typeof value === "object") {
          filteredParams[key] = JSON.stringify(value);
        } else {
          filteredParams[key] = String(value);
        }
      }
    }

    // 2. 키 이름 기준 ASCII 오름차순 정렬
    const sortedKeys = Object.keys(filteredParams).sort();

    // 4. URL 포맷 결합 (UTF-8 URL 인코딩 적용)
    const queryParts: string[] = [];
    for (const key of sortedKeys) {
      const encodedKey = this.javaUrlEncode(key);
      const encodedValue = this.javaUrlEncode(filteredParams[key]);
      queryParts.push(`${encodedKey}=${encodedValue}`);
    }

    const stringA = queryParts.join("&");

    // 5. App Secret 덧붙이기 (맨 마지막 & 없이 직접 결합)
    const stringToSign = stringA + this.appSecret;

    // 6. 32-bit MD5 알고리즘 암호화 및 대문자 변환
    return crypto.createHash("md5").update(stringToSign, "utf8").digest("hex").toUpperCase();
  }

  /**
   * 공용 API 요청 메서드
   * @param endpoint API 엔드포인트 (예: "/item/search")
   * @param businessParams 비즈니스 파라미터 (페이로드)
   */
  public async request<T = any>(endpoint: string, businessParams: Record<string, any> = {}): Promise<T> {
    // 공통 파라미터를 비즈니스 파라미터와 병합하여 하나의 JSON Payload로 구성
    const payload: Record<string, any> = {
      app_key: this.appKey,
      timestamp: Date.now(),
      language: "en",
      timeZone: "Asia/Seoul",
      // access_token이 있을 때만 포함 (조회 API는 불필요, 입찰/리스팅은 필수)
      ...(this.accessToken ? { access_token: this.accessToken } : {}),
      ...businessParams,
    };

    // 서명 생성 후 Payload에 추가
    payload.sign = this.generateSignature(payload);

    const url = `${this.baseUrl}${endpoint}`;

    // 모든 데이터를 POST JSON Body로 전송
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 에러 텍스트가 비어있을 경우 상태 텍스트라도 표출
      throw new Error(errorText || response.statusText);
    }

    const json = await response.json();
    return json as T;
  }
}
