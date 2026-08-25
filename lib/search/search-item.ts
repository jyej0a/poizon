/**
 * POIZON 검색 응답 → 화면용 아이템 변환 (순수 함수).
 *
 * `search-board.tsx`에 있던 로직을 그대로 옮긴 것으로, 클라이언트와 백그라운드 워커가
 * **같은 코드**를 쓰도록 하기 위해 분리했다. 양쪽에 복제하면 표기 규칙이 갈라진다.
 */

import { formatSalesVolume, getSkuSalesValue } from "@/lib/utils/sales-volume";

export interface SearchSkuDetail {
  skuId?: number | string;
  dwSkuId?: number | string;
  regionSkuId?: number | string;
  image?: string | null;
  logoUrl?: string | null;
  commoditySales?: { globalSoldNum30?: number; localSoldNum30?: number } | null;
  [key: string]: unknown;
}

/** `raw`에서 화면이 실제로 읽는 필드 */
export interface SearchItemRaw {
  /** 입찰 가능 여부. `false`일 때만 입찰 버튼을 잠근다 */
  userCanBidding?: boolean;
  [key: string]: unknown;
}

export interface SearchItem {
  id: string;
  articleNumber: string;
  brand: string;
  category: string;
  title: string;
  image: string | null;
  skus: unknown[];
  raw: SearchItemRaw;
  salesVolume: string;
  localSalesVolume: string;
  minPrice: string;
  avgPrice: string;
  skuDetails: SearchSkuDetail[];
  skuStatsCN: unknown[];
  spuStats: Record<string, unknown>;
}

export function extractSkuListFromStat(statItem: any): any[] {
  if (!statItem) return [];
  if (Array.isArray(statItem)) {
    return statItem.flatMap((item) => extractSkuListFromStat(item));
  }
  const nested = statItem.skuInfoList || statItem.skuSaleInfos;
  if (Array.isArray(nested) && nested.length > 0) return nested;
  if (statItem.skuId || statItem.regionSkuId) return [statItem];
  return [];
}

export function resolveSkuId(
  sku:
    | {
        skuId?: number | string;
        dwSkuId?: number | string;
        regionSkuId?: number | string;
      }
    | null
    | undefined
): string {
  if (!sku) return "";
  const id = sku.skuId ?? sku.dwSkuId ?? sku.regionSkuId;
  if (id == null || id === "") return "";
  return String(id);
}

export function getChildSkuIds(item: { skuDetails?: SearchSkuDetail[] } | null | undefined): string[] {
  const ids = (item?.skuDetails || []).map(resolveSkuId).filter(Boolean);
  return [...new Set(ids)];
}

export function pushSearchItemFromRaw(rawData: unknown, targetArray: SearchItem[], term: string) {
  const item = buildSearchItem(rawData, term);
  if (item) targetArray.push(item);
}

export function getSpuKeyFromItem(item: { id?: string | number }): string {
  return String(item.id ?? "").replace(/[^0-9]/g, "");
}

export function brandItemKey(it: { id?: string | number; articleNumber?: string }): string {
  return String(it.id ?? it.articleNumber);
}

/**
 * `skuList`(기본 정보)와 `skuStats`(통계)를 skuId 기준 union 머지.
 * 어느 한쪽에만 있는 옵션이 누락되지 않도록 한다. (docs/PRD.md 9.1)
 */
export function resolveSkuDetails(rawData: any, skuList: any[]): any[] {
  const fromStats = rawData.skuStats;
  const extracted =
    Array.isArray(fromStats) && fromStats.length > 0
      ? fromStats.flatMap((item: any) => extractSkuListFromStat(item))
      : [];

  if (extracted.length === 0) return skuList;
  if (!Array.isArray(skuList) || skuList.length === 0) return extracted;

  const byId = new Map<string, any>();
  const put = (sku: any) => {
    const id = resolveSkuId(sku);
    if (!id) return;
    const prev = byId.get(id);
    byId.set(
      id,
      prev
        ? {
            ...prev,
            ...sku,
            commoditySales: sku.commoditySales ?? prev.commoditySales,
            image: sku.image || prev.image,
            logoUrl: sku.logoUrl || prev.logoUrl,
          }
        : sku
    );
  };

  skuList.forEach(put);
  extracted.forEach(put);
  return Array.from(byId.values());
}

export function buildStatsMaps(
  statsResKR: { success?: boolean; data?: Record<string, any[]> | any[] },
  statsResCN: { success?: boolean; data?: Record<string, any[]> | any[] }
) {
  const statsMapKR = new Map<number, any>();
  const statsMapCN = new Map<number, any>();

  if (statsResKR.success && statsResKR.data && !Array.isArray(statsResKR.data) && statsResKR.data.KR) {
    for (const st of statsResKR.data.KR) {
      const id = Number(st.spuSaleInfo?.spuId || st.spuInfo?.spuId || st.spuId);
      if (id) statsMapKR.set(id, st);
    }
  }
  if (statsResCN.success && statsResCN.data && !Array.isArray(statsResCN.data) && statsResCN.data.CN) {
    for (const st of statsResCN.data.CN) {
      const id = Number(st.spuSaleInfo?.spuId || st.spuInfo?.spuId || st.spuId);
      if (id) statsMapCN.set(id, st);
    }
  }
  return { statsMapKR, statsMapCN };
}

