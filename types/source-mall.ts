export const SOURCE_MALL_CHECK_STATUSES = ["ok", "empty", "failed"] as const;
export type SourceMallCheckStatus = (typeof SOURCE_MALL_CHECK_STATUSES)[number];

export type SourceMallReliability = "ok" | "limited";

export interface SourceMallRecord {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  last_checked_at: string | null;
  last_check_status: SourceMallCheckStatus | null;
  last_check_message: string | null;
  last_check_offer_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SourceMallView extends SourceMallRecord {
  hasParser: boolean;
  homepage: string | null;
  reliability: SourceMallReliability;
}

export const SOURCE_MALL_CHECK_LABEL: Record<SourceMallCheckStatus, string> = {
  ok: "오퍼 있음",
  empty: "오퍼 없음",
  failed: "실패",
};
