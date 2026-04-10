"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Download,
  DollarSign,
  Gavel,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Package,
  X,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Filter,
  Image as ImageIcon,
} from "lucide-react";
import { getMyListings, cancelBid, updateBidPrice, getLocalBidHistory } from "@/app/actions/listing";
import type { ListingItem } from "@/app/actions/listing";

type FilterTab = "all" | "cn_hidden" | "kr_hidden" | "cn_lowest" | "kr_lowest";

interface BidHistoryItem {
  id: string;
  sku_id: number;
  spu_id: number;
  article_number: string;
  product_name: string;
  size_info: string;
  bid_price: number;
  seller_bidding_no: string;
  status: string;
  bid_type: string;
  created_at: string;
  updated_at: string;
}

const FILTER_TABS: { key: FilterTab; label: string; countKey?: string }[] = [
  { key: "all", label: "전체" },
  { key: "cn_hidden", label: "중국 구매자 미노출" },
  { key: "kr_hidden", label: "한국 구매자 미노출" },
  { key: "cn_lowest", label: "중국 최저가 미달성" },
  { key: "kr_lowest", label: "한국 최저가 미달성" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "활성", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  sold: { label: "판매완료", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  cancelled: { label: "취소", color: "text-gray-500 bg-gray-500/10 border-gray-500/20" },
  expired: { label: "만료", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  rejected: { label: "미통과", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  pending: { label: "대기", color: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20" },
};

export function ListingsBoard() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [localHistory, setLocalHistory] = useState<BidHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"api" | "local">("api");
  const pageSize = 20;

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      if (dataSource === "api") {
        const result = await getMyListings({
          pageNo: page,
          pageSize,
          keyword: keyword.trim() || undefined,
          status: activeTab !== "all" ? activeTab : undefined,
        });
        if (result.success) {
          setListings(result.data);
          setTotal(result.total);
        } else {
          setApiError(result.error || "API 연결에 실패했습니다.");
          // Fallback to local
          const localResult = await getLocalBidHistory(page, pageSize);
          if (localResult.success) {
            setLocalHistory(localResult.data);
            setTotal(localResult.total);
            setDataSource("local");
          }
        }
      } else {
        const localResult = await getLocalBidHistory(page, pageSize);
        if (localResult.success) {
          setLocalHistory(localResult.data);
          setTotal(localResult.total);
        }
      }
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, keyword, activeTab, dataSource]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleCancel = async (sellerBiddingNo: string) => {
    if (!confirm("이 입찰을 취소하시겠습니까?")) return;
    setCancellingIds(prev => new Set(prev).add(sellerBiddingNo));
    try {
      const result = await cancelBid(sellerBiddingNo);
      if (result.success) {
        await fetchListings();
      } else {
        alert(`취소 실패: ${result.error}`);
      }
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(sellerBiddingNo);
        return next;
      });
    }
  };

  const handlePriceUpdate = async (item: ListingItem) => {
    const newPrice = editingPrice[item.sellerBiddingNo];
    if (!newPrice) return;

    const numPrice = Number(newPrice.replace(/[^0-9]/g, ""));
    if (isNaN(numPrice) || numPrice <= 0) {
      alert("유효한 가격을 입력해 주세요.");
      return;
    }

    try {
      const result = await updateBidPrice(
        item.sellerBiddingNo,
        item.skuId,
        numPrice,
        item.spuId
      );
      if (result.success) {
        setEditingPrice(prev => {
          const next = { ...prev };
          delete next[item.sellerBiddingNo];
          return next;
        });
        await fetchListings();
      } else {
        alert(`가격 수정 실패: ${result.error}`);
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택된 ${selectedIds.size}건의 입찰을 취소하시겠습니까?`)) return;

    for (const id of selectedIds) {
      await handleCancel(id);
    }
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    const currentItems = dataSource === "api" ? listings : localHistory;
    const allIds = currentItems.map(item =>
      dataSource === "api"
        ? (item as ListingItem).sellerBiddingNo
        : (item as BidHistoryItem).seller_bidding_no || (item as BidHistoryItem).id
    );
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // Merge: 포이즌 API 데이터 또는 로컬 이력 데이터를 표시
  const displayItems = dataSource === "api" ? listings : [];
  const displayLocal = dataSource === "local" ? localHistory : [];

  return (
    <div className="h-full flex flex-col gap-2 w-full">
      {/* Search & Filters */}
      <div className="bg-card border border-secondary/40 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchListings()}
                placeholder="상품명/상품번호/브랜드/카테고리/사이즈 입력"
                className="w-full pl-9 pr-4 py-2 bg-secondary/30 border-none rounded-lg outline-none text-[13px]"
              />
            </div>
            <button
              onClick={fetchListings}
              disabled={isLoading}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              검색 및 입찰
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all whitespace-nowrap border ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary/20 text-muted-foreground border-secondary/30 hover:bg-secondary/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-card border border-secondary/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-secondary/5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">입찰 관리</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
              총 {total}건
            </span>
            {dataSource === "local" && (
              <span className="text-[10px] bg-orange-500/10 text-orange-600 px-2 py-1 rounded-full font-semibold border border-orange-500/20">
                로컬 이력
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDataSource(dataSource === "api" ? "local" : "api"); setPage(1); }}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 transition-colors font-medium"
            >
              <Filter size={13} />
              {dataSource === "api" ? "로컬 이력" : "API 조회"}
            </button>
            <button
              onClick={fetchListings}
              disabled={isLoading}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 transition-colors font-medium disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              새로고침
            </button>
            <button
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 transition-colors font-medium"
            >
              <Download size={13} />
              내보내기
            </button>
            <button
              className="text-[11px] px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 flex items-center gap-1.5 transition-colors font-bold"
            >
              <DollarSign size={13} />
              가격 조정
            </button>
            <button
              onClick={handleBatchCancel}
              disabled={selectedIds.size === 0}
              className="text-[11px] px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 flex items-center gap-1.5 transition-colors font-bold disabled:opacity-30"
            >
              <Trash2 size={13} />
              일괄 취소 ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="mx-4 mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-[12px] text-orange-700">
            <AlertCircle size={14} />
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError(null)} className="hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-[13px] text-left whitespace-nowrap border-collapse">
            <thead className="text-[11px] text-muted-foreground bg-background sticky top-0 z-20 shadow-sm border-b uppercase font-bold tracking-wider">
              <tr className="bg-secondary/5 h-10">
                <th className="px-2 w-10 text-center border-r border-secondary/10">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    onChange={toggleSelectAll}
                    checked={
                      (dataSource === "api" ? listings.length : localHistory.length) > 0 &&
                      selectedIds.size === (dataSource === "api" ? listings.length : localHistory.length)
                    }
                  />
                </th>
                <th className="px-4 min-w-[280px] border-r border-secondary/10">POIZON 상품 정보</th>
                <th className="px-2 min-w-[100px] text-center border-r border-secondary/10">브랜드/카테고리</th>
                <th className="px-2 min-w-[60px] text-center border-r border-secondary/10">수량</th>
                <th className="px-2 min-w-[100px] text-center border-r border-secondary/10 bg-primary/[0.02]">나의 입찰가</th>
                <th className="px-2 min-w-[80px] text-center border-r border-secondary/10">상태</th>
                <th className="px-2 min-w-[80px] text-center border-r border-secondary/10">미통과</th>
                <th className="px-2 min-w-[100px] text-center border-r border-secondary/10">중국 시장</th>
                <th className="px-2 min-w-[100px] text-center border-r border-secondary/10">한국 시장</th>
                <th className="px-2 min-w-[130px] text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 size={28} className="animate-spin opacity-30" />
                      <span className="text-[13px] font-medium opacity-40">데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : dataSource === "api" && listings.length === 0 && !apiError ? (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Package size={36} className="opacity-10" />
                      <span className="text-[13px] font-medium opacity-30">등록된 입찰이 없습니다</span>
                      <span className="text-[11px] opacity-20">대시보드에서 상품을 검색하고 입찰해 보세요</span>
                    </div>
                  </td>
                </tr>
              ) : dataSource === "local" && localHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Package size={36} className="opacity-10" />
                      <span className="text-[13px] font-medium opacity-30">로컬 입찰 이력이 없습니다</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {/* API Data Rows */}
                  {dataSource === "api" && listings.map((item) => (
                    <ListingRow
                      key={item.sellerBiddingNo}
                      item={item}
                      isSelected={selectedIds.has(item.sellerBiddingNo)}
                      onSelect={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(item.sellerBiddingNo) ? next.delete(item.sellerBiddingNo) : next.add(item.sellerBiddingNo);
                          return next;
                        });
                      }}
                      editingPrice={editingPrice[item.sellerBiddingNo]}
                      onEditPrice={(val) => setEditingPrice(prev => ({ ...prev, [item.sellerBiddingNo]: val }))}
                      onConfirmPrice={() => handlePriceUpdate(item)}
                      onCancelEdit={() => setEditingPrice(prev => { const next = { ...prev }; delete next[item.sellerBiddingNo]; return next; })}
                      onCancelBid={() => handleCancel(item.sellerBiddingNo)}
                      isCancelling={cancellingIds.has(item.sellerBiddingNo)}
                    />
                  ))}

                  {/* Local Data Rows */}
                  {dataSource === "local" && localHistory.map((item) => (
                    <LocalHistoryRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.seller_bidding_no || item.id)}
                      onSelect={() => {
                        const id = item.seller_bidding_no || item.id;
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(id) ? next.delete(id) : next.add(id);
                          return next;
                        });
                      }}
                      onCancelBid={() => item.seller_bidding_no && handleCancel(item.seller_bidding_no)}
                      isCancelling={cancellingIds.has(item.seller_bidding_no || "")}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-secondary/5 text-[12px]">
            <span className="text-muted-foreground font-medium">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}건
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-secondary hover:bg-secondary disabled:opacity-30 font-medium"
              >
                이전
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = startPage + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 rounded border font-medium ${
                      p === page
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-secondary hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-secondary hover:bg-secondary disabled:opacity-30 font-medium"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub Components ─── */

function ListingRow({
  item,
  isSelected,
  onSelect,
  editingPrice,
  onEditPrice,
  onConfirmPrice,
  onCancelEdit,
  onCancelBid,
  isCancelling,
}: {
  item: ListingItem;
  isSelected: boolean;
  onSelect: () => void;
  editingPrice?: string;
  onEditPrice: (val: string) => void;
  onConfirmPrice: () => void;
  onCancelEdit: () => void;
  onCancelBid: () => void;
  isCancelling: boolean;
}) {
  const isEditing = editingPrice !== undefined;
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.active;

  return (
    <tr className="hover:bg-secondary/5 transition-colors h-16 group">
      <td className="px-2 text-center border-r border-secondary/10">
        <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5" />
      </td>
      <td className="px-4 border-r border-secondary/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary/10 border border-secondary/20 rounded-lg p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
            {item.image ? (
              <img src={item.image} className="max-w-full max-h-full object-contain" alt="" />
            ) : (
              <ImageIcon size={16} className="opacity-10" />
            )}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[12px] text-foreground/80 truncate">{item.productName || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <span className="font-mono tracking-tight">상품번호: {item.articleNumber}</span>
              {item.sizeInfo && <span className="font-bold">{item.sizeInfo}</span>}
            </div>
            <span className="text-[9px] text-muted-foreground/30 font-mono">SPU_ID: {item.spuId}</span>
          </div>
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <div className="flex flex-col items-center leading-tight text-[11px]">
          <span className="font-bold text-foreground/60">{item.brandName}</span>
          <span className="text-[9px] text-muted-foreground/40">{item.categoryName}</span>
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 font-bold text-foreground/50 text-[12px]">
        {item.quantity}
      </td>
      <td className="px-2 text-center border-r border-secondary/10 bg-primary/[0.01]">
        {isEditing ? (
          <div className="flex items-center gap-1 justify-center">
            <div className="relative">
              <input
                type="text"
                value={editingPrice}
                onChange={(e) => onEditPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onConfirmPrice()}
                className="w-20 text-[11px] py-1 pl-3 pr-1 bg-background border border-primary/30 rounded text-right font-mono font-bold outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] opacity-30">₩</span>
            </div>
            <button onClick={onConfirmPrice} className="p-0.5 text-emerald-600 hover:bg-emerald-500/10 rounded">
              <Check size={12} />
            </button>
            <button onClick={onCancelEdit} className="p-0.5 text-muted-foreground hover:bg-secondary rounded">
              <X size={12} />
            </button>
          </div>
        ) : (
          <span className="font-bold text-[13px] text-foreground/70">
            {item.price > 0 ? `₩${item.price.toLocaleString()}` : "—"}
          </span>
        )}
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40 font-bold">
        {item.bidFailCount > 0 ? (
          <span className="text-destructive">{item.bidFailCount}</span>
        ) : "—"}
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">
        {item.cnMarketInfo}
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">
        {item.krMarketInfo}
      </td>
      <td className="px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onEditPrice(String(item.price))}
            className="text-[10px] px-2 py-1 border border-primary/20 text-primary rounded hover:bg-primary/5 font-bold transition-colors"
          >
            <Pencil size={10} className="inline mr-0.5" />
            수정
          </button>
          <button
            onClick={onCancelBid}
            disabled={isCancelling}
            className="text-[10px] px-2 py-1 border border-destructive/20 text-destructive rounded hover:bg-destructive/5 font-bold transition-colors disabled:opacity-30"
          >
            {isCancelling ? <Loader2 size={10} className="animate-spin inline" /> : <Trash2 size={10} className="inline mr-0.5" />}
            취소
          </button>
        </div>
      </td>
    </tr>
  );
}

function LocalHistoryRow({
  item,
  isSelected,
  onSelect,
  onCancelBid,
  isCancelling,
}: {
  item: BidHistoryItem;
  isSelected: boolean;
  onSelect: () => void;
  onCancelBid: () => void;
  isCancelling: boolean;
}) {
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.active;
  const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <tr className="hover:bg-secondary/5 transition-colors h-14 group">
      <td className="px-2 text-center border-r border-secondary/10">
        <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5" />
      </td>
      <td className="px-4 border-r border-secondary/10">
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="font-bold text-[12px] text-foreground/70 truncate">{item.product_name || "—"}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span className="font-mono tracking-tight">{item.article_number}</span>
            {item.size_info && <span className="font-bold">{item.size_info}</span>}
          </div>
          <span className="text-[9px] text-muted-foreground/30 font-mono">SKU: {item.sku_id} · {createdDate}</span>
        </div>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">—</td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">1</td>
      <td className="px-2 text-center border-r border-secondary/10 bg-primary/[0.01]">
        <span className="font-bold text-[13px] text-foreground/70">
          ₩{item.bid_price.toLocaleString()}
        </span>
      </td>
      <td className="px-2 text-center border-r border-secondary/10">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">—</td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">—</td>
      <td className="px-2 text-center border-r border-secondary/10 text-[11px] text-foreground/40">—</td>
      <td className="px-2 text-center">
        {item.seller_bidding_no && item.status === "active" && (
          <button
            onClick={onCancelBid}
            disabled={isCancelling}
            className="text-[10px] px-2 py-1 border border-destructive/20 text-destructive rounded hover:bg-destructive/5 font-bold transition-colors disabled:opacity-30"
          >
            {isCancelling ? <Loader2 size={10} className="animate-spin" /> : "취소"}
          </button>
        )}
      </td>
    </tr>
  );
}
