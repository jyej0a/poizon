import { formatBidDate } from "@/lib/utils/poizon-listing";
import type { SkuStatus } from "@/types/sku-status";

export type ActivityType =
  | "bid_system"
  | "bid_manual"
  | "stock"
  | "review"
  | "skip"
  | "memo"
  | "spu_review";

export interface SkuActivity {
  type: ActivityType;
  label: string;
  at: string;
  formattedDate: string;
}

interface SkuActivityInput {
  skuStatus?: SkuStatus;
  bidCreatedAt?: string | null;
  skippedAt?: string | null;
}

function toActivity(type: ActivityType, label: string, at: string | null | undefined): SkuActivity | null {
  if (!at) return null;
  const d = new Date(at);
  if (isNaN(d.getTime())) return null;
  return { type, label, at, formattedDate: formatBidDate(at) };
}

export function getSkuLastActivity(input: SkuActivityInput): SkuActivity | null {
  const { skuStatus, bidCreatedAt, skippedAt } = input;
  const candidates: SkuActivity[] = [];

  const bid = toActivity("bid_system", "시스템 입찰", bidCreatedAt);
  if (bid) candidates.push(bid);

  if (skuStatus?.manualBidMarked && skuStatus.manualBidAt) {
    const m = toActivity("bid_manual", "수동 입찰 표기", skuStatus.manualBidAt);
    if (m) candidates.push(m);
  }

  if (skuStatus?.stockMarked && skuStatus.stockMarkedAt) {
    const s = toActivity("stock", "재고 보유 표기", skuStatus.stockMarkedAt);
    if (s) candidates.push(s);
  }

  if (skuStatus?.handled && skuStatus.handledAt) {
    const r = toActivity("review", "검토완료", skuStatus.handledAt);
    if (r) candidates.push(r);
  }

  const skip = toActivity("skip", "스킵", skippedAt);
  if (skip) candidates.push(skip);

  if (skuStatus?.memo && skuStatus.updatedAt) {
    const memo = toActivity("memo", "메모", skuStatus.updatedAt);
    if (memo) candidates.push(memo);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return candidates[0];
}

export function formatActivityLine(activity: SkuActivity | null): string | null {
  if (!activity) return null;
  return `최종 · ${activity.formattedDate} · ${activity.label}`;
}

export function getSpuLastActivity(
  childActivities: (SkuActivity | null)[],
  spuUpdatedAt?: string | null,
  spuHandled?: boolean
): SkuActivity | null {
  const candidates = childActivities.filter((a): a is SkuActivity => !!a);

  if (spuHandled && spuUpdatedAt) {
    const spu = toActivity("spu_review", "품번 검토완료", spuUpdatedAt);
    if (spu) candidates.push(spu);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return candidates[0];
}
