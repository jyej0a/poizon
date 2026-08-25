"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { PoizonClient } from "@/lib/api/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { getPoizonContext } from "@/lib/api/poizon-context";
import {
  fetchActiveListingsBySkuIdsSafe,
  formatBidDate,
  type ParsedListingItem,
} from "@/lib/utils/poizon-listing";

export interface BidPayload {
  skuId: string | number;
  spuId?: string | number;
  price: number;
  sellerBiddingNo?: string;
  sizeInfo?: string;
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
    {
      user_id: userInternalId,
      sku_id: skuId,
      spu_id: spuId,
      handled: true,
      handled_at: now,
      updated_at: now,
    },
    { onConflict: "user_id, sku_id" }
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

    const { supabase, user, client } = await getBiddingContext();

    const { data: localRows, error } = await supabase
      .from("bid_history")
      .select("sku_id, spu_id, bid_price, size_info, created_at, seller_bidding_no, status")
      .eq("user_id", user.id)
      .in("sku_id", numericIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const poizonMap = await fetchActiveListingsBySkuIdsSafe(client, numericIds);
    const seen = new Set<number>();
    const merged: any[] = [];

    for (const skuId of numericIds) {
      if (seen.has(skuId)) continue;
      seen.add(skuId);

      const poizonListing = poizonMap.get(skuId);
      if (poizonListing) {
        merged.push({
          sku_id: skuId,
          spu_id: poizonListing.spuId || null,
          bid_price: poizonListing.price,
          size_info: poizonListing.sizeInfo,
          created_at: poizonListing.createdAt || new Date().toISOString(),
          seller_bidding_no: poizonListing.sellerBiddingNo,
        });
        continue;
      }

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

async function submitSingleBid(
  client: PoizonClient,
  supabase: ReturnType<typeof getServiceRoleClient>,
  userInternalId: string,
  bid: BidPayload
): Promise<BidResult> {
  const payload = {
    requestId: crypto.randomUUID(),
    skuId: Number(bid.skuId),
    price: Number(bid.price),
    quantity: 1,
    countryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    deliveryCountryCode: POIZON_CONSTANTS.BIDDING.DEFAULT_COUNTRY,
    currency: POIZON_CONSTANTS.BIDDING.DEFAULT_CURRENCY,
    sizeType: POIZON_CONSTANTS.BIDDING.DEFAULT_SIZE_TYPE,
    biddingType: POIZON_CONSTANTS.BIDDING.DEFAULT_BIDDING_TYPE,
    saleType: POIZON_CONSTANTS.BIDDING.DEFAULT_SALE_TYPE,
  };

  const response = await client.request<any>(POIZON_CONSTANTS.ENDPOINTS.SUBMIT_BID, payload);

  if (response && response.code === 200) {
    const sellerBiddingNo = response.data?.sellerBiddingNo || response.data?.biddingNo || "";
    try {
      await saveBidToLocalDb(supabase, userInternalId, bid, {
        sellerBiddingNo,
        bidPrice: Number(bid.price),
      });
    } catch (dbErr) {
      console.warn("[Bidding] bid_history 저장 실패 (입찰은 성공):", dbErr);
    }

    return {
      skuId: bid.skuId,
      success: true,
      message: "입찰 성공",
      data: response.data,
    };
  }

  return {
    skuId: bid.skuId,
    success: false,
    message: response?.msg || "응답 처리 실패",
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
