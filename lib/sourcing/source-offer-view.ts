import { isSoldOutOffer } from "@/lib/sourcing/availability";
import type { SourceOffer } from "@/types/source-offer";

/** 살 수 있는 오퍼 중 최저가. 품절만 있으면 null. */
export function getBestSourceOffer(
  offers: Record<string, SourceOffer[]>,
  articleNumber: string | null | undefined
): SourceOffer | null {
  if (!articleNumber) return null;
  const list = offers[articleNumber];
  if (!list || list.length === 0) return null;
  return list.find((offer) => !isSoldOutOffer(offer)) ?? null;
}

export function getBestSourceOfferPrice(
  offers: Record<string, SourceOffer[]>,
  articleNumber: string | null | undefined
): number | null {
  const best = getBestSourceOffer(offers, articleNumber);
  return best ? best.price : null;
}
