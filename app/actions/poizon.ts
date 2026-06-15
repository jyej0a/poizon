"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { PoizonClient } from "@/lib/api/poizon";

/**
 * DB에 저장된 사용자의 Poizon API Key/Secret을 가져와 
 * PoizonClient 인스턴스를 반환하는 공통 유틸리티
 */
export async function getPoizonClient() {
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
export async function searchPoizonByBrand(brandName: string, pageNum = 1, pageSize = 20) {
  try {
    const client = await getPoizonClient();

    // 1단계: 이름으로 브랜드 ID 조회
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
    
    const extractList = (res: any) => Array.isArray(res?.data?.contents) ? res.data.contents : 
                                     Array.isArray(res?.contents) ? res.contents : 
                                     Array.isArray(res?.data?.list) ? res.data.list : [];
                                     
    const brandListKo = extractList(brandResKo);
    const brandListEn = extractList(brandResEn);
    const mergedBrands = [...brandListKo, ...brandListEn];
    
    let brandId = null;
    if (mergedBrands.length > 0) {
      const bestMatch = mergedBrands.find((b: any) => b.isShowLogo === 1) || 
                        mergedBrands.find((b: any) => b.isShow === 1) || 
                        mergedBrands[0];
      brandId = bestMatch.brandId || bestMatch.id; 
    }

    if (!brandId) {
      console.warn(`[searchPoizonByBrand] No brand ID found for: ${brandName}`);
      return { success: false, error: `'${brandName}' 브랜드의 고유 ID를 찾을 수 없습니다. 명칭을 다시 확인해 주시옵소서.` };
    }

    console.log(`[searchPoizonByBrand] Found brand ID: ${brandId} for keyword: ${brandName}`);

    // 2단계: 브랜드 ID로 묶음(Batch) 상품 정보 조회 (Paging 적용)
    const spuPayload = {
      brandIdList: [brandId],
      language: "ko",
      region: "KR",
      pageNum,
      pageSize, 
    };

    const spuRes = await client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId", spuPayload);

    // 전체 개수(total) 추출 시도
    const total = spuRes?.data?.total || spuRes?.total || 0;
    
    console.log(`[searchPoizonByBrand] SPU lookup count: ${total} results for brandId: ${brandId}`);

    if (total === 0) {
      return { 
        success: true, 
        data: spuRes, 
        total: 0, 
        message: `'${brandName}' 브랜드로 검색된 상품이 없사옵니다. 지역(KR) 혹은 브랜드 명칭을 다시 확인해 보시옵소서.` 
      };
    }

    return { success: true, data: spuRes, total };
  } catch (error: any) {
    console.error("[searchPoizonByBrand] Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Poizon API: SPU별 통계 데이터(최근 30일 판매량, 최소 가격 등) 및 하위 SKU 목록 조회
 * (API 제한: 한 번에 최대 5개의 spuId만 요청 가능)
 * 다중 지역(regions) 조회를 지원하며, 서버 혼잡 방지를 위해 순차적으로 처리함.
 */
export async function getSpuStatistics(spuIds: (number | string)[], regions: string[] = ["KR"], language: string = "ko") {
  try {
    const client = await getPoizonClient();
    const numericSpuIds = spuIds.map(id => Number(id)).filter(id => !isNaN(id));
    if (numericSpuIds.length === 0) return { success: true, data: [] };

    const chunkSize = 5;
    const allResultsByRegion: Record<string, any[]> = {};

    for (const region of regions) {
      const chunks = [];
      for (let i = 0; i < numericSpuIds.length; i += chunkSize) {
        chunks.push(numericSpuIds.slice(i, i + chunkSize));
      }

      const basePayload = {
        sellerStatusEnable: true,
        buyStatusEnable: true,
        region: region,
        language: language,
        timeZone: region === "CN" ? "Asia/Shanghai" : "Asia/Seoul",
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

      const regionPromises = chunks.map(async (chunk, index) => {
        // 지역별 첫 번째 청크가 아니라면 부하 방지를 위해 약간의 지연 추가
        if (index > 0) await new Promise(res => setTimeout(res, 500));

        const skuPromise = client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu", {
          ...basePayload,
          spuIds: chunk
        }).catch(err => {
          console.error(`[${region}] SKU stats error:`, err);
          return null;
        });

        const spuPromise = client.request<any>("/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-spu", {
          ...basePayload,
          spuIds: chunk
        }).catch(err => {
          console.error(`[${region}] SPU stats error:`, err);
          return null;
        });

        const [skuRes, spuRes] = await Promise.all([skuPromise, spuPromise]);
        
        const skuData = Array.isArray(skuRes?.data?.data) ? skuRes.data.data : Array.isArray(skuRes?.data) ? skuRes.data : Array.isArray(skuRes?.contents) ? skuRes.contents : [];
        const spuData = Array.isArray(spuRes?.data?.data) ? spuRes.data.data : Array.isArray(spuRes?.data) ? spuRes.data : Array.isArray(spuRes?.contents) ? spuRes.contents : [];

        const mergedMap = new Map<number, { spuId: number; skuSaleInfos: any[]; [key: string]: any }>();

        const getSpuId = (item: any): number | null => {
          const id = item?.spuId || item?.spuSaleInfo?.spuId || item?.spuInfo?.spuId || item?.goodsId;
          const num = Number(id);
          return id != null && !isNaN(num) ? num : null;
        };

        const getSkuId = (item: any): string | null => {
          const id = item?.skuId || item?.regionSkuId;
          return id != null ? String(id) : null;
        };

        const appendSku = (group: { skuSaleInfos: any[] }, skuItem: any) => {
          const skuId = getSkuId(skuItem);
          if (!skuId) return;
          if (!group.skuSaleInfos.some((s) => getSkuId(s) === skuId)) {
            group.skuSaleInfos.push(skuItem);
          }
        };

        for (const item of skuData) {
          const id = getSpuId(item);
          if (!id) continue;

          const existing = mergedMap.get(id) || { spuId: id, skuSaleInfos: [] };
          const nested = item.skuInfoList || item.skuSaleInfos;
          if (Array.isArray(nested)) {
            nested.forEach((sku) => appendSku(existing, sku));
          } else if (getSkuId(item)) {
            appendSku(existing, item);
          }

          mergedMap.set(id, {
            ...existing,
            ...item,
            skuSaleInfos: existing.skuSaleInfos,
            skuInfoList: existing.skuSaleInfos,
          });
        }

        for (const item of spuData) {
          const id = getSpuId(item);
          if (!id) continue;

          const existing = mergedMap.get(id) || { spuId: id, skuSaleInfos: [] };
          mergedMap.set(id, {
            ...existing,
            spuSaleInfo: item,
            spuInfo: item.spuInfo || existing.spuInfo,
            commoditySales: item.commoditySales || existing.commoditySales,
            minPrice: item.minPrice || existing.minPrice,
            averagePrice: item.averagePrice || existing.averagePrice,
            marketPrice: item.marketPrice || existing.marketPrice,
            skuSaleInfos: existing.skuSaleInfos,
            skuInfoList: existing.skuSaleInfos,
          });
        }
        return Array.from(mergedMap.values());
      });

      const regionResults = await Promise.all(regionPromises);
      allResultsByRegion[region] = regionResults.flat().filter(Boolean);

      // 지역 간 요청 시 부하 방지 지연
      if (regions.length > 1) await new Promise(res => setTimeout(res, 800));
    }

    return { success: true, data: allResultsByRegion };
  } catch (error: any) {
    console.error("Poizon SPU Statistics Action Error:", error);
    return { success: false, error: error.message };
  }
}
