/**
 * 검색 단계 제외 필터 (서버 전용).
 *
 * 클라이언트에서는 서버 액션 3개(`getSkippedItems`, `getItemStatuses`, `getSkuStatusesBySpuIds`)로
 * 나뉘어 있던 것을 워커에서 service_role로 한 번에 조회한다. Clerk 컨텍스트가 없어도 동작한다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchItem, SearchSkuDetail } from "@/lib/search/search-item";
import { getSpuKeyFromItem, resolveSkuId } from "@/lib/search/search-item";

const IN_CHUNK_SIZE = 120;

export interface ExclusionOptions {
  excludeSkipped: boolean;
  excludeReviewed: boolean;
}

export interface ExclusionContext {
  /** 영구 제외 품번 (article_number) */
  excludedArticles: Set<string>;
  /** 스킵 표시된 SKU */
  skippedSkuIds: Set<string>;
  /** 검토완료 처리된 SPU */
  handledSpuIds: Set<string>;
  /** 검토완료 처리된 SKU */
  handledSkuIds: Set<string>;
}

const EMPTY_CONTEXT = (): ExclusionContext => ({
  excludedArticles: new Set(),
  skippedSkuIds: new Set(),
  handledSpuIds: new Set(),
  handledSkuIds: new Set(),
});

function getChildSkuIds(item: { skuDetails?: SearchSkuDetail[] }): string[] {
  const ids = (item.skuDetails || []).map(resolveSkuId).filter(Boolean);
  return [...new Set(ids)];
}

export async function loadExclusionContext(
  supabase: SupabaseClient,
  userId: string,
  options: ExclusionOptions,
  spuIds: string[]
): Promise<ExclusionContext> {
  const ctx = EMPTY_CONTEXT();

  const { data: excluded } = await supabase
    .from("excluded_articles")
    .select("article_number")
    .eq("user_id", userId);
  (excluded ?? []).forEach((row: { article_number: string }) => {
    ctx.excludedArticles.add(row.article_number);
  });

  if (options.excludeSkipped) {
    const { data: skipped } = await supabase
      .from("skipped_items")
      .select("sku_id")
      .eq("user_id", userId);
    (skipped ?? []).forEach((row: { sku_id: string }) => {
      ctx.skippedSkuIds.add(String(row.sku_id));
    });
  }

  if (options.excludeReviewed && spuIds.length > 0) {
    for (let i = 0; i < spuIds.length; i += IN_CHUNK_SIZE) {
      const chunk = spuIds.slice(i, i + IN_CHUNK_SIZE);

      const [{ data: itemRows }, { data: skuRows }] = await Promise.all([
        supabase
          .from("item_status")
          .select("spu_id, handled")
          .eq("user_id", userId)
          .in("spu_id", chunk),
        supabase
          .from("sku_status")
          .select("sku_id, handled")
          .eq("user_id", userId)
          .in("spu_id", chunk.map((id) => Number(id)).filter((id) => !isNaN(id))),
      ]);

      (itemRows ?? []).forEach((row: { spu_id: string; handled: boolean }) => {
        if (row.handled) ctx.handledSpuIds.add(String(row.spu_id));
      });
      (skuRows ?? []).forEach((row: { sku_id: string; handled: boolean }) => {
        if (row.handled) ctx.handledSkuIds.add(String(row.sku_id));
      });
    }
  }

  return ctx;
}

/** 옵션 전체가 스킵된 품번인지 */
function isFullySkipped(item: SearchItem, skippedSkuIds: Set<string>): boolean {
  const childSkuIds = getChildSkuIds(item);
  if (childSkuIds.length === 0) return false;
  return childSkuIds.every((id) => skippedSkuIds.has(id));
}

/** SPU 자체가 검토완료거나 전 옵션이 검토완료인지 */
function isReviewed(item: SearchItem, ctx: ExclusionContext): boolean {
  const spuKey = getSpuKeyFromItem(item);
  if (!spuKey) return false;
  if (ctx.handledSpuIds.has(spuKey)) return true;

  const childSkuIds = getChildSkuIds(item);
  return childSkuIds.length > 0 && childSkuIds.every((id) => ctx.handledSkuIds.has(id));
}

export interface FilterResult {
  items: SearchItem[];
  excludedCount: number;
}

/**
 * 영구 제외 → 배치 내 중복 → 스킵/검토완료 순으로 걸러낸다.
 * (기존 `handleSearch`와 동일한 순서)
 */
export function filterItems(
  items: SearchItem[],
  options: ExclusionOptions,
  ctx: ExclusionContext
): FilterResult {
  let excludedCount = 0;
  const seen = new Set<string>();

  const kept = items.filter((item) => {
    if (ctx.excludedArticles.has(item.articleNumber)) {
      excludedCount += 1;
      return false;
    }

    // 콤마 입력 중복 등 배치 내 중복 제거 (제외 건수에는 포함하지 않음)
    const key = String(item.id ?? item.articleNumber);
    if (seen.has(key)) return false;
    seen.add(key);

    if (options.excludeSkipped && isFullySkipped(item, ctx.skippedSkuIds)) {
      excludedCount += 1;
      return false;
    }
    if (options.excludeReviewed && isReviewed(item, ctx)) {
      excludedCount += 1;
      return false;
    }
    return true;
  });

  return { items: kept, excludedCount };
}
