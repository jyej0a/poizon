/**
 * POIZON 검색/통계 호출부. `PoizonClient`를 인자로 받으므로
 * 서버 액션(요청당 1회 자격증명 로드)과 백그라운드 워커(잡당 1회 로드)가 동일 코드를 공유한다.
 *
 * 기존에는 이 로직이 `app/actions/poizon.ts`에만 있어 액션 호출마다 자격증명을 재조회했다.
 */

import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { withRetry } from "@/lib/api/retry";
import { pickBestBrandMatch, type BrandNameRow } from "@/lib/search/brand-match";

const ARTICLE_ENDPOINT =
  "/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-article-number";
const BRAND_BY_NAME_ENDPOINT = "/dop/api/v1/pop/api/v1/intl-commodity/intl/brand/page/by-name";
const SPU_BY_BRAND_ENDPOINT =
  "/dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId";

export interface RetryReporter {
  onRetry?: (context: string, error: unknown, attempt: number, delayMs: number) => void;
}

function retryOpts(context: string, reporter?: RetryReporter) {
  return {
    onRetry: (error: unknown, attempt: number, delayMs: number) =>
      reporter?.onRetry?.(context, error, attempt, delayMs),
  };
}

/** 품번(article number)으로 상품 1건 조회 */
export async function fetchItemByArticleNumber(
  client: PoizonClient,
  keyword: string,
  reporter?: RetryReporter
) {
  return withRetry(
    () =>
      client.request<any>(ARTICLE_ENDPOINT, {
        articleNumber: keyword.trim(),
        region: "KR",
        sellerStatusEnable: false,
        buyStatusEnable: false,
      }),
    retryOpts(`품번 조회 ${keyword}`, reporter)
  );
}

export interface BrandSpuResult {
  data: any;
  total: number;
  brandId: number | string | null;
}

/** 브랜드명 → 브랜드 ID → SPU 목록 (2단계) */
export async function fetchBrandSpus(
  client: PoizonClient,
  brandName: string,
  pageNum = 1,
  pageSize = 20,
  knownBrandId?: number | string | null,
  reporter?: RetryReporter
): Promise<BrandSpuResult> {
  let brandId: number | string | null = knownBrandId ?? null;

  // 이미 브랜드 ID를 알고 있으면 조회를 생략한다 (호출 절감)
  if (!brandId) {
    const basePayload = { name: brandName, exactMatch: false, pageSize: 20, pageNum: 1 };

    const [brandResKo, brandResEn] = await Promise.all([
      withRetry(
        () => client.request<any>(BRAND_BY_NAME_ENDPOINT, { ...basePayload, language: "ko" }),
        retryOpts(`브랜드 조회(ko) ${brandName}`, reporter)
      ),
      withRetry(
        () => client.request<any>(BRAND_BY_NAME_ENDPOINT, { ...basePayload, language: "en" }),
        retryOpts(`브랜드 조회(en) ${brandName}`, reporter)
      ),
    ]);

    const extractList = (res: any): BrandNameRow[] =>
      Array.isArray(res?.data?.contents)
        ? res.data.contents
        : Array.isArray(res?.contents)
          ? res.contents
          : Array.isArray(res?.data?.list)
            ? res.data.list
            : [];

    const mergedBrands = [...extractList(brandResKo), ...extractList(brandResEn)];
    const bestMatch = pickBestBrandMatch(brandName, mergedBrands);
    if (bestMatch) {
      brandId = bestMatch.brandId || bestMatch.id || null;
    }
  }

  if (!brandId) {
    throw new Error(
      `'${brandName}' 브랜드의 고유 ID를 찾을 수 없습니다. 명칭을 다시 확인해 주세요.`
    );
  }

  const spuRes = await withRetry(
    () =>
      client.request<any>(SPU_BY_BRAND_ENDPOINT, {
        brandIdList: [brandId],
        language: "ko",
        region: "KR",
        pageNum,
        pageSize,
      }),
    retryOpts(`브랜드 SPU 조회 ${brandName} p${pageNum}`, reporter)
  );

  return {
    data: spuRes,
    total: spuRes?.data?.total || spuRes?.total || 0,
    brandId,
  };
}

function buildStatsPayload(region: string, language: string) {
  return {
    sellerStatusEnable: true,
    buyStatusEnable: true,
    region,
    language,
    timeZone: region === "CN" ? "Asia/Shanghai" : "Asia/Seoul",
    statisticsDataQry: {
      salesEnable: true,
      minPriceEnable: true,
      customCodeEnable: true,
      bidStatusEnable: true,
      applySourceEnable: true,
      channelInfoEnable: true,
      forFilingEnable: true,
    },
  };
}

const asArray = (res: any): any[] =>
  Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.contents)
        ? res.contents
        : [];

