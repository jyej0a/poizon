import { OFFER_AVAILABILITY, type OfferAvailability, type SourceOffer } from "@/types/source-offer";

const SOLD_OUT_HINT_TOKENS = new Set(["품절", "재입고알림"]);

export function offerAvailability(soldOut: boolean): OfferAvailability {
  return soldOut ? OFFER_AVAILABILITY.soldOut : OFFER_AVAILABILITY.inStock;
}

export function isSoldOutHintToken(token: string): boolean {
  return SOLD_OUT_HINT_TOKENS.has(token.trim());
}

export function extraAvailabilityHint(hint: string | null | undefined): string | null {
  const parts = (hint ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isSoldOutHintToken(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** 캐시된 payload처럼 `availability`가 없어도 hint의 품절 토큰으로 판정한다. */
export function isSoldOutOffer(
  offer: Pick<SourceOffer, "availability" | "availabilityHint">
): boolean {
  if (offer.availability === "sold_out") return true;
  if (offer.availability === "in_stock") return false;
  return (offer.availabilityHint ?? "").split("·").some((part) => isSoldOutHintToken(part));
}
