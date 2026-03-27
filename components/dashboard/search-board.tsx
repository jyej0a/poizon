"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Loader2, Gavel, ExternalLink, ImageIcon, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, Settings2, ArrowLeftRight, X,
  Trash2, ChevronLeft, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";
import { executeBidding, type BidPayload } from "@/app/actions/bidding";
import { getSkuRecommendations } from "@/app/actions/recommendations";
import { getNaverShoppingResults } from "@/app/actions/naver";
import { getSystemSettings } from "@/app/actions/settings";
import { calculateMargin, type SystemSettings } from "@/lib/utils/calculate-margin";
import { MarginSettingsDialog } from "./margin-settings-dialog";

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

  const [pageSize, setPageSize] = useState(50);
  const [lastBrandKeyword, setLastBrandKeyword] = useState("");

  // 페이징 관련 State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 네이버 쇼핑 및 마진용 State
  const [naverResults, setNaverResults] = useState<Record<string, any>>({});
  const [loadingNaver, setLoadingNaver] = useState<Record<string, boolean>>({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // 네이버 상세 팝업용 State
  const [selectedNaverItems, setSelectedNaverItems] = useState<any[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 열 너비 조절 기능
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    info: 340,
    avg: 100,
    naver: 110,
    exposure: 120,
    salesChina: 90,
    salesLocal: 90,
    bid: 160,
    manage: 70
  });

  const [resizing, setResizing] = useState<string | null>(null);

  useEffect(() => {
    const savedWidths = localStorage.getItem('poizon_dashboard_widths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (e) {
        console.error("Failed to parse saved widths", e);
      }
    }
  }, []);

  const handleResizeStart = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizing(column);
    
    const startX = e.pageX;
    const startWidth = columnWidths[column];
    
    const handleMouseMove = (updateEvent: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (updateEvent.pageX - startX));
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const saveWidths = () => {
    localStorage.setItem('poizon_dashboard_widths', JSON.stringify(columnWidths));
    alert("열 너비 설정이 저장되었사옵니다.");
  };

  React.useEffect(() => {
    const fetchSettings = async () => {
      const res = await getSystemSettings();
      if (res.success && res.data) {
        setSystemSettings(res.data as any);
      }
    };
    fetchSettings();
  }, []);

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

  const getMargin = (priceStr?: string, cost?: number) => {
    if (!priceStr || !systemSettings) return null;
    const price = Number(priceStr);
    if (!price || price <= 0) return null;
    const margin = calculateMargin(price, systemSettings);
    
    // 네이버 가격(원가)이 제공되면 실제 정산 이익을 계산합니다.
    const actualProfit = cost ? margin.netProfit - cost : margin.netProfit;
    const actualRate = cost ? (actualProfit / cost) * 100 : margin.marginRate;

    return {
      ...margin,
      actualProfit,
      actualRate: parseFloat(actualRate.toFixed(2))
    };
  };

  const calculateNet = (priceStr?: string, cost?: number) => {
    const margin = getMargin(priceStr, cost);
    return margin ? margin.actualProfit : null;
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

  const fetchNaverPrice = async (articleNumber: string) => {
    if (!articleNumber) return;
    setLoadingNaver(prev => ({ ...prev, [articleNumber]: true }));
    try {
      const res = await getNaverShoppingResults(articleNumber);
      if (res.success && res.data) {
        setNaverResults(prev => ({ ...prev, [articleNumber]: res.data }));
      }
    } catch (e) {
      console.error("Failed to fetch naver price", e);
    } finally {
      setLoadingNaver(prev => ({ ...prev, [articleNumber]: false }));
    }
  };

  const parseAndPushItem = (rawData: any, targetArray: any[], term: string) => {
    let apiData = rawData.data || rawData;
    if (Array.isArray(apiData)) apiData = apiData[0] || {};
    const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
    const skuList = apiData.skuInfoList || apiData.skuList || apiData.skus || spuInfo.skuList || [];
    
    if (!spuInfo.spuId && !spuInfo.goodsId && !spuInfo.title) return;
    
    const articleNum = spuInfo.articleNumber || spuInfo.goodsNo || term || "N/A";
    
    // 네이버 검색 트리거 (이미 검색 중인 경우 제외)
    if (articleNum !== "N/A" && !naverResults[articleNum] && !loadingNaver[articleNum]) {
      fetchNaverPrice(articleNum);
    }

    targetArray.push({
      id: spuInfo.spuId || spuInfo.goodsId || term,
      articleNumber: articleNum,
      brand: spuInfo.brandName || spuInfo.brand || "-",
      category: spuInfo.level2CategoryName || spuInfo.categoryName || "-",
      title: spuInfo.title || spuInfo.spuTitle || spuInfo.goodsName || "Unknown Product",
      image: spuInfo.logoUrl || spuInfo.images?.[0] || spuInfo.image || spuInfo.imgUrl || skuList[0]?.image || null,
      skus: skuList,
      raw: rawData,
      salesVolume: rawData.spuStats?.commoditySales?.totalSoldNum30 ??
                   rawData.spuStats?.commoditySales?.soldNum30 ?? 
                   rawData.spuStats?.commoditySales?.globalSoldNum30 ?? 
                   rawData.spuStats?.salesAmount ?? "-",
      localSalesVolume: rawData.spuStats?.commoditySales?.localSoldNum30 ?? 
                        rawData.spuStats?.commoditySales?.soldNum ?? "-",
      minPrice: rawData.spuStats?.marketPrice?.globalMarketPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.globalMinPriceVO?.amountText ?? 
                rawData.spuStats?.minPrice?.price ?? 
                rawData.spuStats?.authPriceVO?.amountText ??
                rawData.spuStats?.authPrice?.amount ?? "-",
      avgPrice: rawData.spuStats?.averagePrice?.averagePriceVO?.amountText ??
                rawData.spuStats?.averagePrice?.averagePrice?.amount ??
                rawData.spuStats?.averagePrice?.globalAveragePriceVO?.amountText ?? 
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
            <button 
              onClick={saveWidths}
              className="text-[11px] px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 flex items-center gap-1.5 transition-colors font-bold"
            >
              <ArrowLeftRight size={14} /> 열 너비 유지
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-[11px] px-3 py-1.5 border border-secondary rounded-lg hover:bg-secondary flex items-center gap-1.5 transition-colors font-medium"
            >
              <Settings2 size={14} /> 마진 설정
            </button>
            <button onClick={handleBatchBid} disabled={Object.values(selectedSkus).filter(Boolean).length === 0 || isBidding} className="text-[11px] px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-30"><Gavel size={14} /> 일괄 입찰</button>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar w-full">
          <table className={`w-full text-[13px] text-left whitespace-nowrap table-fixed border-collapse ${resizing ? 'cursor-col-resize select-none' : ''}`}>
            <thead className="text-[11px] text-muted-foreground bg-background sticky top-0 z-20 shadow-sm border-b uppercase font-bold tracking-wider">
              <tr className="bg-secondary/5 h-10">
                <th style={{ width: '40px' }} className="px-1 text-center border-r border-secondary/10"><input type="checkbox" className="w-3.5 h-3.5" /></th>
                
                <th style={{ width: `${columnWidths.info}px` }} className="relative group/header px-4 border-r border-secondary/10">
                  <span>중국 시장 정보</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'info')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.avg}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-primary/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5">
                    <span>최근 30일</span>
                    <span>평균 거래가</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'avg')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.exposure}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-orange-500/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5">
                    <span>중국 노출가</span>
                    <span className="text-[8px] opacity-60">예상 수익 포함</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'exposure')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.naver}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.03]">
                  <span>네이버 최저/원가</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'naver')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.salesChina}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-primary/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5 text-[9px]">
                    <span>중국 30일 판매량</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'salesChina')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.salesLocal}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-secondary/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5 text-[9px]">
                    <span>현지 30일 판매량</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'salesLocal')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.bid}px` }} className="relative group/header px-1 text-center border-r border-secondary/10">
                  <span>나의 입찰 제안</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'bid')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.manage}px` }} className="relative group/header px-1 text-center">
                  <span>관리</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {items.length === 0 ? (
                <tr><td colSpan={8} className="py-24 text-center text-muted-foreground opacity-50 text-[13px] font-medium italic">검색을 시작해 주소서.</td></tr>
              ) : (
                items.map((item, idx) => {
                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isExpanded = !!expandedRows[item.id];
                  return (
                    <React.Fragment key={`${item.articleNumber}-${idx}`}>
                      <tr className={`hover:bg-secondary/5 transition-colors group h-14 ${isExpanded ? 'bg-secondary/[0.02]' : ''}`}>
                        <td className="px-1 text-center border-r border-secondary/10">
                         <div className="flex flex-col items-center gap-1.5">
                           <input type="checkbox" className="w-3 h-3" />
                           {item.skuDetails?.length > 0 && (
                             <button onClick={() => toggleRow(item.id, item.skuDetails)} className="text-muted-foreground/40 hover:text-primary transition-colors">
                               {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                             </button>
                           )}
                         </div>
                        </td>
                        <td className="px-4 border-r border-secondary/10 overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
                              {item.image ? <img src={item.image} className="w-full h-full object-contain" /> : <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />}
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">{item.brand}</span>
                                <span className="font-bold text-foreground text-[12px] truncate tracking-tight">{item.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                                <span className="font-mono text-primary/70">{item.articleNumber}</span>
                                <span className="opacity-30">|</span>
                                <span>{item.category}</span>
                                {isBiddable && <span className="ml-1 bg-emerald-500/10 text-emerald-600 text-[8px] px-1 py-0.5 rounded border border-emerald-500/20">입찰 가능</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01] font-bold text-foreground/80">
                          {item.avgPrice !== "-" ? (typeof item.avgPrice === 'string' && item.avgPrice.includes('₩') ? item.avgPrice : `₩${Number(item.avgPrice).toLocaleString()}`) : "—"}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-orange-500/[0.01] leading-none">
                            <div className="font-bold text-[11px] text-orange-600/80 mb-0.5 italic shrink-0">
                                {item.minPrice !== "-" ? (typeof item.minPrice === 'string' && item.minPrice.includes('₩') ? item.minPrice : `₩${Number(item.minPrice).toLocaleString()}`) : "—"}
                            </div>
                            {naverResults[item.articleNumber]?.length > 0 && item.minPrice !== "-" && (
                              (() => {
                                const naverPrice = Number(naverResults[item.articleNumber][0].lprice);
                                if (isNaN(naverPrice)) return null;
                                
                                const rawPriceStr = typeof item.minPrice === 'string' ? item.minPrice.replace(/[^0-9]/g, "") : String(item.minPrice);
                                const poizonPrice = Number(rawPriceStr);
                                
                                if (isNaN(poizonPrice) || poizonPrice <= 0) return null;
                                
                                const potentialMargin = calculateMargin(poizonPrice, systemSettings);
                                const estimatedProfit = potentialMargin.netProfit - naverPrice;
                                return (
                                  <span className={`text-[9px] font-bold ${estimatedProfit > 0 ? 'text-blue-500' : 'text-destructive/50'}`}>
                                    수익: ₩{Math.round(estimatedProfit).toLocaleString()}
                                  </span>
                                );
                              })()
                            )}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.01] font-bold text-emerald-600">
                          <div className="flex flex-col items-center justify-center -space-y-0.5">
                            {loadingNaver[item.articleNumber] ? (
                              <Loader2 size={12} className="animate-spin opacity-40" />
                            ) : naverResults[item.articleNumber] && naverResults[item.articleNumber].length > 0 ? (
                              <>
                                <button 
                                  onClick={() => { setSelectedNaverItems(naverResults[item.articleNumber]); setIsModalOpen(true); }}
                                  className="hover:underline flex items-center gap-1 group/link"
                                >
                                  ₩{Number(naverResults[item.articleNumber][0].lprice).toLocaleString()}
                                  <ExternalLink size={10} className="opacity-30 group-hover/link:opacity-100" />
                                </button>
                                <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">{naverResults[item.articleNumber][0].mallName}</span>
                              </>
                            ) : (
                              <span className="opacity-20">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/70">{item.salesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-secondary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/50">{item.localSalesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 text-[10px] text-muted-foreground/30 italic font-bold">SELECT SKU</td>
                        <td className="px-1 text-center border-secondary/10">
                          <button onClick={() => removeItem(idx)} className="p-1.5 text-muted-foreground/20 hover:text-destructive hover:bg-destructive/5 rounded-md transition-all mx-auto"><Trash2 size={14}/></button>
                        </td>
                      </tr>

                      {isExpanded && item.skuDetails?.map((sku: any) => {
                        const rec = skuRecommendations[sku.skuId];
                        const isLoadingRec = loadingRecommendations[sku.skuId];
                        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                        const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                        const skuPrice = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "—";
                        const exposurePrice = rec?.priceRangeItems?.find((p: any) => p.title?.includes("노출"))?.price;
                         const bidPrice = biddingPrices[sku.skuId];
                         const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
                         const margin = getMargin(bidPrice, naverPrice ? Number(naverPrice) : undefined);
                         
                         return (
                           <tr key={sku.skuId} className="bg-secondary/[0.04] text-[11px] h-12 border-b border-dashed border-secondary/20">
                             <td className="border-r border-secondary/5 border-dashed"><input type="checkbox" checked={!!selectedSkus[sku.skuId]} onChange={() => toggleSkuSelection(sku.skuId)} className="w-3 h-3 mx-auto block" /></td>
                             <td className="px-4 border-r border-secondary/5 border-dashed">
                               <div className="flex items-center gap-3 pl-6">
                                 <div className="w-8 h-8 bg-white border border-secondary/10 rounded-md p-1 shrink-0 flex items-center justify-center shadow-xs">
                                   {sku.image ? <img src={sku.image} className="max-w-full max-h-full object-contain" /> : <ImageIcon size={14} className="opacity-5"/>}
                                 </div>
                                 <div className="flex flex-col min-w-0 leading-tight">
                                   <div className="flex items-center gap-2">
                                     <span className="font-bold text-foreground/70 truncate">{propsStr}</span>
                                     <span className="bg-emerald-500/5 text-emerald-600/60 text-[8px] px-1 py-0.5 rounded border border-emerald-500/10 font-bold shrink-0">입찰 가능</span>
                                   </div>
                                   <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter">SKUID: {sku.skuId}</span>
                                 </div>
                               </div>
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-primary/[0.01] font-bold text-foreground/60 leading-tight">
                               <div className="text-[11px]">
                                 {(() => {
                                   const avgObj = sku.averagePrice;
                                   const avg = avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0;
                                   return avg > 0 ? `₩${Number(avg).toLocaleString()}` : "—";
                                 })()}
                               </div>
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-orange-500/[0.01] leading-none">
                               <div className="cursor-pointer hover:underline font-bold text-orange-600/70 block mb-0.5 text-[11px]" onClick={() => (rec?.globalMinPrice || skuPrice) && handleBiddingPriceChange(sku.skuId, String(rec?.globalMinPrice || skuPrice))}>
                                 {isLoadingRec ? <Loader2 size={10} className="animate-spin mx-auto opacity-20"/> : (typeof (rec?.globalMinPrice || skuPrice) === 'number' ? `₩${(rec?.globalMinPrice || skuPrice).toLocaleString()}` : (rec?.globalMinPrice || skuPrice))}
                               </div>
                               {margin && (
                                 <span className={`text-[8px] font-bold ${margin.actualProfit > 0 ? 'text-blue-500' : 'text-destructive/50'}`}>
                                   수익: ₩{Math.round(margin.actualProfit).toLocaleString()}
                                 </span>
                               )}
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-emerald-500/[0.01] font-bold text-emerald-600/70">
                                <div className="flex flex-col items-center justify-center">
                                  {naverPrice ? (
                                    <span className="hover:underline cursor-pointer">₩{Number(naverPrice).toLocaleString()}</span>
                                  ) : <span className="opacity-10">—</span>}
                                </div>
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-primary/[0.01]">
                               <div className="font-bold text-[11px] text-foreground/40">{sku.commoditySales?.totalSoldNum30 ?? sku.commoditySales?.soldNum30 ?? sku.commoditySales?.globalSoldNum30 ?? "—"}</div>
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-secondary/[0.01]">
                               <div className="font-bold text-[11px] text-foreground/40">{sku.commoditySales?.localSoldNum30 ?? sku.commoditySales?.soldNum ?? "—"}</div>
                             </td>
                             <td className="px-1 text-center border-r border-dashed bg-blue-500/[0.01]">
                               <div className="flex items-center justify-between px-2 gap-2">
                                 {margin ? (
                                   <div className="flex flex-col items-center leading-none gap-0.5 min-w-[50px]">
                                     <span className={`font-bold text-[11px] ${margin.actualProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                       {margin.actualProfit > 0 ? "▲" : "▼"} ₩{Math.round(margin.actualProfit).toLocaleString()}
                                     </span>
                                     <span className="text-[9px] font-bold opacity-30">{margin.actualRate}%</span>
                                   </div>
                                 ) : <div className="min-w-[50px] opacity-10 text-[9px] font-bold">READY</div>}
                                 
                                 <div className="flex flex-col items-center justify-center flex-1">
                                   <div className="relative group/input w-full max-w-[100px] mx-auto">
                                     <input type="text" value={bidPrice ? Number(bidPrice).toLocaleString() : ""} onChange={(e) => handleBiddingPriceChange(sku.skuId, e.target.value)} className="w-full text-[11px] py-1 pl-4 pr-1.5 bg-background border border-secondary/30 rounded-md text-right font-mono font-bold focus:ring-1 focus:ring-primary/30 outline-none transition-all" placeholder="0" />
                                     <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-20 group-focus-within/input:opacity-50">₩</span>
                                   </div>
                                   {bidPrice && <span className="text-[8px] text-muted-foreground/40 mt-0.5 font-bold uppercase tracking-tighter">NET: ₩{calculateNet(bidPrice, naverPrice ? Number(naverPrice) : undefined)?.toLocaleString()}</span>}
                                 </div>
                               </div>
                             </td>
                            <td className="px-2 text-center">
                              <button 
                                onClick={() => handleSingleBid(sku.skuId, item.id)} 
                                disabled={!bidPrice || isBidding} 
                                className="px-5 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all uppercase tracking-wider italic mx-auto block"
                              >
                                BID
                              </button>
                            </td>
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

      {/* Naver Search Results Modal */}
      {isModalOpen && selectedNaverItems && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-secondary shadow-2xl rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-[13px]">
            <div className="flex items-center justify-between p-4 border-b bg-secondary/10">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center text-white text-[10px] font-bold">N</div>
                  네이버 쇼핑 검색 결과
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">메이저 종합몰 • 낮은 가격순 정렬</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-secondary/20 rounded-full transition-colors">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-secondary/5">
              <div className="grid gap-3">
                {selectedNaverItems.length > 0 ? (
                  selectedNaverItems.map((item, i) => (
                    <a 
                      key={i} 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-3 bg-card hover:bg-white border border-secondary/30 rounded-xl transition-all group shadow-sm hover:shadow-md"
                    >
                      <div className="w-16 h-16 bg-white border border-secondary/10 rounded-lg overflow-hidden shrink-0 shadow-xs p-1">
                        <img src={item.image} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">{item.mallName}</span>
                          <span className="text-[10px] text-muted-foreground/50 font-medium">{item.category3}</span>
                        </div>
                        <h4 className="text-[13px] font-bold text-foreground/80 truncate group-hover:text-primary transition-colors" dangerouslySetInnerHTML={{ __html: item.title }} />
                        <div className="mt-2 text-lg font-black text-foreground/90 tracking-tight">
                          ₩{Number(item.lprice).toLocaleString()}
                        </div>
                      </div>
                      <div className="px-2">
                        <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-muted-foreground bg-card rounded-2xl border border-dashed border-secondary/50">
                    <Search className="w-8 h-8 opacity-10 mb-2" />
                    <p className="text-[13px] font-medium opacity-40">화이트리스트에 등록된 종합몰 결과가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t bg-background flex justify-between items-center">
              <p className="text-[11px] text-muted-foreground font-medium italic">* 최저가는 배송비가 제외된 금액일 수 있사옵니다.</p>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-secondary/80 transition-colors uppercase"
                >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Margin Settings Dialog */}
      <MarginSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialData={systemSettings}
        onSuccess={(newData) => setSystemSettings(newData as SystemSettings)}
      />
    </div>
  );
}
