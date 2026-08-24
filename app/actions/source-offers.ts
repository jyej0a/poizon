"use server";

import {
  fetchTopSourceOffers,
  filterOffersByActiveSources,
} from "@/lib/sourcing/source-offers";
import { loadActiveSourceProviders } from "@/lib/sourcing/source-malls";
import { getCachedSourceOffers, setCachedSourceOffers } from "@/lib/search/search-cache";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { SourceOffer } from "@/types/source-offer";

export async function getSourceOffers(
  articleNumber: string
): Promise<{ success: boolean; data?: SourceOffer[]; error?: string }> {
  if (!articleNumber) return { success: false, error: "품번이 없습니다." };

  try {
    const supabase = getServiceRoleClient();
    const providers = await loadActiveSourceProviders();
    const cached = await getCachedSourceOffers(supabase, articleNumber);
    if (cached) {
      return { success: true, data: filterOffersByActiveSources(cached, providers) };
    }

    const result = await fetchTopSourceOffers(articleNumber, { providers });
    if (result.offers.length > 0) {
      await setCachedSourceOffers(supabase, articleNumber, result.offers);
    }
    return { success: true, data: result.offers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
