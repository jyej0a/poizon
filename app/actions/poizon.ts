"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { PoizonClient } from "@/lib/api/poizon";

/**
 * DB에 저장된 사용자의 Poizon API Key/Secret을 가져와 
 * PoizonClient 인스턴스를 반환하는 공통 유틸리티
 */
async function getPoizonClient() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized: Please log in first.");
  }

  const supabase = getServiceRoleClient();

  // 사용자 정보(users 테이블 조인 혹은 clerk_id 기준 간접 조회)
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    throw new Error("사용자 동기화 정보가 없습니다.");
  }

  const { data: configData, error } = await supabase
    .from("user_configs")
    .select("poizon_app_key, poizon_app_secret")
    .eq("user_id", user.id)
    .single();

  if (error || !configData?.poizon_app_key || !configData?.poizon_app_secret) {
    throw new Error("설정에서 Poizon API Key와 Secret을 먼저 등록해 주세요.");
  }

  return new PoizonClient({
    appKey: configData.poizon_app_key,
    appSecret: configData.poizon_app_secret,
  });
}

/**
 * Poizon 서버에서 상품(Item)을 검색하는 액션
 */
export async function searchPoizonItems(keyword: string) {
  try {
    const client = await getPoizonClient();
    
    // 공식 문서 cURL 기반의 SKU 상세 검색 API 호출
    const response = await client.request(
        "/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-article-number", 
        {
          articleNumber: keyword.trim(), 
          region: "KR",
          sellerStatusEnable: false,
          buyStatusEnable: false
        }
    );

    return { success: true, data: response };
  } catch (error: any) {
    console.error("[searchPoizonItems] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Poizon에서 내 입찰/리스팅 현황을 조회하는 액션
 */
export async function getPoizonListings() {
  try {
    const client = await getPoizonClient();

    // 임시 엔드포인트 명. 실제 문서에 따라 변경 요망.
    const response = await client.request("/listing/my-list", {
      pageNo: 1,
      pageSize: 50,
    });

    return { success: true, data: response };
  } catch (error: any) {
    console.error("Poizon Article Search Action Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Poizon API: 브랜드 명으로 SPU 여러 개(대량) 조회 로직 (2단계 연동)
 */
export async function searchPoizonByBrand(brandName: string) {
  try {
    const client = await getPoizonClient();

    // 1단계: 이름으로 브랜드 ID 조회 (영문, 국문 동시 검색으로 로컬라이제이션 문제 타파)
    const basePayload = {
      name: brandName,
      exactMatch: false,
      pageSize: 5, 
      pageNum: 1,
    };

    const [brandResKo, brandResEn] = await Promise.all([
      client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name", { ...basePayload, language: "ko" }),
      client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name", { ...basePayload, language: "en" })
    ]);
    
    // 구조 파악 방어 코드 (포이즌 API는 data.contents 에 배열을 반환함)
    const extractList = (res: any) => Array.isArray(res?.data?.contents) ? res.data.contents : 
                                     Array.isArray(res?.contents) ? res.contents : 
                                     Array.isArray(res?.data?.list) ? res.data.list : [];
                                     
    const brandListKo = extractList(brandResKo);
    const brandListEn = extractList(brandResEn);
    
    // 두 결과를 합치고 (우선적으로 isShowLogo == 1 인 메인 브랜드를 선별)
    const mergedBrands = [...brandListKo, ...brandListEn];
    
    let brandId = null;
    if (mergedBrands.length > 0) {
      // isShowLogo === 1 이거나 isShow === 1 인 브랜드를 최우선으로 선택
      const bestMatch = mergedBrands.find((b: any) => b.isShowLogo === 1) || 
                        mergedBrands.find((b: any) => b.isShow === 1) || 
                        mergedBrands[0];
      brandId = bestMatch.brandId || bestMatch.id; 
    }

    if (!brandId) {
      return { success: false, error: `'${brandName}' 브랜드의 고유 ID를 찾을 수 없습니다.` };
    }

    // 2단계: 브랜드 ID로 묶음(Batch) 상품 정보 조회
    const spuPayload = {
      brandIdList: [brandId],
      language: "ko",
      region: "KR", // 코오롱 스포츠 등 한국 특화 브랜드/판매망 지원을 위해 KR로 롤백
      pageNum: 1,
      pageSize: 20, 
    };

    const spuRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);

    return { success: true, data: spuRes };
  } catch (error: any) {
    console.error("Poizon Brand Search Action Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Poizon API: SPU별 통계 데이터(최근 30일 판매량, 최소 가격 등) 및 하위 SKU 목록 조회
 * (API 제한: 한 번에 최대 5개의 spuId만 요청 가능)
 */
export async function getSpuStatistics(spuIds: (number | string)[]) {
  try {
    const client = await getPoizonClient();
    
    // Chunk array by 5 (API Limit), 강제로 숫자로 변환
    const numericSpuIds = spuIds.map(id => Number(id)).filter(id => !isNaN(id));
    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < numericSpuIds.length; i += chunkSize) {
      chunks.push(numericSpuIds.slice(i, i + chunkSize));
    }

    const basePayload = {
      sellerStatusEnable: true,
      buyStatusEnable: true,
      region: "KR",
      language: "ko",
      timeZone: "Asia/Seoul",
      statisticsDataQry: {
        salesEnable: true,
        minPriceEnable: true,
        customCodeEnable: true,
        bidStatusEnable: true,
        applySourceEnable: true,
        channelInfoEnable: true,
        forFilingEnable: true
      }
    };

    const promises = chunks.map(async chunk => {
      const skuPromise = client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", {
        ...basePayload,
        spuIds: chunk
      }).catch(err => {
        console.error(`Error fetching SKU stats for chunk ${chunk.join(',')}:`, err);
        return null;
      });

      const spuPromise = client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", {
        ...basePayload,
        spuIds: chunk
      }).catch(err => {
        console.error(`Error fetching SPU stats for chunk ${chunk.join(',')}:`, err);
        return null;
      });

      const [skuRes, spuRes] = await Promise.all([skuPromise, spuPromise]);

      const skuData = Array.isArray(skuRes?.data?.data) ? skuRes.data.data : Array.isArray(skuRes?.data) ? skuRes.data : Array.isArray(skuRes?.contents) ? skuRes.contents : [];
      const spuData = Array.isArray(spuRes?.data?.data) ? spuRes.data.data : Array.isArray(spuRes?.data) ? spuRes.data : Array.isArray(spuRes?.contents) ? spuRes.contents : [];

      const mergedMap = new Map();

      // 우선 SKU 데이터를 기반으로 세팅
      for (const item of skuData) {
        const id = item.spuId || item.spuSaleInfo?.spuId || item.spuInfo?.spuId;
        if (id) mergedMap.set(id, { ...item });
      }

      // SPU 통계 데이터 덮어씌우기 (완전한 통계 객체를 spuSaleInfo에 통째로 보존)
      for (const item of spuData) {
        const id = item.spuId || item.spuSaleInfo?.spuId || item.spuInfo?.spuId;
        if (id) {
          const existing = mergedMap.get(id) || {};
          mergedMap.set(id, {
            ...existing,
            spuSaleInfo: item,
            commoditySales: item.commoditySales || existing.commoditySales,
            minPrice: item.minPrice || existing.minPrice,
            averagePrice: item.averagePrice || existing.averagePrice,
            authPriceVO: item.authPriceVO || existing.authPriceVO,
            authPrice: item.authPrice || existing.authPrice
          });
        }
      }

      return Array.from(mergedMap.values());
    });

    const results = await Promise.all(promises);
    
    // Merge results
    let mergedData: any[] = [];
    for (const res of results) {
      if (!res) continue;
      mergedData = [...mergedData, ...res];
    }

    return { success: true, data: mergedData };
  } catch (error: any) {
    console.error("Poizon SPU Statistics Action Error:", error);
    return { success: false, error: error.message };
  }
}
