/**
 * 검색 단계 제외 필터 (서버 전용).
 *
 * 클라이언트에서는 서버 액션 3개(`getSkippedItems`, `getItemStatuses`, `getSkuStatusesBySpuIds`)로
 * 나뉘어 있던 것을 워커에서 service_role로 한 번에 조회한다. Clerk 컨텍스트가 없어도 동작한다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchItem } from "@/lib/search/search-item";
import { getChildSkuIds, getSpuKeyFromItem } from "@/lib/search/search-item";

const IN_CHUNK_SIZE = 120;

export interface ExclusionOptions {
  excludeSkipped: boolean;
  excludeReviewed: boolean;
  /** 손댄 품번 전부 제외 (연속 수집 기본). 옵션 하나라도 해당되면 품번 제외 */
  excludeActed?: boolean;
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
  /** 메모가 있는 SPU */
  memoSpuIds: Set<string>;
  /** 손댄 SKU (메모·수동입찰·재고·알림) */
  actedSkuIds: Set<string>;
  /** 시스템 입찰이 있는 SKU */
  bidSkuIds: Set<string>;
}

const EMPTY_CONTEXT = (): ExclusionContext => ({
  excludedArticles: new Set(),
  skippedSkuIds: new Set(),
  handledSpuIds: new Set(),
  handledSkuIds: new Set(),
  memoSpuIds: new Set(),
  actedSkuIds: new Set(),
  bidSkuIds: new Set(),
});

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function loadExclusionContext(
  supabase: SupabaseClient,
  userId: string,
  options: ExclusionOptions,
  spuIds: string[]
): Promise<ExclusionContext> {
  const ctx = EMPTY_CONTEXT();
  const excludeActed = options.excludeActed === true;
  const loadSkip = options.excludeSkipped || excludeActed;
  const loadStatus = options.excludeReviewed || excludeActed;

  const { data: excluded } = await supabase
    .from("excluded_articles")
    .select("article_number")
    .eq("user_id", userId);
  (excluded ?? []).forEach((row: { article_number: string }) => {
    ctx.excludedArticles.add(row.article_number);
  });

  if (loadSkip) {
    const { data: skipped } = await supabase
      .from("skipped_items")
      .select("sku_id")
      .eq("user_id", userId);
    (skipped ?? []).forEach((row: { sku_id: string }) => {
      ctx.skippedSkuIds.add(String(row.sku_id));
    });
  }

  if (loadStatus && spuIds.length > 0) {
    for (let i = 0; i < spuIds.length; i += IN_CHUNK_SIZE) {
      const chunk = spuIds.slice(i, i + IN_CHUNK_SIZE);
      const numericSpu = chunk.map((id) => Number(id)).filter((id) => !Number.isNaN(id));

      const [{ data: itemRows }, { data: skuRows }, { data: bidRows }] = await Promise.all([
        supabase
          .from("item_status")
          .select("spu_id, handled, memo")
          .eq("user_id", userId)
          .in("spu_id", chunk),
        supabase
          .from("sku_status")
          .select("sku_id, handled, memo, manual_bid_marked, stock_marked, watch_price")
          .eq("user_id", userId)
          .in("spu_id", numericSpu),
        excludeActed && numericSpu.length > 0
          ? supabase
              .from("bid_history")
              .select("sku_id")
              .eq("user_id", userId)
              .in("spu_id", numericSpu)
          : Promise.resolve({ data: [] as { sku_id: string | number }[] }),
      ]);

      (itemRows ?? []).forEach((row: { spu_id: string; handled: boolean; memo: string | null }) => {
        if (row.handled) ctx.handledSpuIds.add(String(row.spu_id));
        if (hasText(row.memo)) ctx.memoSpuIds.add(String(row.spu_id));
      });
      (skuRows ?? []).forEach(
        (row: {
          sku_id: string | number;
          handled: boolean;
          memo: string | null;
          manual_bid_marked: boolean;
          stock_marked: boolean;
          watch_price: number | null;
        }) => {
          const skuKey = String(row.sku_id);
          if (row.handled) ctx.handledSkuIds.add(skuKey);
          if (
            hasText(row.memo) ||
            row.manual_bid_marked ||
            row.stock_marked ||
            row.watch_price != null
          ) {
            ctx.actedSkuIds.add(skuKey);
          }
        }
      );
      (bidRows ?? []).forEach((row: { sku_id: string | number }) => {
        ctx.bidSkuIds.add(String(row.sku_id));
      });
    }
  }

  return ctx;
}

/** 옵션 전체가 스킵된 품번인지 (화면 조회용) */
function isFullySkipped(item: SearchItem, skippedSkuIds: Set<string>): boolean {
  const childSkuIds = getChildSkuIds(item);
  if (childSkuIds.length === 0) return false;
  return childSkuIds.every((id) => skippedSkuIds.has(id));
}

/** SPU 자체가 검토완료거나 전 옵션이 검토완료인지 (화면 조회용) */
function isReviewed(item: SearchItem, ctx: ExclusionContext): boolean {
  const spuKey = getSpuKeyFromItem(item);
  if (!spuKey) return false;
  if (ctx.handledSpuIds.has(spuKey)) return true;

  const childSkuIds = getChildSkuIds(item);
  return childSkuIds.length > 0 && childSkuIds.every((id) => ctx.handledSkuIds.has(id));
}

/** 옵션 하나라도 손댄 흔적이 있으면 품번 제외 (연속 수집) */
export function isActedItem(item: SearchItem, ctx: ExclusionContext): boolean {
  if (ctx.excludedArticles.has(item.articleNumber)) return true;

  const spuKey = getSpuKeyFromItem(item);
  if (spuKey && (ctx.handledSpuIds.has(spuKey) || ctx.memoSpuIds.has(spuKey))) return true;

  const childSkuIds = getChildSkuIds(item);
  if (childSkuIds.length === 0) {
    return false;
  }

  return childSkuIds.some(
    (id) =>
      ctx.skippedSkuIds.has(id) ||
      ctx.handledSkuIds.has(id) ||
      ctx.actedSkuIds.has(id) ||
      ctx.bidSkuIds.has(id)
  );
}

export function isActedSpu(
  spuId: string,
  childSkuIds: string[],
  ctx: ExclusionContext,
  articleNumber?: string | null
): boolean {
  if (articleNumber && ctx.excludedArticles.has(articleNumber)) return true;
  if (ctx.handledSpuIds.has(spuId) || ctx.memoSpuIds.has(spuId)) return true;
  return childSkuIds.some(
    (id) =>
      ctx.skippedSkuIds.has(id) ||
      ctx.handledSkuIds.has(id) ||
      ctx.actedSkuIds.has(id) ||
      ctx.bidSkuIds.has(id)
  );
}

export interface FilterResult {
  items: SearchItem[];
  excludedCount: number;
}

/**
 * 영구 제외 → 배치 내 중복 → 스킵/검토완료/손댄 순으로 걸러낸다.
 */
export function filterItems(
  items: SearchItem[],
  options: ExclusionOptions,
  ctx: ExclusionContext
): FilterResult {
  let excludedCount = 0;
  const seen = new Set<string>();
  const excludeActed = options.excludeActed === true;

  const kept = items.filter((item) => {
    if (ctx.excludedArticles.has(item.articleNumber)) {
      excludedCount += 1;
      return false;
    }

    const key = String(item.id ?? item.articleNumber);
    if (seen.has(key)) return false;
    seen.add(key);

    if (excludeActed) {
      if (isActedItem(item, ctx)) {
        excludedCount += 1;
        return false;
      }
      return true;
    }

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
