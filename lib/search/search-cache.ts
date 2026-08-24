import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceOffer } from "@/types/source-offer";

const SOURCE_OFFER_TTL_MS = 60 * 60 * 1000;
const POIZON_SPU_TTL_MS = 6 * 60 * 60 * 1000;

function nextExpiry(ttlMs: number): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

export async function getCachedSourceOffers(
  supabase: SupabaseClient,
  articleNumber: string
): Promise<SourceOffer[] | null> {
  const { data, error } = await supabase
    .from("source_offer_cache")
    .select("offers, expires_at")
    .eq("article_number", articleNumber)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return Array.isArray(data.offers) ? (data.offers as SourceOffer[]) : null;
}

export async function setCachedSourceOffers(
  supabase: SupabaseClient,
  articleNumber: string,
  offers: SourceOffer[]
): Promise<void> {
  const { error } = await supabase.from("source_offer_cache").upsert({
    article_number: articleNumber,
    offers,
    fetched_at: new Date().toISOString(),
    expires_at: nextExpiry(SOURCE_OFFER_TTL_MS),
  });

  if (error) throw error;
}

export async function getCachedSpuStats(
  supabase: SupabaseClient,
  spuIds: (number | string)[],
  region: string
): Promise<{ hits: Record<string, any[]>; missing: string[] }> {
  const normalizedIds = [...new Set(spuIds.map((id) => String(id)).filter(Boolean))];
  if (normalizedIds.length === 0) return { hits: {}, missing: [] };

  const { data, error } = await supabase
    .from("poizon_spu_cache")
    .select("spu_id, payload")
    .eq("region", region)
    .in("spu_id", normalizedIds)
    .gt("expires_at", new Date().toISOString());

  if (error) throw error;

  const hits: Record<string, any[]> = {};
  for (const row of data ?? []) {
    hits[String(row.spu_id)] = Array.isArray(row.payload) ? row.payload : [];
  }

  const missing = normalizedIds.filter((id) => !(id in hits));
  return { hits, missing };
}

export async function setCachedSpuStats(
  supabase: SupabaseClient,
  region: string,
  statsBySpu: Record<string, any[]>
): Promise<void> {
  const rows = Object.entries(statsBySpu).map(([spuId, payload]) => ({
    spu_id: spuId,
    region,
    payload,
    fetched_at: new Date().toISOString(),
    expires_at: nextExpiry(POIZON_SPU_TTL_MS),
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("poizon_spu_cache")
    .upsert(rows, { onConflict: "spu_id,region" });

  if (error) throw error;
}