export function applyStatsToItemData(
  itemData: any,
  statsMapKR: Map<number, any>,
  statsMapCN: Map<number, any>
) {
  const sId = Number(itemData.spuInfo?.spuId || itemData.spuId || itemData.goodsId);
  const stKR = statsMapKR.get(sId);
  const stCN = statsMapCN.get(sId);
  if (stKR) {
    itemData.skuStats = extractSkuListFromStat(stKR);
    itemData.spuStats = stKR.spuSaleInfo || stKR.spuInfo || {};
  }
  if (stCN) {
    itemData.skuStatsCN = extractSkuListFromStat(stCN);
    itemData.spuStatsCN = stCN.spuSaleInfo || stCN.spuInfo || {};
  }
}

export function extractBrandResultsFromResponse(data: any): any[] {
  if (Array.isArray(data?.data?.contents)) return data.data.contents;
  if (Array.isArray(data?.contents)) return data.contents;
  if (Array.isArray(data?.data?.list)) return data.data.list;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatWonAmount(pr: unknown): string {
  if (!pr) return "-";
  if (typeof pr === "string" && pr.includes("₩")) return pr;
  const num = Number(String(pr).replace(/[^0-9]/g, ""));
  return isNaN(num) ? "—" : `₩${num.toLocaleString()}`;
}

/**
 * 원시 응답 1건 → 화면용 아이템. 상품명이 없으면 유효하지 않은 응답으로 보고 `null`.
 */
export function buildSearchItem(rawData: any, term: string): SearchItem | null {
  let apiData = rawData.data || rawData;
  if (Array.isArray(apiData)) apiData = apiData[0] || {};
  const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
  const skuList = apiData.skuInfoList || apiData.skuList || apiData.skus || spuInfo.skuList || [];

  if (!spuInfo?.title && !rawData?.title) return null;

  const articleNum = spuInfo.articleNumber || spuInfo.goodsNo || rawData.articleNumber || term || "N/A";
  const spuIdRaw = spuInfo.spuId || spuInfo.goodsId || rawData.spuId || rawData.goodsId;
  const finalId = spuIdRaw ? String(spuIdRaw) : term;

  const skuStatsCN = rawData.skuStatsCN || [];
  const skusKR = resolveSkuDetails(rawData, skuList);

  const totalSalesValue = skusKR.reduce((sum: number, s: any) => {
    const v = getSkuSalesValue(s, skuStatsCN, "globalSoldNum30");
    return sum + (v ?? 0);
  }, 0);
  const localSalesValue = skusKR.reduce((sum: number, s: any) => {
    const v = getSkuSalesValue(s, skuStatsCN, "localSoldNum30");
    return sum + (v ?? 0);
  }, 0);

  return {
    id: finalId,
    articleNumber: articleNum,
    brand: spuInfo.brandName || spuInfo.brand || "-",
    category:
      spuInfo.level1CategoryName && spuInfo.level2CategoryName
        ? `${spuInfo.level1CategoryName} > ${spuInfo.level2CategoryName}`
        : spuInfo.level2CategoryName || spuInfo.categoryName || "-",
    title: spuInfo.title || spuInfo.spuTitle || spuInfo.goodsName || rawData.title || "Unknown Product",
    image:
      spuInfo.logoUrl || spuInfo.images?.[0] || spuInfo.image || spuInfo.imgUrl || skuList[0]?.image || null,
    skus: skuList,
    raw: rawData,
    salesVolume: formatSalesVolume(totalSalesValue),
    localSalesVolume: formatSalesVolume(localSalesValue),
    minPrice: formatWonAmount(
      rawData.spuStats?.marketPrice?.globalMarketPriceVO?.amountText ??
        rawData.spuStats?.minPrice?.globalMinPriceVO?.amountText ??
        rawData.spuStats?.minPrice?.price ??
        rawData.spuStats?.authPriceVO?.amountText ??
        rawData.spuStats?.authPrice?.amount
    ),
    avgPrice: formatWonAmount(
      rawData.spuStats?.averagePrice?.averagePriceVO?.amountText ??
        rawData.spuStats?.averagePrice?.averagePrice?.amount ??
        rawData.spuStats?.averagePrice?.globalAveragePriceVO?.amountText ??
        rawData.spuStats?.averagePrice?.globalAveragePrice?.amount
    ),
    skuDetails: skusKR
      .map((sk: any) => {
        const resolvedId = resolveSkuId(sk);
        const originalSku = skuList.find((s: any) => resolveSkuId(s) === resolvedId);
        return {
          ...sk,
          skuId: resolvedId || sk.skuId,
          image: originalSku?.image || originalSku?.logoUrl || sk.image || null,
        };
      })
      .filter((sk: any) => resolveSkuId(sk)),
    skuStatsCN,
    spuStats: rawData.spuStats || {},
  };
}

/**
 * DB 적재용 축약.
 *
 * `raw`에는 POIZON 원시 응답 전체가 들어 있어 브랜드 50건이면 payload가 수 MB에 달한다.
 * 통계·SKU 정보는 이미 최상위 필드(`skuDetails`, `skuStatsCN`, `spuStats`)로 복사돼 있으므로
 * `raw`는 화면이 실제로 읽는 필드만 남긴다.
 *
 * **`raw`에서 새 필드를 읽게 되면 여기에도 반드시 추가해야 한다.**
 * 그러지 않으면 실시간 검색 결과와 잡에서 불러온 결과가 조용히 달라진다.
 */
export function toStoredSearchItem(item: SearchItem): SearchItem {
  return {
    ...item,
    raw: { userCanBidding: item.raw?.userCanBidding },
  };
}
