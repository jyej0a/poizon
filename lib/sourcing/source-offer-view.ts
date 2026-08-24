import type { SourceOffer } from "@/types/source-offer";

export function getBestSourceOffer(
  offers: Record<string, SourceOffer[]>,
  articleNumber: string | null | undefined
): SourceOffer | null {
  if (!articleNumber) return null;
  const list = offers[articleNumber];
  return list && list.length > 0 ? list[0] : null;
}

export function getBestSourceOfferPrice(
  offers: Record<string, SourceOffer[]>,
  articleNumber: string | null | undefined
): number | null {
  const best = getBestSourceOffer(offers, articleNumber);
  return best ? best.price : null;
}
