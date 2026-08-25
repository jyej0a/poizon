import type { ParsedOrder } from "@/types/poizon-order";
import { ORDER_STATUS_LABEL } from "@/types/poizon-order";

function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return "";
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatAddress(block: Record<string, unknown>): string {
  const parts = [
    pickString(block, ["province"]),
    pickString(block, ["city"]),
    pickString(block, ["district"]),
    pickString(block, ["street"]),
    pickString(block, ["address_detail", "addressDetail"]),
    pickString(block, ["postcode", "zip"]),
  ].filter(Boolean);
  return parts.join(" ");
}

export function extractOrderRawList(response: unknown): unknown[] {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const list = data.orders ?? data.list ?? root.orders ?? root.list;
  return Array.isArray(list) ? list : [];
}

export function extractOrderTotal(response: unknown, fallback: number): number {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const total = Number(data.total_results ?? data.total ?? root.total_results ?? root.total);
  return Number.isFinite(total) ? total : fallback;
}

export function parseOrderItem(raw: unknown): ParsedOrder {
  const item = asRecord(raw);
  const trust = asRecord(item.trustProductInfo ?? item.trust_product_info);
  const express = asRecord(item.express_to_platform ?? item.expressToPlatform);
  const platformAddr = asRecord(item.delivery_address_platform ?? item.deliveryAddressPlatform);

  return {
    orderNo: pickString(item, ["order_no", "orderNo"]),
    orderType: pickString(item, ["order_type", "orderType"]) || "NORMAL_SALE",
    orderStatus: pickNumber(item, ["order_status", "orderStatus"]),
    skuId: pickNumber(item, ["sku_id", "skuId", "globalSkuId"]),
    spuId: pickNumber(item, ["spu_id", "spuId", "globalSpuId"]),
    articleNumber: pickString(item, ["article_number", "articleNumber", "designerId"]) || pickString(trust, ["designerId"]),
    productName:
      pickString(item, ["product_name", "productName", "title", "spu_name", "spuName", "sku_name", "skuName"]) ||
      pickString(trust, ["merchantSkuName"]),
    sizeInfo: pickString(item, ["size", "size_info", "sizeInfo"]) || pickString(trust, ["size"]),
    image: pickString(item, ["image", "logoUrl", "imgUrl", "sku_logo", "skuLogo"]),
    quantity: pickNumber(item, ["quantity", "qty"]) || 1,
    amount: pickNumber(item, ["amount", "pay_amount", "payAmount"]),
    payAmount: pickNumber(item, ["pay_amount", "payAmount", "amount"]),
    currency: pickString(item, ["currency"]) || "KRW",
    payTime: pickString(item, ["pay_time", "payTime"]),
    createdAt: pickString(item, ["created_at", "create_time", "createTime", "gmt_create", "gmtCreate"]),
    earliestDeliveryTime: pickString(item, ["earliest_delivery_time", "earliestDeliveryTime"]),
    expressNo:
      pickString(express, ["express_no", "expressNo"]) || pickString(item, ["express_no", "expressNo"]),
    carrier: pickString(express, ["carrier"]) || pickString(item, ["carrier"]),
    platformAddress: formatAddress(platformAddr),
    identifyType: pickNumber(item, ["identifyType", "identify_type"]),
    onlineIdentifyStatus: pickNumber(item, ["onlineIdentifyStatus", "online_identify_status"]),
    poundagePercent: pickNumber(item, ["poundage_percent", "poundagePercent"]),
    poundageAmount: sumPoundage(item),
    deliveryLimitTime: pickString(item, ["delivery_limit_time", "deliveryLimitTime"]),
    sellerBiddingNo: pickString(item, ["seller_bidding_no", "sellerBiddingNo"]),
  };
}

function sumPoundage(item: Record<string, unknown>): number {
  const detail = item.poundage_detail ?? item.poundageDetail;
  if (!Array.isArray(detail)) return 0;
  return detail.reduce((sum, row) => {
    const rec = asRecord(row);
    const value = Number(rec.current_expense ?? rec.currentExpense ?? rec.amount ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function orderStatusMeta(status: number) {
  return (
    ORDER_STATUS_LABEL[status] ?? {
      label: `상태 ${status}`,
      color: "text-muted-foreground bg-secondary/40 border-border/50",
    }
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatPoizonDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 호출당 최대 7일 */
export const ORDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** 화면에서 고를 수 있는 상한 */
export const ORDER_RANGE_MAX_MS = 90 * 24 * 60 * 60 * 1000;

export function defaultOrderWindow(now = new Date(), days = 7) {
  const end = now;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: toDatetimeLocalValue(start),
    end: toDatetimeLocalValue(end),
  };
}

export function normalizeOrderRange(startLocal: string, endLocal: string) {
  let start = fromDatetimeLocalValue(startLocal) ?? new Date(Date.now() - ORDER_WINDOW_MS);
  let end = fromDatetimeLocalValue(endLocal) ?? new Date();
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (end.getTime() - start.getTime() > ORDER_RANGE_MAX_MS) {
    end = new Date(start.getTime() + ORDER_RANGE_MAX_MS);
  }
  if (end.getTime() === start.getTime()) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  return {
    start,
    end,
    start_created: formatPoizonDateTime(start),
    end_created: formatPoizonDateTime(end),
    startLocal: toDatetimeLocalValue(start),
    endLocal: toDatetimeLocalValue(end),
    needsSplit: end.getTime() - start.getTime() > ORDER_WINDOW_MS,
  };
}

export function splitOrderWindows(start: Date, end: Date): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + ORDER_WINDOW_MS, end.getTime()));
    windows.push({ start: new Date(cursor), end: next });
    cursor = next;
  }
  return windows;
}

/** API 제약: start~end 최대 7일. 넘으면 end를 start+7일로 자른다 */
export function clampOrderWindow(startLocal: string, endLocal: string) {
  const start = fromDatetimeLocalValue(startLocal) ?? new Date(Date.now() - ORDER_WINDOW_MS);
  let end = fromDatetimeLocalValue(endLocal) ?? new Date();
  const maxEnd = new Date(start.getTime() + ORDER_WINDOW_MS);
  if (end > maxEnd) end = maxEnd;
  if (end < start) end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    start_created: formatPoizonDateTime(start),
    end_created: formatPoizonDateTime(end),
    startLocal: toDatetimeLocalValue(start),
    endLocal: toDatetimeLocalValue(end),
  };
}
