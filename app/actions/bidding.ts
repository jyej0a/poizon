"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { getPoizonContext } from "@/lib/api/poizon-context";
import {
  fetchActiveListingsBySkuIdsSafe,
  fetchListingByBiddingNo,
  formatBidDate,
  type ParsedListingItem,
} from "@/lib/utils/poizon-listing";
import { TRADE_STATUS } from "@/types/poizon-listing";

export interface BidPayload {
  skuId: string | number;
  spuId?: string | number;
  price: number;
  sellerBiddingNo?: string;
  sizeInfo?: string;
  /** submit-bid DW skuId. 없으면 `skuId`를 그대로 보냄 */
  apiSkuId?: number;
  globalSkuId?: number;
}

export interface ExistingBidInfo {
  skuId: number;
  spuId?: number;
  sizeInfo?: string;
  bidPrice: number;
  bidDate: string;
  quantity?: number;
  sellerBiddingNo?: string;
  source: "poizon" | "local";
}

export interface BidResult {
  skuId: string | number;
  success: boolean;
  alreadyListed?: boolean;
  needsDuplicateConfirm?: boolean;
  existingBid?: ExistingBidInfo;
  message?: string;
  data?: unknown;
}

export type ExecuteBiddingMode = "normal" | "forceRetry" | "updatePrice";

export interface ExecuteBiddingOptions {
  mode?: ExecuteBiddingMode;
}

async function getBiddingContext() {
  const { userId, client } = await getPoizonContext();
  return { supabase: getServiceRoleClient(), user: { id: userId }, client };
}

function isDuplicateListingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes(String(POIZON_CONSTANTS.ERROR_CODES.DUPLICATE_LISTING)) ||
    msg.includes("Same listing already exists")
  );
}

function listingToExistingBid(listing: ParsedListingItem): ExistingBidInfo {
  return {
    skuId: listing.skuId,
    spuId: listing.spuId || undefined,
    sizeInfo: listing.sizeInfo || undefined,
    bidPrice: listing.price,
    bidDate: formatBidDate(listing.createdAt),
    quantity: listing.quantity,
    sellerBiddingNo: listing.sellerBiddingNo || undefined,
    source: "poizon",
  };
}

function localRowToExistingBid(row: any): ExistingBidInfo {
  return {
    skuId: Number(row.sku_id),
    spuId: row.spu_id ? Number(row.spu_id) : undefined,
    sizeInfo: row.size_info || undefined,
    bidPrice: Number(row.bid_price),
    bidDate: formatBidDate(row.created_at),
    sellerBiddingNo: row.seller_bidding_no || undefined,
    source: "local",
  };
}

async function saveBidToLocalDb(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userInternalId: string,
  bid: BidPayload,
  opts: {
    sellerBiddingNo?: string;
    bidPrice: number;
    spuId?: number | null;
    sizeInfo?: string;
  }
) {
  const skuId = Number(bid.skuId);
  const spuId = opts.spuId ?? (bid.spuId ? Number(bid.spuId) : null);

  await supabase.from("bid_history").insert({
    user_id: userInternalId,
    sku_id: skuId,
    spu_id: spuId,
    bid_price: opts.bidPrice,
    seller_bidding_no: opts.sellerBiddingNo || "",
    size_info: opts.sizeInfo ?? bid.sizeInfo ?? null,
    status: "active",
    bid_type: "manual",
  });

  const now = new Date().toISOString();
  await supabase.from("sku_status").upsert(
    [
      {
        user_id: userInternalId,
        sku_id: skuId,
        spu_id: spuId,
        handled: true,
        handled_at: now,
        updated_at: now,
      },
    ],
    { onConflict: "user_id, sku_id", defaultToNull: false }
  );
}

