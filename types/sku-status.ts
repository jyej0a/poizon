export interface SkuStatus {
  memo: string | null;
  manualBidMarked: boolean;
  manualBidDate: string | null;
  manualBidAt: string | null;
  stockMarked: boolean;
  stockMarkedDate: string | null;
  stockMarkedAt: string | null;
  handled: boolean;
  handledDate: string | null;
  handledAt: string | null;
  watchPrice: number | null;
  watchAt: string | null;
  updatedAt: string | null;
}

export const EMPTY_SKU_STATUS: SkuStatus = {
  memo: null,
  manualBidMarked: false,
  manualBidDate: null,
  manualBidAt: null,
  stockMarked: false,
  stockMarkedDate: null,
  stockMarkedAt: null,
  handled: false,
  handledDate: null,
  handledAt: null,
  watchPrice: null,
  watchAt: null,
  updatedAt: null,
};
