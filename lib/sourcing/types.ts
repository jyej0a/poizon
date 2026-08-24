import type { SourceOffer } from "@/types/source-offer";

export interface SourceOfferProviderResult {
  offers: SourceOffer[];
}

export interface SourceOfferProvider {
  key: string;
  label: string;
  fetchOffers(articleNumber: string): Promise<SourceOfferProviderResult>;
}
