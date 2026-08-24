"use server";

import { getPoizonContext } from "@/lib/api/poizon-context";
import {
  fetchBrandSpus,
  fetchItemByArticleNumber,
  fetchSpuStatistics,
} from "@/lib/api/poizon-search";

/**
 * DB에 저장된 사용자의 Poizon API Key/Secret을 가져와
 * PoizonClient 인스턴스를 반환하는 공통 유틸리티
 */
export async function getPoizonClient() {
  const { client } = await getPoizonContext();
  return client;
}

/**
 * Poizon 서버에서 상품(Item)을 검색하는 액션
 */
export async function searchPoizonItems(keyword: string) {
  try {
    const client = await getPoizonClient();
    const response = await fetchItemByArticleNumber(client, keyword);

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
export async function searchPoizonByBrand(brandName: string, pageNum = 1, pageSize = 20, knownBrandId?: number | string | null) {
  try {
    const client = await getPoizonClient();
    const { data, total, brandId } = await fetchBrandSpus(
      client,
      brandName,
      pageNum,
      pageSize,
      knownBrandId
    );

    if (total === 0) {
      return {
        success: true,
        data,
        total: 0,
        brandId,
        message: `'${brandName}' 브랜드로 검색된 상품이 없습니다. 지역(KR) 혹은 브랜드 명칭을 다시 확인해 주세요.`,
      };
    }

    return { success: true, data, total, brandId };
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
export async function getSpuStatistics(
  spuIds: (number | string)[],
  regions: string[] = ["KR"],
  language: string = "ko"
) {
  try {
    const client = await getPoizonClient();
    const data = await fetchSpuStatistics(client, spuIds, regions, { language });
    return { success: true, data };
  } catch (error: any) {
    console.error("Poizon SPU Statistics Action Error:", error);
    return { success: false, error: error.message };
  }
}
