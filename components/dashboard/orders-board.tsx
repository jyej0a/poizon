"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";
import { getMyOrders, getOrdersAcrossRange, shipOrder } from "@/app/actions/orders";
import { formatWonAmount } from "@/lib/utils/exposure-price";
import {
  defaultOrderWindow,
  normalizeOrderRange,
  orderStatusMeta,
} from "@/lib/utils/poizon-order";
import {
  canShipOrder,
  IDENTIFY_TYPE_LABEL,
  KNOWN_CARRIERS,
  ONLINE_IDENTIFY_STATUS_LABEL,
  ORDER_STATUS_TABS,
  ORDER_TYPE_LABEL,
  type OrderStatusTab,
  type ParsedOrder,
} from "@/types/poizon-order";

const pageSize = 20;

export function OrdersBoard() {
  const initialWindow = defaultOrderWindow();
  const [startLocal, setStartLocal] = useState(initialWindow.start);
  const [endLocal, setEndLocal] = useState(initialWindow.end);
  const [tab, setTab] = useState<OrderStatusTab>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<ParsedOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<ParsedOrder | null>(null);
  const [splitNote, setSplitNote] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    const range = normalizeOrderRange(startLocal, endLocal);
    const tabDef = ORDER_STATUS_TABS.find((item) => item.key === tab);
    const singleStatus = tabDef?.statuses?.length === 1 ? tabDef.statuses[0] : undefined;
    setSplitNote(range.needsSplit);

    const result = range.needsSplit
      ? await getOrdersAcrossRange({ start: range.start, end: range.end, orderStatus: singleStatus })
      : await getMyOrders({
          startCreated: range.start_created,
          endCreated: range.end_created,
          orderStatus: singleStatus,
          pageNo: page,
          pageSize,
        });

    if (result.success) {
      setOrders(result.data);
      setTotal(result.total);
    } else {
      setApiError(result.error || "주문 목록을 불러오지 못했습니다.");
      setOrders([]);
      setTotal(0);
    }
    setIsLoading(false);
  }, [endLocal, page, startLocal, tab]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const visible = useMemo(() => {
    const tabDef = ORDER_STATUS_TABS.find((item) => item.key === tab);
    const statuses = tabDef?.statuses;
    const q = keyword.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      if (statuses && statuses.length > 1 && !statuses.includes(order.orderStatus)) return false;
      if (!q) return true;
      return [order.orderNo, order.productName, order.articleNumber, order.sizeInfo]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (!splitNote) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [keyword, orders, page, splitNote, tab]);

  const filteredCount = useMemo(() => {
    const tabDef = ORDER_STATUS_TABS.find((item) => item.key === tab);
    const statuses = tabDef?.statuses;
    const q = keyword.trim().toLowerCase();
    return orders.filter((order) => {
      if (statuses && statuses.length > 1 && !statuses.includes(order.orderStatus)) return false;
      if (!q) return true;
      return [order.orderNo, order.productName, order.articleNumber, order.sizeInfo]
        .join(" ")
        .toLowerCase()
        .includes(q);
    }).length;
  }, [keyword, orders, tab]);

  const totalPages = Math.max(1, Math.ceil((splitNote ? filteredCount : total) / pageSize));

  const applyPreset = (days: number) => {
    const window = defaultOrderWindow(new Date(), days);
    setStartLocal(window.start);
    setEndLocal(window.end);
    setPage(1);
  };

  return (
    <div className="h-full flex flex-col gap-2 w-full min-h-0">
      <div className="glass-panel border border-secondary/40 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-[11px] font-medium text-muted-foreground space-y-1">
            시작
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => { setStartLocal(e.target.value); setPage(1); }}
              className="block h-8 px-2 bg-secondary/30 rounded-lg text-[12px] outline-none"
            />
          </label>
          <label className="text-[11px] font-medium text-muted-foreground space-y-1">
            종료
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => { setEndLocal(e.target.value); setPage(1); }}
              className="block h-8 px-2 bg-secondary/30 rounded-lg text-[12px] outline-none"
            />
          </label>
          <div className="flex gap-1 pb-1.5">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                className="h-8 px-2 text-[11px] border border-secondary rounded-lg hover:bg-secondary font-medium"
              >
                {days}일
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground pb-1.5">
            {splitNote ? "7일을 넘어 구간을 나눠 조회합니다. 상한 90일." : "호출당 최대 7일. 더 긴 기간은 자동 분할."}
          </p>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="주문번호·품번·상품명"
              className="w-full h-8 pl-9 pr-3 bg-secondary/30 rounded-lg outline-none text-[13px]"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            disabled={isLoading}
            className="h-8 px-3 border border-secondary rounded-lg text-[12px] font-medium hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            조회
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {ORDER_STATUS_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setTab(item.key); setPage(1); }}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap border ${
                tab === item.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/20 text-muted-foreground border-secondary/30 hover:bg-secondary/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 glass-panel border border-secondary/40 rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between p-4 border-b bg-secondary/5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">주문 목록</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              {splitNote ? filteredCount : total}건
            </span>
          </div>
        </div>

        {apiError && (
          <div className="mx-4 mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-[12px] text-orange-700">
            <AlertCircle size={14} />
            <span className="flex-1">{apiError}</span>
            <button type="button" onClick={() => setApiError(null)} className="hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-[13px] text-left whitespace-nowrap">
            <thead className="text-[11px] text-muted-foreground bg-muted sticky top-0 z-20 border-b uppercase font-semibold tracking-wider">
              <tr className="h-10">
                <th className="px-4 min-w-[240px] border-r border-border/40">상품</th>
                <th className="px-2 text-center border-r border-border/40">유형</th>
                <th className="px-2 text-center border-r border-border/40">상태</th>
                <th className="px-2 text-center border-r border-border/40">검수</th>
                <th className="px-2 text-center border-r border-border/40">금액</th>
                <th className="px-2 text-center border-r border-border/40">송장</th>
                <th className="px-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-muted-foreground">
                    <Loader2 size={28} className="animate-spin opacity-30 mx-auto mb-3" />
                    <span className="text-[13px] opacity-40">주문을 불러오는 중...</span>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-muted-foreground">
                    <Package size={36} className="opacity-10 mx-auto mb-3" />
                    <p className="text-[13px] font-medium opacity-40">이 구간에 주문이 없습니다</p>
                    <p className="text-[11px] opacity-30 mt-1">기간을 넓히면 7일 단위로 나눠 조회합니다.</p>
                  </td>
                </tr>
              ) : (
                visible.map((order) => {
                  const status = orderStatusMeta(order.orderStatus);
                  return (
                    <tr key={order.orderNo} className="border-b border-border/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-white border border-secondary/20 p-1 shrink-0 overflow-hidden">
                            {order.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={order.image} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Package size={16} className="m-auto text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[320px]">{order.productName || "상품명 없음"}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {order.articleNumber || "—"} {order.sizeInfo ? `· ${order.sizeInfo}` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 font-mono">{order.orderNo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 text-center text-[12px]">
                        {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
                      </td>
                      <td className="px-2 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-2 text-center text-[11px] text-muted-foreground">
                        {qcLabel(order)}
                      </td>
                      <td className="px-2 text-center font-mono font-semibold">
                        {formatWonAmount(order.payAmount || order.amount)}
                      </td>
                      <td className="px-2 text-center text-[11px] font-mono">
                        {order.expressNo || "—"}
                      </td>
                      <td className="px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailOrder(order)}
                            className="text-[11px] font-bold px-2 py-1 rounded-md border border-secondary hover:bg-secondary"
                          >
                            상세
                          </button>
                          {canShipOrder(order.orderStatus) ? (
                            <button
                              type="button"
                              onClick={() => setShippingOrder(order)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-primary text-primary-foreground"
                            >
                              <Truck size={12} />
                              발송
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-secondary/5 text-[12px]">
            <span className="text-muted-foreground">{splitNote ? filteredCount : total}건</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded border disabled:opacity-30">
                이전
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border disabled:opacity-30">
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {detailOrder && <OrderDetailDialog order={detailOrder} onClose={() => setDetailOrder(null)} />}
      {shippingOrder && (
        <ShipDialog
          order={shippingOrder}
          onClose={() => setShippingOrder(null)}
          onShipped={() => {
            setShippingOrder(null);
            void fetchOrders();
          }}
        />
      )}
    </div>
  );
}

function qcLabel(order: ParsedOrder): string {
  const identify = IDENTIFY_TYPE_LABEL[order.identifyType];
  const online = ONLINE_IDENTIFY_STATUS_LABEL[order.onlineIdentifyStatus];
  if (identify && online) return `${identify} · ${online}`;
  return identify || online || "—";
}

function OrderDetailDialog({ order, onClose }: { order: ParsedOrder; onClose: () => void }) {
  const status = orderStatusMeta(order.orderStatus);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border shadow-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">주문 상세</h3>
            <p className="text-[12px] font-mono text-muted-foreground mt-0.5">{order.orderNo}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-[12px]">
          <dt className="text-muted-foreground">상품</dt>
          <dd>{order.productName || "—"} {order.sizeInfo ? `· ${order.sizeInfo}` : ""}</dd>
          <dt className="text-muted-foreground">품번</dt>
          <dd className="font-mono">{order.articleNumber || "—"}</dd>
          <dt className="text-muted-foreground">상태</dt>
          <dd>{status.label}</dd>
          <dt className="text-muted-foreground">검수</dt>
          <dd>{qcLabel(order)}</dd>
          <dt className="text-muted-foreground">결제</dt>
          <dd>{formatWonAmount(order.payAmount || order.amount)} {order.payTime ? `· ${order.payTime}` : ""}</dd>
          <dt className="text-muted-foreground">수수료</dt>
          <dd>{order.poundageAmount ? formatWonAmount(order.poundageAmount) : "—"}</dd>
          <dt className="text-muted-foreground">발송 기한</dt>
          <dd>{order.deliveryLimitTime || order.earliestDeliveryTime || "—"}</dd>
          <dt className="text-muted-foreground">송장</dt>
          <dd className="font-mono">{order.expressNo || "—"} {order.carrier ? `(${order.carrier})` : ""}</dd>
          <dt className="text-muted-foreground">입고지</dt>
          <dd className="leading-relaxed">{order.platformAddress || "—"}</dd>
        </dl>
        <p className="text-[11px] text-muted-foreground">
          QC 전용 API는 실데이터에서 없습니다. 목록 필드로 검수 유형·상태를 표시합니다.
        </p>
      </div>
    </div>
  );
}

function ShipDialog({
  order,
  onClose,
  onShipped,
}: {
  order: ParsedOrder;
  onClose: () => void;
  onShipped: () => void;
}) {
  const [carrier, setCarrier] = useState(String(KNOWN_CARRIERS[0]?.id ?? 7));
  const [customCarrier, setCustomCarrier] = useState("");
  const [expressNo, setExpressNo] = useState(order.expressNo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const carrierId = carrier === "custom" ? Number(customCarrier) : Number(carrier);
    setBusy(true);
    setError(null);
    const result = await shipOrder({ orderNo: order.orderNo, carrier: carrierId, expressNo });
    setBusy(false);
    if (result.success) onShipped();
    else setError(result.error);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">발송 등록</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {order.productName || order.orderNo} · 검수센터로 보내는 송장
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <label className="block text-[12px] font-medium space-y-1">
          운송사
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px]"
          >
            {KNOWN_CARRIERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label} ({item.id})</option>
            ))}
            <option value="custom">기타 ID 직접 입력</option>
          </select>
        </label>
        <p className="text-[11px] text-muted-foreground">KR 전용 목록 API는 없습니다. 사용하는 택배사 ID가 있으면 직접 입력하세요.</p>
        {carrier === "custom" && (
          <label className="block text-[12px] font-medium space-y-1">
            운송사 ID
            <input
              value={customCarrier}
              onChange={(e) => setCustomCarrier(e.target.value)}
              className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px] font-mono"
              placeholder="숫자 ID"
            />
          </label>
        )}
        <label className="block text-[12px] font-medium space-y-1">
          송장번호
          <input
            value={expressNo}
            onChange={(e) => setExpressNo(e.target.value)}
            className="w-full h-9 px-2 rounded-lg bg-secondary/30 text-[13px] font-mono"
            placeholder="운송장 번호"
          />
        </label>
        {order.platformAddress && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">입고지: {order.platformAddress}</p>
        )}
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 h-8 text-[12px] rounded-lg hover:bg-secondary">
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="px-3 h-8 text-[12px] font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
          >
            {busy ? "등록 중..." : "발송 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
