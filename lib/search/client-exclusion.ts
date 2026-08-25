import { getItemStatuses, type ItemStatus } from "@/app/actions/item-status";
import { getSkuStatusesBySpuIds } from "@/app/actions/sku-status";
import { getSkippedItems } from "@/app/actions/skipped-items";
import { getSpuKeyFromItem, getChildSkuIds, type SearchSkuDetail } from "@/lib/search/search-item";
import type { SkuStatus } from "@/types/sku-status";

export interface SearchExclusionOptions {
  excludeSkipped: boolean;
  excludeReviewed: boolean;
}

export interface SearchExclusionContext {
  skippedSkuIds: Set<string>;
  itemStatuses: Record<string, ItemStatus>;
  skuStatuses: Record<string, SkuStatus>;
}

/** 옵션 전체가 스킵된 품번인지 (검색 단계 제외용) */
export function isSpuFullySkipped(
  item: { skuDetails?: SearchSkuDetail[] },
  skippedSkuIds: Set<string>
): boolean {
  const childSkuIds = getChildSkuIds(item);
  if (childSkuIds.length === 0) return false;
  return childSkuIds.every((id) => skippedSkuIds.has(id));
}

/** SPU 또는 전 옵션이 검토완료인지 (검색 단계 제외용) */
export function isSpuReviewed(
  item: { id?: string | number; skuDetails?: SearchSkuDetail[] },
  itemStatuses: Record<string, ItemStatus>,
  skuStatuses: Record<string, SkuStatus>
): boolean {
  const spuKey = getSpuKeyFromItem(item);
  if (!spuKey) return false;
  const childSkuIds = getChildSkuIds(item);
  const allSkusReviewed =
    childSkuIds.length > 0 && childSkuIds.every((skuId) => !!skuStatuses[skuId]?.handled);
  return !!(itemStatuses[spuKey]?.handled || allSkusReviewed);
}

export async function loadSearchExclusionContext(
  options: SearchExclusionOptions,
  spuIds: string[] = []
): Promise<SearchExclusionContext> {
  if (!options.excludeSkipped && !options.excludeReviewed) {
    return { skippedSkuIds: new Set(), itemStatuses: {}, skuStatuses: {} };
  }

  const [skippedRes, itemStatusRes, skuStatusRes] = await Promise.all([
    options.excludeSkipped
      ? getSkippedItems()
      : Promise.resolve({ success: true, data: [] as { sku_id: string }[] }),
    options.excludeReviewed && spuIds.length > 0
      ? getItemStatuses(spuIds)
      : Promise.resolve({ success: true, data: {} as Record<string, ItemStatus> }),
    options.excludeReviewed && spuIds.length > 0
      ? getSkuStatusesBySpuIds(spuIds)
      : Promise.resolve({ success: true, data: {} as Record<string, SkuStatus> }),
  ]);

  return {
    skippedSkuIds: new Set<string>(
      (skippedRes.success && skippedRes.data ? skippedRes.data : []).map((row: { sku_id: string }) =>
        String(row.sku_id)
      )
    ),
    itemStatuses:
      itemStatusRes.success && itemStatusRes.data ? itemStatusRes.data : ({} as Record<string, ItemStatus>),
    skuStatuses:
      skuStatusRes.success && skuStatusRes.data ? skuStatusRes.data : ({} as Record<string, SkuStatus>),
  };
}

export function filterItemsBySearchExclusion(
  items: any[],
  options: SearchExclusionOptions,
  ctx: SearchExclusionContext
): { items: any[]; excludedCount: number } {
  if (!options.excludeSkipped && !options.excludeReviewed) {
    return { items, excludedCount: 0 };
  }

  let excludedCount = 0;
  const kept = items.filter((item) => {
    if (options.excludeSkipped && isSpuFullySkipped(item, ctx.skippedSkuIds)) {
      excludedCount += 1;
      return false;
    }
    if (options.excludeReviewed && isSpuReviewed(item, ctx.itemStatuses, ctx.skuStatuses)) {
      excludedCount += 1;
      return false;
    }
    return true;
  });

  return { items: kept, excludedCount };
}

export async function applySearchExclusionFilters(
  items: any[],
  options: SearchExclusionOptions
): Promise<{
  items: any[];
  excludedCount: number;
  itemStatuses: Record<string, ItemStatus>;
  skuStatuses: Record<string, SkuStatus>;
  skippedSkuIds: Set<string>;
}> {
  const spuIds = [...new Set(items.map(getSpuKeyFromItem).filter(Boolean))];
  const ctx = await loadSearchExclusionContext(options, spuIds);
  const { items: kept, excludedCount } = filterItemsBySearchExclusion(items, options, ctx);
  return {
    items: kept,
    excludedCount,
    itemStatuses: ctx.itemStatuses,
    skuStatuses: ctx.skuStatuses,
    skippedSkuIds: ctx.skippedSkuIds,
  };
}
