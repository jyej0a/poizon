"use server";

import { getPoizonClient } from "@/app/actions/poizon";
import { POIZON_CONSTANTS } from "@/lib/constants/poizon";
import { mapWithConcurrency } from "@/lib/api/retry";
import {
  extractOrderRawList,
  extractOrderTotal,
  formatPoizonDateTime,
  parseOrderItem,
  splitOrderWindows,
} from "@/lib/utils/poizon-order";
import type { ParsedOrder } from "@/types/poizon-order";

export interface OrderListFilters {
  startCreated: string;
  endCreated: string;
  orderStatus?: number;
  pageNo?: number;
  pageSize?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getMyOrders(filters: OrderListFilters) {
  try {
    const client = await getPoizonClient();
    const pageSize = filters.pageSize || 20;
    const payload: Record<string, unknown> = {
      start_created: filters.startCreated,
      end_created: filters.endCreated,
      page_no: filters.pageNo || 1,
      page_size: pageSize,
      language: "ko",
      timeZone: "Asia/Seoul",
      order_by_create_time_desc: true,
    };
    if (filters.orderStatus) {
      payload.order_status = String(filters.orderStatus);
    }

    const response = await client.request<Record<string, unknown>>(
      POIZON_CONSTANTS.ENDPOINTS.ORDER_LIST,
      payload
    );
    const rawList = extractOrderRawList(response);
    const orders = rawList.map(parseOrderItem);
    return {
      success: true as const,
      data: orders,
      total: extractOrderTotal(response, orders.length),
    };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[getMyOrders]", message);
    return { success: false as const, error: message, data: [] as ParsedOrder[], total: 0 };
  }
}

export async function getOrdersAcrossRange(filters: {
  start: Date;
  end: Date;
  orderStatus?: number;
}) {
  try {
    const client = await getPoizonClient();
    const windows = splitOrderWindows(filters.start, filters.end);
    const pages = await mapWithConcurrency(windows, 2, async (window) => {
      const collected: ParsedOrder[] = [];
      for (let page = 1; page <= 8; page += 1) {
        const payload: Record<string, unknown> = {
          start_created: formatPoizonDateTime(window.start),
          end_created: formatPoizonDateTime(window.end),
          page_no: page,
          page_size: 50,
          language: "ko",
          timeZone: "Asia/Seoul",
          order_by_create_time_desc: true,
        };
        if (filters.orderStatus) payload.order_status = String(filters.orderStatus);
        const response = await client.request<Record<string, unknown>>(
          POIZON_CONSTANTS.ENDPOINTS.ORDER_LIST,
          payload
        );
        const chunk = extractOrderRawList(response).map(parseOrderItem);
        collected.push(...chunk);
        const total = extractOrderTotal(response, collected.length);
        if (chunk.length < 50 || collected.length >= total) break;
      }
      return collected;
    });

    const byNo = new Map<string, ParsedOrder>();
    for (const order of pages.flat()) {
      if (order.orderNo) byNo.set(order.orderNo, order);
    }
    const data = [...byNo.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { success: true as const, data, total: data.length };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[getOrdersAcrossRange]", message);
    return { success: false as const, error: message, data: [] as ParsedOrder[], total: 0 };
  }
}

export async function shipOrder(input: {
  orderNo: string;
  carrier: number;
  expressNo: string;
}) {
  try {
    const orderNo = input.orderNo.trim();
    const expressNo = input.expressNo.trim();
    if (!orderNo) return { success: false as const, error: "주문번호가 없습니다." };
    if (!expressNo) return { success: false as const, error: "송장번호를 입력해 주세요." };
    if (!Number.isFinite(input.carrier) || input.carrier <= 0) {
      return { success: false as const, error: "운송사를 선택해 주세요." };
    }

    const client = await getPoizonClient();
    await client.request(POIZON_CONSTANTS.ENDPOINTS.ORDER_DELIVERY, {
      order_no: orderNo,
      express_no: expressNo,
      carrier: String(input.carrier),
      delivery_method: "OFFLINE_EXPRESS_DELIVERY",
      language: "ko",
      timeZone: "Asia/Seoul",
    });
    return { success: true as const };
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("[shipOrder]", message);
    return { success: false as const, error: message };
  }
}
