"use client";

import React, { useState } from "react";
import { 
  Search, Loader2, Image as ImageIcon, Trash2, Calculator, Gavel, Hash, Tag as TagIcon, 
  ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight 
} from "lucide-react";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";
import { executeBidding, type BidPayload } from "@/app/actions/bidding";
import { getSkuRecommendations } from "@/app/actions/recommendations";

export function SearchBoard() {
  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<"article" | "brand">("article");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // 입찰가 액션용 State
  const [biddingPrices, setBiddingPrices] = useState<Record<string, string>>({});
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>({});

  // 추천 입찰가 데이터용 State
  const [skuRecommendations, setSkuRecommendations] = useState<Record<string, any>>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState<Record<string, boolean>>({});

  // 페이징 관련 State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [lastBrandKeyword, setLastBrandKeyword] = useState("");

  const toggleRow = (id: string, skus?: any[]) => {
    const isNowExpanded = !expandedRows[id];
    setExpandedRows(prev => ({ ...prev, [id]: isNowExpanded }));

    if (isNowExpanded && skus && skus.length > 0) {
      skus.forEach(sku => {
        if (!skuRecommendations[sku.skuId] && !loadingRecommendations[sku.skuId]) {
          fetchRecommendation(sku.skuId);
        }
      });
    }
  };

  const fetchRecommendation = async (skuId: string | number) => {
    setLoadingRecommendations(prev => ({ ...prev, [skuId]: true }));
    try {
      const res = await getSkuRecommendations(skuId);
      if (res.success && res.data) {
        setSkuRecommendations(prev => ({ ...prev, [skuId]: res.data }));
      }
    } catch (e) {
      console.error("Failed to fetch recommendation", e);
    } finally {
      setLoadingRecommendations(prev => ({ ...prev, [skuId]: false }));
    }
  };

  const toggleSkuSelection = (skuId: string) => {
    setSelectedSkus(prev => ({ ...prev, [skuId]: !prev[skuId] }));
  };

  const handleBiddingPriceChange = (skuId: string, value: string) => {
    const numStr = value.replace(/[^0-9]/g, "");
    setBiddingPrices(prev => ({ ...prev, [skuId]: numStr }));
  };

  const calculateNet = (priceStr?: string) => {
    if (!priceStr) return null;
    const price = Number(priceStr);
    if (!price || price <= 0) return null;
    const fee = Math.max(15000, Math.min(price * 0.1, 45000));
    return price - fee;
  };

  const [isBidding, setIsBidding] = useState(false);

  const handleSingleBid = async (skuId: string | number, spuId: string | number) => {
    const priceStr = biddingPrices[String(skuId)];
    if (!priceStr) return;
    const price = Number(priceStr);
    
    setIsBidding(true);
    try {
      const res = await executeBidding([{ skuId, spuId, price }]);
      if (res.success) {
        alert("입찰 요청이 성공적으로 처리되었습니다.");
      } else {
        const detailMsg = res.data?.[0]?.message || res.error;
        alert(`입찰 실패: ${detailMsg}`);
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  const handleBatchBid = async () => {
    const selectedIds = Object.keys(selectedSkus).filter(id => selectedSkus[id]);
    if (selectedIds.length === 0) return;

    const payloads: BidPayload[] = [];
    for (const skuId of selectedIds) {
      const priceStr = biddingPrices[skuId];
      if (priceStr && Number(priceStr) > 0) {
        payloads.push({ skuId, price: Number(priceStr) });
      }
    }

    if (payloads.length === 0) {
      alert("선택된 옵션 중 입찰가가 입력된 항목이 없습니다.");
      return;
    }

    setIsBidding(true);
    try {
      const res = await executeBidding(payloads);
      if (res.success) {
        alert(`${payloads.length}건의 일괄 입찰 요청이 성공적으로 처리되었습니다.`);
        setSelectedSkus({});
      } else {
        const failedCount = res.data?.filter((r: any) => !r.success).length || 0;
        const firstErrorStr = res.data?.find((r: any) => !r.success)?.message || res.error;
        alert(`${failedCount}건 입찰 실패. 대표 사유: ${firstErrorStr}`);
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  const handleSearch = async (page: number = 1) => {
    const searchKeyword = (page === 1) ? keyword.trim() : lastBrandKeyword;
    if (!searchKeyword) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const newItems: any[] = [];
      
      if (searchType === "article") {
        const searchTerms = searchKeyword.split(",").map(k => k.trim()).filter(k => k.length > 0);
        for (const term of searchTerms) {
          const res = await searchPoizonItems(term);
          if (res.success && res.data) {
             let itemData = res.data.data || res.data;
             if (Array.isArray(itemData)) itemData = itemData[0];
             
             if (itemData) {
               const spuId = Number(itemData.spuInfo?.spuId || itemData.spuId || itemData.goodsId);
               if (spuId) {
                  const statsRes = await getSpuStatistics([spuId]);
                  if (statsRes.success && statsRes.data.length > 0) {
                     itemData.skuStats = statsRes.data[0].skuSaleInfos || statsRes.data[0].skuInfoList || [];
                     itemData.spuStats = statsRes.data[0].spuSaleInfo || statsRes.data[0].spuInfo || {};
                  }
               }
               parseAndPushItem(itemData, newItems, term);
             }
          }
        }
        if (newItems.length > 0) {
          setItems(prev => [...newItems, ...prev]);
          setKeyword("");
        }
      } else {
        const res = await searchPoizonByBrand(searchKeyword, page, pageSize);
        if (res.success && res.data) {
          let results: any[] = [];
          if (Array.isArray(res.data.data?.contents)) results = res.data.data.contents;
          else if (Array.isArray(res.data.contents)) results = res.data.contents;
          else if (Array.isArray(res.data.data?.list)) results = res.data.data.list;
          else if (Array.isArray(res.data.list)) results = res.data.list;
          else if (Array.isArray(res.data.data)) results = res.data.data;
          
          if (results.length === 0) {
            setError("검색 결과가 없습니다.");
            if (page === 1) setItems([]);
          } else {
            const spuIds = [...new Set(results.map(i => Number(i.spuId || i.goodsId)).filter(id => !isNaN(id)))];
            const statsRes = await getSpuStatistics(spuIds);
            
            if (statsRes.success && statsRes.data) {
               const statsMap = new Map();
               for (const statItem of statsRes.data) {
                  const spuData = statItem.spuSaleInfo || statItem.spuInfo || statItem;
                  const sId = Number(spuData?.spuId || spuData?.goodsId);
                  if (sId) statsMap.set(sId, statItem);
               }
               results = results.map(item => {
                  const sId = Number(item.spuId || item.goodsId);
                  const st = statsMap.get(sId);
                  return { ...item, skuStats: st?.skuInfoList || st?.skuSaleInfos || [], spuStats: st?.spuSaleInfo || st?.spuInfo || st || {} };
               });
            }

            for (const item of results) {
              parseAndPushItem(item, newItems, searchKeyword);
            }
            
            setItems(newItems);
            setTotalCount(res.total || 0);
            setCurrentPage(page);
            setLastBrandKeyword(searchKeyword);
            if (page === 1) setKeyword("");
          }
        } else {
          setError(res.error || "검색 무효");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndPushItem = (rawData: any, targetArray: any[], term: string) => {
    let apiData = rawData.data || rawData;
    if (Array.isArray(apiData)) apiData = apiData[0] || {};
    const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
    const skuList = apiData.skuInfoList || apiData.skuList || apiData.skus || spuInfo.skuList || [];
    
    if (!spuInfo.spuId && !spuInfo.goodsId && !spuInfo.title) return;
    
    targetArray.push({
      id: spuInfo.spuId || spuInfo.goodsId || term,
      articleNumber: spuInfo.articleNumber || spuInfo.goodsNo || "N/A",
      brand: spuInfo.brandName || spuInfo.brand || "-",
      category: spuInfo.level2CategoryName || spuInfo.categoryName || "-",
      title: spuInfo.title || spuInfo.spuTitle || spuInfo.goodsName || "Unknown Product",
      image: spuInfo.logoUrl || spuInfo.images?.[0] || spuInfo.image || spuInfo.imgUrl || skuList[0]?.image || null,
      skus: skuList,
      raw: rawData,
      salesVolume: rawData.spuStats?.commoditySales?.globalSoldNum30 ?? rawData.spuStats?.salesAmount ?? rawData.spuStats?.transactionVolume ?? "-",
      localSalesVolume: rawData.spuStats?.commoditySales?.localSoldNum30 ?? "-",
      minPrice: rawData.spuStats?.marketPrice?.globalMarketPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.globalMinPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.price ?? 
                rawData.spuStats?.authPriceVO?.amountText ??
                rawData.spuStats?.authPrice?.amount ?? "-",
      avgPrice: rawData.spuStats?.averagePrice?.globalAveragePriceVO?.amountText ?? 
                rawData.spuStats?.averagePrice?.globalAveragePrice?.amount ?? "-",
      skuDetails: rawData.skuStats || [],
      spuStats: rawData.spuStats || {},
    });
  };

  const removeItem = (indexToRemove: number) => {
    setItems(items.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="h-full flex flex-col gap-2 w-full">
      {/* Search Header - Compact */}
      <div className="bg-card border border-secondary/40 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex bg-secondary/30 p-1 rounded-lg shrink-0">
            <button onClick={() => setSearchType("article")} className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${searchType === "article" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>품번</button>
            <button onClick={() => setSearchType("brand")} className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${searchType === "brand" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>브랜드</button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder={searchType === "article" ? "품번 (콤마 구분)" : "브랜드명"} className="w-full pl-9 pr-4 py-2 bg-secondary/30 border-none rounded-lg outline-none text-[13px]" />
          </div>
          <button onClick={() => handleSearch(1)} disabled={isLoading || !keyword.trim()} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold disabled:opacity-50">조회</button>
        </div>
      </div>

      {/* Workspace Area - Full Width */}
      <div className="flex-1 bg-card border border-secondary/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-secondary/5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">비딩 워크스페이스</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{items.length} 건</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 transition-colors font-medium"><Calculator size={14} /> 마진 설정</button>
            <button onClick={handleBatchBid} disabled={Object.values(selectedSkus).filter(Boolean).length === 0 || isBidding} className="text-[11px] px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-30"><Gavel size={14} /> 일괄 입찰</button>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-[13px] text-left whitespace-nowrap table-fixed">
            <thead className="text-[11px] text-muted-foreground bg-background sticky top-0 z-20 shadow-sm border-b uppercase font-semibold tracking-wider">
              <tr className="bg-secondary/10">
                <th className="w-10 px-1 py-3 text-center border-r border-secondary/20"><input type="checkbox" className="w-3.5 h-3.5" /></th>
                <th className="w-[450px] px-4 py-3 border-r border-secondary/20 min-w-[300px]">상품 및 판매 정보</th>
                <th className="w-28 px-1 py-3 text-center border-r border-secondary/20 bg-primary/[0.03]">최저가</th>
                <th className="w-24 px-1 py-3 text-center border-r border-secondary/20 bg-primary/[0.03]">노출가</th>
                <th className="w-28 px-1 py-3 text-center border-r border-secondary/20 bg-primary/[0.03]">평균가</th>
                <th className="w-24 px-1 py-3 text-center border-r border-secondary/20 bg-primary/[0.03]">판매량</th>
                <th className="w-12 px-1 py-3 text-center border-r border-secondary/20">관심</th>
                <th className="w-36 px-1 py-3 text-center border-r border-secondary/20">나의 제안</th>
                <th className="w-16 px-1 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {items.length === 0 ? (
                <tr><td colSpan={9} className="py-24 text-center text-muted-foreground opacity-50 text-[13px]">검색을 시작해 주소서.</td></tr>
              ) : (
                items.map((item, idx) => {
                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isExpanded = !!expandedRows[item.id];
                  return (
                    <React.Fragment key={`${item.articleNumber}-${idx}`}>
                      <tr className="hover:bg-secondary/5 transition-colors group h-14">
                        <td className="px-1 text-center border-r">
                         <div className="flex flex-col items-center gap-1">
                           <input type="checkbox" className="w-3 h-3" />
                           {item.skuDetails?.length > 0 && (
                             <button onClick={() => toggleRow(item.id, item.skuDetails)} className="text-muted-foreground/50 hover:text-primary">
                               {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                             </button>
                           )}
                         </div>
                        </td>
                        <td className="px-4 border-r border-secondary/20 overflow-hidden">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 shrink-0 bg-white border border-secondary/30 rounded-lg p-1 relative shadow-sm">
                              {item.image ? <img src={item.image} className="w-full h-full object-contain" /> : <ImageIcon size={18} className="opacity-10 mx-auto mt-3" />}
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 leading-tight">
                              <div className="flex items-center gap-2 overflow-hidden mb-1">
                                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">{item.brand}</span>
                                <span className="font-semibold text-foreground text-[13px] truncate tracking-tight">{item.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 font-medium">
                                <span className="font-mono opacity-80">#{item.articleNumber}</span>
                                <span className="opacity-60">•</span>
                                <span>{item.category}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 text-center border-r bg-primary/[0.01] font-bold">
                          {item.minPrice !== "-" ? `₩${item.minPrice.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-1 text-center border-r bg-primary/[0.01] text-muted-foreground">—</td>
                        <td className="px-1 text-center border-r bg-primary/[0.01] font-medium opacity-80">
                          {item.avgPrice !== "-" ? `₩${item.avgPrice.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/20 bg-primary/[0.01] leading-none">
                          <div className="font-semibold text-[13px]">{item.salesVolume}+</div>
                          <div className="text-[10px] text-muted-foreground mt-1 opacity-50 font-medium">KR: {item.localSalesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/20 text-muted-foreground/20 italic">☆</td>
                        <td className="px-1 text-center border-r border-secondary/20 text-[11px] text-muted-foreground opacity-40 italic font-medium">옵션 선택 필요</td>
                        <td className="px-1 text-center">
                          <button onClick={() => removeItem(idx)} className="text-muted-foreground/30 hover:text-destructive flex mx-auto transition-colors"><Trash2 size={16}/></button>
                        </td>
                      </tr>

                      {isExpanded && item.skuDetails?.map((sku: any) => {
                        const rec = skuRecommendations[sku.skuId];
                        const isLoadingRec = loadingRecommendations[sku.skuId];
                        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                        const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                        const skuPrice = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "—";
                        const exposurePrice = rec?.priceRangeItems?.find((p: any) => p.title?.includes("노출"))?.price;
                        
                        return (
                          <tr key={sku.skuId} className="bg-secondary/5 text-[12px] h-12 border-b border-dashed border-secondary/30">
                            <td className="border-r border-secondary/10 border-dashed"><input type="checkbox" checked={!!selectedSkus[sku.skuId]} onChange={() => toggleSkuSelection(sku.skuId)} className="w-3 h-3 mx-auto block" /></td>
                            <td className="px-4 border-r border-secondary/10 border-dashed">
                              <div className="flex items-center gap-3 pl-8">
                                <div className="w-8 h-8 bg-white border border-secondary/20 rounded-md p-1 shrink-0 flex items-center justify-center shadow-xs">
                                  {sku.image ? <img src={sku.image} className="max-w-full max-h-full object-contain" /> : <ImageIcon size={14} className="opacity-10"/>}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-foreground/80 truncate">{propsStr}</span>
                                  <span className="text-[10px] text-muted-foreground/50 font-mono leading-none mt-0.5">ID: {sku.skuId}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.02] font-bold">
                              <div className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleBiddingPriceChange(sku.skuId, String(rec?.globalMinPrice || skuPrice))}>
                                {isLoadingRec ? <Loader2 size={10} className="animate-spin mx-auto"/> : `₩${(rec?.globalMinPrice || skuPrice).toLocaleString()}`}
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.02] font-bold text-emerald-600">
                              <div className="cursor-pointer hover:underline" onClick={() => exposurePrice && handleBiddingPriceChange(sku.skuId, String(exposurePrice))}>
                                {isLoadingRec ? <Loader2 size={10} className="animate-spin mx-auto"/> : (exposurePrice ? `₩${exposurePrice.toLocaleString()}` : "—")}
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.02] opacity-50">₩{sku.averagePrice?.price?.toLocaleString() || "—"}</td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.02] leading-none">
                              <div className="font-bold text-xs">{sku.commoditySales?.globalSoldNum30}+</div>
                              <div className="text-[10px] opacity-40">KR:{sku.commoditySales?.localSoldNum30}</div>
                            </td>
                            <td className="border-r border-dashed"></td>
                            <td className="px-2 border-r border-dashed">
                              <div className="flex flex-col items-center">
                                <div className="relative">
                                  <input type="text" value={biddingPrices[sku.skuId] ? Number(biddingPrices[sku.skuId]).toLocaleString() : ""} onChange={(e) => handleBiddingPriceChange(sku.skuId, e.target.value)} className="w-24 text-sm px-2 py-0.5 border rounded text-right font-mono" />
                                  <span className="absolute left-1.5 top-1 text-[10px] opacity-30">₩</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground opacity-50 mt-0.5">{calculateNet(biddingPrices[sku.skuId])?.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-2 text-center"><button onClick={() => handleSingleBid(sku.skuId, item.id)} disabled={!biddingPrices[sku.skuId] || isBidding} className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-bold">입찰</button></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Mini */}
        {searchType === "brand" && totalCount > pageSize && (
          <div className="px-4 py-2 border-t bg-secondary/10 flex items-center justify-between text-xs">
            <div className="text-muted-foreground">총 {totalCount.toLocaleString()}개</div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleSearch(1)} disabled={currentPage === 1 || isLoading} className="p-1.5 rounded hover:bg-secondary disabled:opacity-20"><ChevronsLeft size={14} /></button>
              <button onClick={() => handleSearch(currentPage - 1)} disabled={currentPage === 1 || isLoading} className="p-1.5 rounded hover:bg-secondary disabled:opacity-20"><ChevronLeft size={14} /></button>
              <span className="px-3 font-bold text-primary">{currentPage} / {Math.ceil(totalCount / pageSize)}</span>
              <button onClick={() => handleSearch(currentPage + 1)} disabled={currentPage >= Math.ceil(totalCount / pageSize) || isLoading} className="p-1.5 rounded hover:bg-secondary disabled:opacity-20"><ChevronRight size={14} /></button>
              <button onClick={() => handleSearch(Math.ceil(totalCount / pageSize))} disabled={currentPage >= Math.ceil(totalCount / pageSize) || isLoading} className="p-1.5 rounded hover:bg-secondary disabled:opacity-20"><ChevronsRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