async function buildExistingBidFromSources(
  client: PoizonClient,
  supabase: ReturnType<typeof getServiceRoleClient>,
  userInternalId: string,
  skuId: number
): Promise<ExistingBidInfo | null> {
  const poizonMap = await fetchActiveListingsBySkuIdsSafe(client, [skuId]);
  const poizonListing = poizonMap.get(skuId);
  if (poizonListing) return listingToExistingBid(poizonListing);

  const { data: localRow } = await supabase
    .from("bid_history")
    .select("sku_id, spu_id, bid_price, size_info, seller_bidding_no, created_at")
    .eq("user_id", userInternalId)
    .eq("sku_id", skuId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (localRow) return localRowToExistingBid(localRow);
  return null;
}

/**
 * SKU별 기존 활성 입찰 조회 (실데이터 우선, 없으면 로컬 DB).
 */
export async function getExistingBidsForSkus(skuIds: (string | number)[]) {
  try {
    const numericIds = skuIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
    if (numericIds.length === 0) return { success: true, data: {} as Record<string, ExistingBidInfo> };

    const { supabase, user, client } = await getBiddingContext();
    const poizonMap = await fetchActiveListingsBySkuIdsSafe(client, numericIds);

    const { data: localRows } = await supabase
      .from("bid_history")
      .select("sku_id, spu_id, bid_price, size_info, seller_bidding_no, created_at")
      .eq("user_id", user.id)
      .in("sku_id", numericIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const localBySku = new Map<number, ExistingBidInfo>();
    (localRows || []).forEach((row) => {
      const skuId = Number(row.sku_id);
      if (!localBySku.has(skuId)) localBySku.set(skuId, localRowToExistingBid(row));
    });

    const result: Record<string, ExistingBidInfo> = {};
    for (const skuId of numericIds) {
      const poizonListing = poizonMap.get(skuId);
      if (poizonListing) {
        result[String(skuId)] = listingToExistingBid(poizonListing);
      } else if (localBySku.has(skuId)) {
        result[String(skuId)] = localBySku.get(skuId)!;
      }
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error("[getExistingBidsForSkus] Error:", error);
    return { success: false, data: {} as Record<string, ExistingBidInfo>, error: error.message };
  }
}

export async function getBidHistoryBySkuIds(skuIds: (string | number)[]) {
  try {
    const numericIds = skuIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
    if (numericIds.length === 0) return { success: true, data: [] as any[] };

    const { supabase, user } = await getBiddingContext();

    const { data: localRows, error } = await supabase
      .from("bid_history")
      .select("sku_id, spu_id, bid_price, size_info, created_at, seller_bidding_no, status")
      .eq("user_id", user.id)
      .in("sku_id", numericIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const seen = new Set<number>();
    const merged: any[] = [];
    for (const skuId of numericIds) {
      if (seen.has(skuId)) continue;
      seen.add(skuId);
      const local = (localRows || []).find((r) => Number(r.sku_id) === skuId);
      if (local) merged.push(local);
    }

    return { success: true, data: merged };
  } catch (error: any) {
    console.error("[getBidHistoryBySkuIds] Error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getBidHistoryBySpuIds(spuIds: (string | number)[]) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const supabase = getServiceRoleClient();
    const { data: user } = await supabase.from("users").select("id").eq("clerk_id", userId).single();
    if (!user) throw new Error("사용자 정보를 찾을 수 없습니다.");

    const { data, error } = await supabase
      .from("bid_history")
      .select("spu_id, sku_id, created_at, bid_price")
      .eq("user_id", user.id)
      .in("spu_id", spuIds.map((id) => Number(id)))
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Get Bid History Error:", error);
    return { success: false, error: error.message };
  }
}

function isSubmitApiAccepted(response: { code?: number } | null | undefined): boolean {
  const code = response?.code;
  return code === 200 || code === 0;
}

function extractSellerBiddingNo(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string" || typeof data === "number") {
    const text = String(data).trim();
    return text && text !== "0" ? text : "";
  }
  if (typeof data !== "object") return "";
  const rec = data as Record<string, unknown>;
  for (const key of ["sellerBiddingNo", "biddingNo", "seller_bidding_no"]) {
    const value = rec[key];
    if (value != null && String(value).trim() && String(value) !== "0") {
      return String(value).trim();
    }
  }
  if (rec.data != null && rec.data !== data) return extractSellerBiddingNo(rec.data);
  return "";
}

function submitRejectTip(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const tips = String(rec.tips ?? rec.tip ?? rec.message ?? rec.msg ?? "").trim();
  if (!tips) return null;
  if (/fail|error|reject|拒绝|失败|불가|취소/i.test(tips)) return tips;
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function confirmListingOnPoizon(
  client: PoizonClient,
  sellerBiddingNo: string
): Promise<"active" | "cancelled" | "missing" | "unknown"> {
  let sawError = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(700 * attempt);
    try {
      const listing = await fetchListingByBiddingNo(client, sellerBiddingNo);
      if (!listing) continue;
      if (listing.tradeStatus === TRADE_STATUS.CANCELLED) return "cancelled";
      return "active";
    } catch (error) {
      sawError = true;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[Bidding] 실데이터 입찰 확인 실패:", msg.slice(0, 200));
    }
  }
  return sawError ? "unknown" : "missing";
}

async function submitSingleBid(
  client: PoizonClient,
  supabase: ReturnType<typeof getServiceRoleClient>,
  userInternalId: string,
  bid: BidPayload
): Promise<BidResult> {
  const apiSkuId = Number(bid.apiSkuId ?? bid.skuId);
  const globalSkuId = bid.globalSkuId ? Number(bid.globalSkuId) : undefined;
  const payload: Record<string, unknown> = {
    requestId: crypto.randomUUID(),
    skuId: apiSkuId,
    price: Number(bid.price),
    quantity: 1,
    countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    deliveryCountryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
    sizeType: POIZON_CONSTANTS.BIDDING.DEFAULT_SIZE_TYPE,
    biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
  };
  if (globalSkuId && globalSkuId !== apiSkuId) payload.globalSkuId = globalSkuId;

  const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SUBMIT_BID, payload);

  if (!isSubmitApiAccepted(response)) {
    return {
      skuId: bid.skuId,
      success: false,
      message: response?.msg || "응답 처리 실패",
    };
  }

  const rejectTip = submitRejectTip(response?.data);
  if (rejectTip) {
    return {
      skuId: bid.skuId,
      success: false,
      message: rejectTip,
      data: response.data,
    };
  }

  const sellerBiddingNo = extractSellerBiddingNo(response?.data);
  if (!sellerBiddingNo) {
    console.warn("[Bidding] submit-bid 성공 코드이나 입찰번호 없음", {
      skuId: bid.skuId,
      apiSkuId,
      code: response?.code,
      dataType: typeof response?.data,
    });
    return {
      skuId: bid.skuId,
      success: false,
      message: "실데이터가 입찰번호를 주지 않았습니다. 입찰이 생성되지 않은 것으로 처리합니다.",
      data: response.data,
    };
  }

  const listingState = await confirmListingOnPoizon(client, sellerBiddingNo);
  if (listingState === "cancelled") {
    return {
      skuId: bid.skuId,
      success: false,
      message: "실데이터가 입찰을 바로 취소했습니다.",
      data: response.data,
    };
  }
  if (listingState === "missing") {
    return {
      skuId: bid.skuId,
      success: false,
      message: `입찰번호 ${sellerBiddingNo} 를 받았으나 실데이터 입찰 목록에 없습니다.`,
      data: response.data,
    };
  }
  if (listingState === "unknown") {
    return {
      skuId: bid.skuId,
      success: false,
      message: `입찰번호 ${sellerBiddingNo} 를 받았으나 실데이터 목록 확인에 실패했습니다. 입찰 관리에서 직접 확인해 주세요.`,
      data: response.data,
    };
  }

  try {
    await saveBidToLocalDb(supabase, userInternalId, bid, {
      sellerBiddingNo,
      bidPrice: Number(bid.price),
    });
  } catch (dbErr) {
    console.warn("[Bidding] bid_history 저장 실패 (실데이터 입찰은 확인됨):", dbErr);
  }

  return {
    skuId: bid.skuId,
    success: true,
    message: "입찰 성공",
    data: response.data,
  };
}

export async function executeBidding(bids: BidPayload[], options: ExecuteBiddingOptions = {}) {
  const mode = options.mode ?? "normal";

  try {
    const { supabase, user, client } = await getBiddingContext();
    const results: BidResult[] = [];

    for (const bid of bids) {
      try {
        if (mode === "updatePrice") {
          const sellerBiddingNo = bid.sellerBiddingNo;
          if (!sellerBiddingNo) {
            const existing = await buildExistingBidFromSources(
              client,
              supabase,
              user.id,
              Number(bid.skuId)
            );
            if (!existing?.sellerBiddingNo) {
              results.push({
                skuId: bid.skuId,
                success: false,
                message: "기존 입찰 번호를 찾을 수 없어 가격 변경 재입찰을 할 수 없습니다.",
              });
              continue;
            }
            bid.sellerBiddingNo = existing.sellerBiddingNo;
          }

          const { updateBidPrice } = await import("@/app/actions/listing");
          const updateResult = await updateBidPrice(
            bid.sellerBiddingNo!,
            Number(bid.skuId),
            Number(bid.price),
            bid.spuId ? Number(bid.spuId) : undefined
          );

          results.push({
            skuId: bid.skuId,
            success: !!updateResult.success,
            message:
              updateResult.message ||
              updateResult.error ||
              (updateResult.success ? "가격 변경 성공" : "가격 변경 실패"),
            data: updateResult.data,
          });
          continue;
        }

        console.log(`[Bidding DEBUG] mode=${mode}, SKU=${bid.skuId}, price=${bid.price}`);
        const result = await submitSingleBid(client, supabase, user.id, bid);
        results.push(result);
      } catch (err: any) {
        if (isDuplicateListingError(err)) {
          const existingBid = await buildExistingBidFromSources(
            client,
            supabase,
            user.id,
            Number(bid.skuId)
          );

          if (mode === "forceRetry") {
            results.push({
              skuId: bid.skuId,
              success: false,
              alreadyListed: true,
              message:
                "동일 옵션·동일 가격 입찰은 실데이터에서 거부됩니다. 입찰 관리(/dashboard/listings)에서 수량을 변경하거나 가격을 수정해 주세요.",
              existingBid: existingBid ?? undefined,
            });
          } else {
            results.push({
              skuId: bid.skuId,
              success: false,
              needsDuplicateConfirm: true,
              alreadyListed: true,
              existingBid: existingBid ?? undefined,
              message: existingBid
                ? `이미 입찰 중 (₩${existingBid.bidPrice.toLocaleString()}, ${existingBid.bidDate})`
                : "이미 입찰 중인 옵션입니다.",
            });
          }
          continue;
        }

        console.error(`[Bidding Exception] SKU: ${bid.skuId}`, err);
        results.push({
          skuId: bid.skuId,
          success: false,
          message: err.message,
        });
      }
    }

    const allSuccess = results.every((r) => r.success);
    return {
      success: allSuccess,
      data: results,
      error: allSuccess ? undefined : "일부 또는 전체 입찰이 실패했습니다. 결과를 확인하세요.",
    };
  } catch (error: any) {
    console.error("Execute Bidding Error:", error);
    return { success: false, error: error.message };
  }
}
