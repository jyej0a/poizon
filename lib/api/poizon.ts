import crypto from "crypto";
import { withRetry } from "@/lib/api/retry";

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
    const url = `${this.baseUrl}${endpoint}`;

    return withRetry(
      async () => {
        const payload: Record<string, any> = {
          app_key: this.appKey,
          timestamp: Date.now(),
          language: "en",
          timeZone: "Asia/Seoul",
          ...(this.accessToken ? { access_token: this.accessToken } : {}),
          ...businessParams,
        };
        payload.sign = this.generateSignature(payload);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25_000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || response.statusText);
        }

        const json = (await response.json()) as any;

        const businessCode = json.code ?? json.status ?? json.status_code;
        if (businessCode !== undefined && businessCode !== 200 && businessCode !== 0) {
          const errorMsg = json.msg || json.message || json.error_msg || "Unknown API Error";
          throw new Error(`Poizon API Error (${businessCode}): ${errorMsg}`);
        }

        return json as T;
      },
      {
        attempts: 3,
        onRetry: (error, attempt, delayMs) => {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`[Poizon] ${endpoint} retry ${attempt} in ${delayMs}ms: ${msg.slice(0, 160)}`);
        },
      }
    );
  }
}
