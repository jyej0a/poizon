import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// PoizonClient 간소화 버전 (서명 로직만 포함)
class PoizonClient {
  private appKey: string;
  private appSecret: string;
  private baseUrl: string;

  constructor(appKey: string, appSecret: string) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.baseUrl = "https://open.poizon.com";
  }

  private javaUrlEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/%20/g, "+")
      .replace(/[!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  public generateSignature(params: Record<string, any>): string {
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "" && key !== "sign" && key !== "appSecret") {
        if (Array.isArray(value)) {
          filteredParams[key] = value.map(item => 
            typeof item === "object" ? JSON.stringify(item) : String(item)
          ).join(",");
        } 
        else if (typeof value === "object") {
          filteredParams[key] = JSON.stringify(value);
        } else {
          filteredParams[key] = String(value);
        }
      }
    }
    const sortedKeys = Object.keys(filteredParams).sort();
    const queryParts: string[] = [];
    for (const key of sortedKeys) {
      queryParts.push(`${this.javaUrlEncode(key)}=${this.javaUrlEncode(filteredParams[key])}`);
    }
    const stringToSign = queryParts.join("&") + this.appSecret;
    return crypto.createHash("md5").update(stringToSign, "utf8").digest("hex").toUpperCase();
  }

  public async request<T = any>(endpoint: string, businessParams: Record<string, any> = {}): Promise<T> {
    const payload: Record<string, any> = {
      app_key: this.appKey,
      timestamp: Date.now(),
      v: "1.0", // 문서 기본 규격 재추가
      language: "en",
      timeZone: "Asia/Seoul",
      ...businessParams,
    };
    payload.sign = this.generateSignature(payload);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching user config...");
  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  
  if (!config) {
    console.error("No config found in DB.");
    return;
  }

  const client = new PoizonClient(config.poizon_app_key, config.poizon_app_secret);

  const testBrands = [{name: "Nike", lang: "en"}, {name: "Nike", lang: "ko"}, {name: "코오롱", lang: "en"}, {name: "코오롱", lang: "ko"}];

  for (const brand of testBrands) {
    console.log(`\n===================`);
    console.log(`[Testing Brand (lang: ${brand.lang})]: ${brand.name}`);
    
    // 1. 브랜드 검색
    const brandRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name", {
      name: brand.name,
      language: brand.lang,
      exactMatch: false,
      pageSize: 5,
      pageNum: 1
    });

    // 구조 파싱
    const brandList = Array.isArray(brandRes?.data?.list) ? brandRes.data.list : 
                      Array.isArray(brandRes?.list) ? brandRes.list : 
                      Array.isArray(brandRes?.data) ? brandRes.data : [];
    
    if (brandList.length > 0) {
      const brandId = brandList[0].brandId || brandList[0].id;
      console.log(`-> Extracted Brand ID: ${brandId}`);

      // 2. SPU 정보 조회 (KR)
      const spuRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", {
        brandIdList: [brandId],
        language: "en",
        region: "KR",
        pageNum: 1,
        pageSize: 1
      });
      console.log(`[SPU Response for ${brand.name} (brandId: ${brandId})]:`);
      console.log(JSON.stringify(spuRes, null, 2).substring(0, 500) + "...\n");
    } else {
      console.log(`-> NO Brand ID found for ${brand.name}`);
      console.log(JSON.stringify(brandRes, null, 2).substring(0, 300));
    }
  }
}

main().catch(console.error);
