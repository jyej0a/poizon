import { calculateMargin, type SystemSettings } from "@/lib/utils/calculate-margin";
import { ORDER_STATUS } from "@/types/poizon-order";
import type { ParsedOrder } from "@/types/poizon-order";

export interface DayRevenue {
  day: string;
  count: number;
  gmv: number;
}

export interface StatusRevenue {
  status: number;
  count: number;
  gmv: number;
}

export interface RevenueSummary {
  orderCount: number;
  gmv: number;
  fee: number;
  feeEstimated: boolean;
  net: number;
  successCount: number;
  successGmv: number;
  byDay: DayRevenue[];
  byStatus: StatusRevenue[];
}

function dayKey(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function aggregateOrderRevenue(orders: ParsedOrder[], settings: SystemSettings | null): RevenueSummary {
  const byDay = new Map<string, DayRevenue>();
  const byStatus = new Map<number, StatusRevenue>();
  let gmv = 0;
  let fee = 0;
  let feeFromApi = 0;
  let successCount = 0;
  let successGmv = 0;

  for (const order of orders) {
    const amount = order.payAmount || order.amount;
    gmv += amount;
    const apiFee = order.poundageAmount;
    const estimated = settings ? calculateMargin(amount, settings).fee : 0;
    const usedFee = apiFee > 0 ? apiFee : estimated;
    fee += usedFee;
    if (apiFee > 0) feeFromApi += 1;
    if (order.orderStatus === ORDER_STATUS.SUCCESS) {
      successCount += 1;
      successGmv += amount;
    }
    const day = dayKey(order.payTime || order.createdAt);
    const dayRow = byDay.get(day) ?? { day, count: 0, gmv: 0 };
    dayRow.count += 1;
    dayRow.gmv += amount;
    byDay.set(day, dayRow);
    const statusRow = byStatus.get(order.orderStatus) ?? { status: order.orderStatus, count: 0, gmv: 0 };
    statusRow.count += 1;
    statusRow.gmv += amount;
    byStatus.set(order.orderStatus, statusRow);
  }

  return {
    orderCount: orders.length,
    gmv,
    fee,
    feeEstimated: orders.length > 0 && feeFromApi === 0,
    net: gmv - fee,
    successCount,
    successGmv,
    byDay: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    byStatus: [...byStatus.values()].sort((a, b) => b.count - a.count),
  };
}
