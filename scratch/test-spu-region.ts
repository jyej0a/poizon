import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    return encodeURIComponent(str).replace(/%20/g, "+").replace(/[!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  public generateSignature(params: Record<string, any>): string {
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "" && key !== "sign" && key !== "appSecret") {
        if (Array.isArray(value)) {
          filteredParams[key] = value.map(item => typeof item === "object" ? JSON.stringify(item) : String(item)).join(",");
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

  const { data: config } = await supabase.from("user_configs").select("*").limit(1).single();
  const client = new PoizonClient(config.poizon_app_key, config.poizon_app_secret);

  const brandId = 1000444; // 코오롱스포츠

  console.log(`[Testing Brand ID: ${brandId} (코오롱스포츠)]`);

  const testRegions = [
    { language: "ko", region: "KR" },
    { language: "ko", region: "US" },
    { language: "en", region: "GLOBAL" },
    { language: "ko" }, // region 생략
    { language: "en" }
  ];

  for (const params of testRegions) {
    console.log(`\n===================`);
    console.log(`[Testing with Params]: ${JSON.stringify(params)}`);
    
    const spuPayload = {
      brandIdList: [brandId],
      pageNum: 1,
      pageSize: 3,
      ...params
    };

    const spuRes = await client.request("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);
    
    const count = Array.isArray(spuRes?.data?.contents) ? spuRes.data.contents.length : 
                  Array.isArray(spuRes?.contents) ? spuRes.contents.length : 
                  Array.isArray(spuRes?.data?.list) ? spuRes.data.list.length : 0;
                  
    console.log(`-> Results Found: ${count}`);
    if (count > 0) {
        console.log("Success! Found valid payload structure:", params);
    } else {
        console.log("Empty result.", spuRes?.data || spuRes);
    }
  }
}

main().catch(console.error);
