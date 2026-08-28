/**
 * 수수료 설정. 워커는 server action을 타지 않고 여기서 읽는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/utils/calculate-margin";

export async function loadSystemSettings(supabase: SupabaseClient): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("fee_percentage, min_fee, max_fee, target_margin_rate")
    .single();

  if (error || !data) return { ...DEFAULT_SYSTEM_SETTINGS };

  return {
    fee_percentage: Number(data.fee_percentage),
    min_fee: Number(data.min_fee),
    max_fee: Number(data.max_fee),
    target_margin_rate: Number(data.target_margin_rate ?? DEFAULT_SYSTEM_SETTINGS.target_margin_rate),
  };
}
