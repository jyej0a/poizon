import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  SOURCE_MALL_DEFINITIONS,
  getProviderByKey,
  listRegisteredProviders,
} from "@/lib/sourcing/registry";
import { matchesArticleNumber, normalizeArticleNumber } from "@/lib/sourcing/utils";
import type { SourceOfferProvider } from "@/lib/sourcing/types";
import type {
  SourceMallCheckStatus,
  SourceMallRecord,
  SourceMallView,
} from "@/types/source-mall";

function nowIso(): string {
  return new Date().toISOString();
}

function toRecord(row: SourceMallRecord): SourceMallRecord {
  return {
    ...row,
    last_check_status: row.last_check_status ?? null,
  };
}

function toView(row: SourceMallRecord): SourceMallView {
  const definition = SOURCE_MALL_DEFINITIONS.find((item) => item.provider.key === row.key);
  return {
    ...toRecord(row),
    hasParser: Boolean(definition),
    homepage: definition?.homepage ?? null,
    reliability: definition?.reliability ?? "limited",
  };
}

async function selectSourceMalls(): Promise<SourceMallRecord[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("source_malls")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SourceMallRecord[];
}

/**
 * 코드 레지스트리에만 있는 몰을 DB에 보강한 뒤 대시보드용 목록을 반환한다.
 */
export async function syncSourceMalls(): Promise<SourceMallView[]> {
  const rows = await selectSourceMalls();
  const existing = new Set(rows.map((row) => row.key));
  const missing = SOURCE_MALL_DEFINITIONS.filter(
    (definition) => !existing.has(definition.provider.key)
  );

  if (missing.length > 0) {
    const supabase = getServiceRoleClient();
    const maxOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), 0);
    const { error } = await supabase.from("source_malls").insert(
      missing.map((definition, index) => ({
        key: definition.provider.key,
        label: definition.provider.label,
        is_active: true,
        sort_order: maxOrder + (index + 1) * 10,
        notes: definition.notes,
      }))
    );
    if (error) throw error;
    return (await selectSourceMalls()).map(toView);
  }

  return rows.map(toView);
}

/**
 * 원가 수집에 사용할 활성 파서.
 * 테이블이 비어 있으면 레지스트리 전체를 쓰고, 행은 있는데 모두 꺼져 있으면 빈 배열을 반환한다.
 */
export async function loadActiveSourceProviders(): Promise<SourceOfferProvider[]> {
  const registered = listRegisteredProviders();

  try {
    const rows = await selectSourceMalls();
    if (rows.length === 0) return registered;

    const byKey = new Map(registered.map((provider) => [provider.key, provider]));
    return rows
      .filter((row) => row.is_active)
      .map((row) => byKey.get(row.key))
      .filter((provider): provider is SourceOfferProvider => Boolean(provider));
  } catch (error) {
    console.warn("[source-malls] 활성 몰 조회 실패, 전체 파서를 사용합니다.", error);
    return registered;
  }
}

export async function setSourceMallActive(key: string, isActive: boolean): Promise<void> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("source_malls")
    .update({ is_active: isActive, updated_at: nowIso() })
    .eq("key", key)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("등록되지 않은 수집 몰입니다.");
}

export async function reorderSourceMalls(key: string, direction: "up" | "down"): Promise<void> {
  const rows = await selectSourceMalls();
  const index = rows.findIndex((row) => row.key === key);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= rows.length) return;

  const next = [...rows];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];

  const supabase = getServiceRoleClient();
  const now = nowIso();
  for (let i = 0; i < next.length; i += 1) {
    const { error } = await supabase
      .from("source_malls")
      .update({ sort_order: (i + 1) * 10, updated_at: now })
      .eq("key", next[i].key);
    if (error) throw error;
  }
}

export interface SourceMallProbeResult {
  key: string;
  status: SourceMallCheckStatus;
  message: string;
  offerCount: number;
  lowestPrice: number | null;
  elapsedMs: number;
}

export async function probeSourceMall(
  key: string,
  articleNumber: string
): Promise<SourceMallProbeResult> {
  const provider = getProviderByKey(key);
  if (!provider) {
    throw new Error("파서가 없는 몰은 점검할 수 없습니다.");
  }

  const normalized = normalizeArticleNumber(articleNumber);
  if (!normalized || normalized === "N/A") {
    throw new Error("점검할 품번을 입력하세요.");
  }

  const started = Date.now();
  let status: SourceMallCheckStatus;
  let message: string;
  let offerCount = 0;
  let lowestPrice: number | null = null;

  try {
    const result = await provider.fetchOffers(normalized);
    const matched = result.offers.filter(
      (offer) =>
        matchesArticleNumber(offer.title, normalized) ||
        matchesArticleNumber(offer.link, normalized)
    );
    offerCount = matched.length;
    lowestPrice = matched.length > 0 ? Math.min(...matched.map((offer) => offer.price)) : null;
    status = matched.length > 0 ? "ok" : "empty";
    message =
      matched.length > 0
        ? `${matched.length}건 · 최저 ₩${lowestPrice?.toLocaleString()}`
        : "품번 일치 오퍼 없음";
  } catch (error) {
    status = "failed";
    message = error instanceof Error ? error.message : String(error);
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("source_malls")
    .update({
      last_checked_at: nowIso(),
      last_check_status: status,
      last_check_message: message,
      last_check_offer_count: offerCount,
      updated_at: nowIso(),
    })
    .eq("key", key);

  if (error) throw error;

  return {
    key,
    status,
    message,
    offerCount,
    lowestPrice,
    elapsedMs: Date.now() - started,
  };
}

export async function clearSourceOfferCache(): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("source_offer_cache")
    .delete()
    .gte("article_number", "")
    .select("article_number");

  if (error) throw error;
  return data?.length ?? 0;
}