export interface SpuStatisticsOptions {
  /** 청크 간 시작 지연(ms). 0이면 지연 없음 */
  chunkStaggerMs?: number;
  /** 동시에 진행할 청크 수 */
  chunkConcurrency?: number;
  language?: string;
  reporter?: RetryReporter;
  /**
   * 청크 단위 실패 통지. 청크가 많으면 같은 오류가 수십 번 반복되므로
   * 호출부가 집계/중복 제거할 수 있게 위임한다. 미지정 시 콘솔에 출력한다.
   */
  onChunkError?: (context: string, error: unknown) => void;
}

/**
 * SPU별 통계 + 하위 SKU 목록. API 제한으로 SPU는 5개씩 청크로 나눈다.
 *
 * 청크 내부는 `SPU → (globalSpuId 확보 시) SKU by-global-spu → 실패 시 by-spu` 순서가
 * 데이터 의존성 때문에 순차일 수밖에 없다. 대신 청크 간 병렬도를 조절한다.
 */
export async function fetchSpuStatistics(
  client: PoizonClient,
  spuIds: (number | string)[],
  regions: string[] = ["KR"],
  options: SpuStatisticsOptions = {}
): Promise<Record<string, any[]>> {
  const {
    chunkStaggerMs = 400,
    // KR·CN을 동시에 조회하므로 실효 동시성은 이 값의 2배가 된다
    chunkConcurrency = 3,
    language = "ko",
    reporter,
    onChunkError = (context, error) =>
      console.error(`${context}:`, error instanceof Error ? error.message : error),
  } = options;

  const numericSpuIds = spuIds.map((id) => Number(id)).filter((id) => !isNaN(id));
  const resultsByRegion: Record<string, any[]> = {};
  if (numericSpuIds.length === 0) return resultsByRegion;

  const chunkSize = 5;
  const chunks: number[][] = [];
  for (let i = 0; i < numericSpuIds.length; i += chunkSize) {
    chunks.push(numericSpuIds.slice(i, i + chunkSize));
  }

  for (const region of regions) {
    const basePayload = buildStatsPayload(region, language);

    const runChunk = async (chunk: number[], index: number) => {
      // 같은 윈도에서 동시에 출발하는 요청을 시간축으로 흩는다.
      // 기존 구현은 첫 청크 외 전부가 동일하게 500ms만 기다려 결국 한꺼번에 터졌고,
      // 30건 검색에서 POIZON 호출 빈도 제한(400010007)이 실제로 발생했다.
      const slot = index % chunkConcurrency;
      if (chunkStaggerMs > 0 && slot > 0) {
        await new Promise((res) => setTimeout(res, chunkStaggerMs * slot));
      }

      const spuRes = await withRetry(
        () => client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SPU_BY_SPU, { ...basePayload, spuIds: chunk }),
        retryOpts(`[${region}] SPU 통계`, reporter)
      ).catch((err) => {
        onChunkError(`[${region}] SPU 통계 조회 실패`, err);
        return null;
      });

      const spuData = asArray(spuRes);

      const globalSpuIdByDwId = new Map<number, number>();
      for (const item of spuData) {
        const dwId = Number(item?.spuId ?? item?.spuInfo?.spuId);
        const globalId = Number(item?.globalSpuId ?? item?.spuInfo?.globalSpuId);
        if (!Number.isNaN(dwId) && !Number.isNaN(globalId) && globalId > 0) {
          globalSpuIdByDwId.set(dwId, globalId);
        }
      }

      const globalSpuIds = chunk
        .map((id) => globalSpuIdByDwId.get(Number(id)))
        .filter((id): id is number => id != null && id > 0);

      let skuRes: any = null;
      // 판매자센터와 근접한 수치를 주는 by-global-spu를 우선 시도 (docs/PRD.md 9.1)
      if (globalSpuIds.length === chunk.length) {
        skuRes = await withRetry(
          () =>
            client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SKU_BY_GLOBAL_SPU, {
              ...basePayload,
              globalSpuIds,
            }),
          retryOpts(`[${region}] SKU by-global-spu`, reporter)
          // 실패 시 아래 by-spu로 폴백하는 설계이므로 로그를 남기지 않는다
        ).catch(() => null);
      }

      if (!skuRes?.data) {
        skuRes = await withRetry(
          () =>
            client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SKU_BY_SPU, { ...basePayload, spuIds: chunk }),
          retryOpts(`[${region}] SKU by-spu`, reporter)
        ).catch((err) => {
          onChunkError(`[${region}] SKU 통계 조회 실패`, err);
          return null;
        });
      }

      const skuData = asArray(skuRes);
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
          nested.forEach((sku: any) => appendSku(existing, sku));
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
    };

    const collected: any[][] = [];
    for (let i = 0; i < chunks.length; i += chunkConcurrency) {
      const window = chunks.slice(i, i + chunkConcurrency);
      const settled = await Promise.all(window.map((chunk, idx) => runChunk(chunk, i + idx)));
      collected.push(...settled);
    }

    resultsByRegion[region] = collected.flat().filter(Boolean);

    if (regions.length > 1) await new Promise((res) => setTimeout(res, 800));
  }

  return resultsByRegion;
}
