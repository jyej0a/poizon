"use client";

import React, { useState } from "react";
import { Search, Loader2, Image as ImageIcon, Trash2, Calculator, Gavel, Hash, Tag as TagIcon, ChevronRight, ChevronDown } from "lucide-react";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";

export function SearchBoard() {
  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<"article" | "brand">("article");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const newItems: any[] = [];
      
      if (searchType === "article") {
        // 콤마(,) 구분으로 여러 품번 동시 검색
        const searchTerms = keyword.split(",").map(k => k.trim()).filter(k => k.length > 0);
        for (const term of searchTerms) {
          const res = await searchPoizonItems(term);
          if (res.success && res.data) {
             const itemData = res.data.data || res.data;
             const spuId = Number(itemData.spuInfo?.spuId || itemData.spuId);
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
      } else {
        // 브랜드 검색 (최대 20개 노출)
        const res = await searchPoizonByBrand(keyword.trim());
        if (res.success && res.data) {
          // 브랜드 SPU 조회 API는 data.contents 혹은 data.list 형태 배열을 반환함
          let results: any[] = [];
          if (Array.isArray(res.data.data?.contents)) results = res.data.data.contents;
          else if (Array.isArray(res.data.contents)) results = res.data.contents;
          else if (Array.isArray(res.data.data?.list)) results = res.data.data.list;
          else if (Array.isArray(res.data.list)) results = res.data.list;
          else if (Array.isArray(res.data.data)) results = res.data.data;
          else results = [];
                          
          if (results.length === 0) {
            setError("해당 브랜드의 최신 상품 목록이 존재하지 않습니다.");
          } else {
            // 통계 일괄 조회 (배치 사이즈 5는 서버 액션에서 알아서 분할해줌)
            const spuIds = [...new Set(results.map(i => Number(i.spuId || i.goodsId)).filter(id => !isNaN(id)))];
            const statsRes = await getSpuStatistics(spuIds);
            
            if (!statsRes.success) {
               setError("Stats API Error: " + statsRes.error);
            }
            
            if (statsRes.success && statsRes.data) {
               const statsMap = new Map();
               for (const statItem of statsRes.data) {
                  // spuSaleInfo (SPU 레벨) 혹은 spuInfo (대체)
                  const spuData = statItem.spuSaleInfo || statItem.spuInfo || statItem;
                  const sId = Number(spuData?.spuId || spuData?.goodsId);
                  if (sId) statsMap.set(sId, statItem);
               }
               results = results.map(item => {
                  const sId = Number(item.spuId || item.goodsId);
                  const st = statsMap.get(sId);
                  return {
                     ...item,
                     skuStats: st?.skuInfoList || st?.skuSaleInfos || [],
                     spuStats: st?.spuSaleInfo || st?.spuInfo || st || {}
                  };
               });
            }

            for (const item of results) {
              parseAndPushItem(item, newItems, keyword);
            }
          }
        } else {
          setError(res.error || "브랜드 검색 중 오류가 발생했습니다.");
        }
      }

      if (newItems.length > 0) {
        setItems(prev => [...newItems, ...prev]);
        setKeyword(""); 
      } else if (!error) {
        setError("검색된 상품이 없습니다.");
      }
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndPushItem = (rawData: any, targetArray: any[], term: string) => {
    let apiData = rawData.data || rawData;
    if (Array.isArray(apiData)) apiData = apiData[0] || {};
    
    // 배열 자체를 순회할 때는 rawData가 개별 SPU일 가능성이 크므로 분기 처리
    const spuInfo = apiData.spuInfo || apiData.spuList?.[0] || apiData.spuDetails || apiData;
    const skuList = apiData.skuInfoList || apiData.skuList || apiData.skus || spuInfo.skuList || [];
    
    // 브랜드 검색은 spuId등이 다를 수 있음
    if (!spuInfo.spuId && !spuInfo.goodsId && !spuInfo.title) return; // 무의미한 데이터 필터
    
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
    <div className="flex flex-col gap-6 h-full">
      {/* Search Header */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* 검색 타입 토글 */}
          <div className="flex bg-secondary/50 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setSearchType("article")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${searchType === "article" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Hash size={16} /> 품번 (Article)
            </button>
            <button 
              onClick={() => setSearchType("brand")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${searchType === "brand" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <TagIcon size={16} /> 브랜드 (Brand)
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input 
              type="text" 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "article" 
                ? "여러 개의 품번을 콤마(,)로 구분하여 한 번에 검색하세요 (예: CZ3596-100, DD1391-100)" 
                : "브랜드명(예: Nike, Adidas)을 입력하여 인기 상품을 대량으로 불러오세요"
              } 
              className="w-full pl-9 pr-4 py-2.5 bg-secondary/50 border border-transparent focus-visible:bg-background focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary rounded-xl outline-none transition-all text-sm"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={isLoading || !keyword.trim()}
            className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : "조회 및 추가"}
          </button>
        </div>
        {error && <p className="text-destructive text-sm mt-3">{error}</p>}
      </div>

      {/* Main Table Area */}
      <div className="flex-1 bg-card border rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-secondary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">작업 목록 (Bidding Workspace)</h2>
            <span className="bg-secondary px-2.5 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
              {items.length} 건
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <span>정렬 기준:</span>
              <select className="bg-background border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="none">기본순</option>
                <option value="salesAmount">최근 30일 판매량순 (조회 필요)</option>
                <option value="priceDesc">가격 높은순</option>
                <option value="priceAsc">가격 낮은순</option>
              </select>
            </div>
            
            <button className="px-4 py-1.5 border rounded-lg hover:bg-secondary text-sm font-medium transition-colors flex items-center gap-1.5 text-muted-foreground">
              <Calculator size={14} />
              선택 마진 계산
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left whitespace-nowrap min-w-[1200px]">
            <thead className="text-xs text-muted-foreground bg-secondary/30 sticky top-0 z-10 shadow-sm border-b">
              <tr>
                <th rowSpan={2} className="px-4 py-3 font-medium w-12 text-center border-r border-b">
                  <input type="checkbox" className="rounded border-gray-300 w-4 h-4 cursor-pointer accent-primary" />
                </th>
                <th rowSpan={2} className="px-4 py-3 font-medium border-r border-b">POIZON 상품 정보</th>
                <th rowSpan={2} className="px-4 py-3 font-medium text-center border-r border-b">브랜드/카테고리</th>
                <th rowSpan={2} className="px-4 py-3 font-medium text-center border-r border-b">상태</th>
                <th colSpan={4} className="px-4 py-2 font-medium text-center border-b border-r bg-primary/5">🇨🇳 중국 시장</th>
                <th rowSpan={2} className="px-4 py-3 font-medium text-center border-r border-b">관심 상품</th>
                <th rowSpan={2} className="px-4 py-3 font-medium text-center border-r border-b">입찰 완료 여부</th>
                <th rowSpan={2} className="px-4 py-3 font-medium text-center border-b">작업</th>
              </tr>
              <tr className="bg-primary/5">
                <th className="px-4 py-2 font-medium text-center border-r border-b text-xs">최근 30일 평균 거래가</th>
                <th className="px-4 py-2 font-medium text-center border-r border-b text-xs">중국 노출</th>
                <th className="px-4 py-2 font-medium text-center border-r border-b text-xs">중국 시장 최근 30일 판매량</th>
                <th className="px-4 py-2 font-medium text-center border-r border-b text-xs">현지 판매자 최근 30일 판매량</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-32 text-center bg-secondary/5">
                    <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                      <Search className="h-10 w-10 opacity-20" />
                      <p className="text-base">검색어를 입력하여 작업 목록을 구성하세요.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isExpanded = !!expandedRows[item.id];
                  
                  return (
                    <React.Fragment key={`${item.articleNumber}-${idx}`}>
                    <tr className="hover:bg-secondary/10 transition-colors group">
                      <td className="px-4 py-4 text-center border-r">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 w-4 h-4 cursor-pointer accent-primary" />
                          {item.skuDetails && item.skuDetails.length > 0 && (
                            <button onClick={() => toggleRow(item.id)} className="p-0.5 hover:bg-secondary rounded text-muted-foreground w-5 h-5 flex items-center justify-center shrink-0">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r">
                        <div className="flex items-center gap-4 min-w-[280px]">
                          <div className="w-16 h-16 bg-white border border-gray-100 rounded-lg p-1 shrink-0 flex items-center justify-center shadow-sm">
                            {item.image ? (
                              <img src={item.image} alt="product" className="max-w-full max-h-full object-contain" />
                            ) : (
                              <ImageIcon className="text-muted-foreground/30 h-6 w-6" />
                            )}
                          </div>
                          <div className="flex flex-col truncate max-w-[280px] space-y-1">
                            <div className="text-muted-foreground text-xs font-mono">
                              상품 번호: <span className="font-semibold text-foreground">{item.articleNumber}</span>
                            </div>
                            <div className="font-semibold text-foreground truncate text-[13px]" title={item.title}>
                              {item.title}
                            </div>
                            <div className="text-muted-foreground text-[11px]">
                              SPU_ID : {item.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle">
                        <div className="flex flex-col items-center justify-center space-y-1 text-xs">
                          <span className="font-medium text-foreground">{item.brand}</span>
                          <span className="text-muted-foreground">{item.category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle">
                         <span className={`px-2 py-1 text-[11px] font-medium rounded border ${isBiddable ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                           {isBiddable ? '입찰 가능' : '제한됨'}
                         </span>
                      </td>
                      
                      {/* 중국 시장 Data */}
                      <td className="px-4 py-4 text-center border-r align-middle bg-primary/[0.02]">
                        <span className="text-muted-foreground font-semibold">
                          {item.avgPrice && item.avgPrice !== "-" ? (item.avgPrice.toString().includes(",") ? `₩${item.avgPrice}` : `₩${Number(item.avgPrice).toLocaleString()}`) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle bg-primary/[0.02]">
                        <span className="text-muted-foreground font-semibold">
                          {item.minPrice && item.minPrice !== "-" ? (item.minPrice.toString().includes(",") ? `₩${item.minPrice}` : `₩${Number(item.minPrice).toLocaleString()}`) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle bg-primary/[0.02]">
                        <span className="text-muted-foreground font-semibold">{(item.salesVolume && item.salesVolume !== "-") ? `${item.salesVolume}+` : "—"}</span>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle bg-primary/[0.02]">
                        <span className="text-muted-foreground font-semibold">
                           {item.localSalesVolume && item.localSalesVolume !== "-" ? (Number(item.localSalesVolume) === 0 ? "<5" : item.localSalesVolume) : "—"}
                        </span>
                      </td>
                      
                      <td className="px-4 py-4 text-center border-r align-middle">
                        <button className="text-muted-foreground hover:text-amber-400 transition-colors">
                          ☆
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center border-r align-middle">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs">—</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <button className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors font-medium">
                            바로 입찰
                          </button>
                          <button 
                            className="text-[11px] text-muted-foreground hover:text-primary underline transition-colors"
                          >
                            상세 정보
                          </button>
                          <button 
                            onClick={() => removeItem(idx)}
                            className="text-[11px] text-destructive hover:underline mt-1"
                          >
                            목록에서 제거
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded SKU rows */}
                    {isExpanded && item.skuDetails && item.skuDetails.length > 0 && item.skuDetails.map((sku: any) => {
                        // SKU properties handling
                        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                        const propsStr = propsRaw.map((p: any) => `${p.name || p.levelName}: ${p.value || p.propertyValue}`).join(" / ") || "상세 옵션 없음";
                        
                        // SKU price handling
                        const rawSkuPrice = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price;
                        const skuPrice = rawSkuPrice ? (rawSkuPrice.toString().includes(",") ? `₩${rawSkuPrice}` : `₩${Number(rawSkuPrice).toLocaleString()}`) : "—";
                        
                        // SKU sales handling
                        const skuSales = sku.commoditySales?.globalSoldNum30 ?? sku.salesAmount ?? sku.transactionVolume ?? "—";
                        
                        // Barcode handling
                        const localBarcode = sku.barCode || sku.authCode || sku.barcode;
                        
                        return (
                          <tr key={sku.skuId} className="bg-secondary/5 hover:bg-secondary/15 transition-colors text-xs border-b border-dashed">
                             <td className="px-4 py-3 text-center border-r border-dashed">
                               <input type="checkbox" className="rounded border-gray-300 w-3 h-3 cursor-pointer accent-primary ml-6" />
                             </td>
                             <td className="px-4 py-3 border-r border-dashed">
                               <div className="flex items-center gap-3 min-w-[280px] pl-6">
                                  <div className="w-10 h-10 bg-white border border-gray-100 rounded p-0.5 flex items-center justify-center shadow-sm">
                                    {sku.image || sku.logoUrl || item.image ? <img src={sku.image || sku.logoUrl || item.image} alt="sku" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="h-4 w-4 opacity-30"/>}
                                  </div>
                                  <div className="flex flex-col space-y-0.5">
                                     <span className="font-semibold text-foreground">{propsStr}</span>
                                     <span className="text-muted-foreground font-mono text-[10px]">SKU_ID: {sku.skuId}</span>
                                     {localBarcode && <span className="text-muted-foreground font-mono text-[10px]">바코드: {localBarcode}</span>}
                                  </div>
                               </div>
                             </td>
                             <td className="px-4 py-3 text-center border-r border-dashed">
                                 <span className="text-muted-foreground">{item.brand}</span>
                             </td>
                             <td className="px-4 py-3 text-center border-r border-dashed">
                                <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${sku.buyStatus === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                  {sku.buyStatus === 1 ? '입찰 가능' : '제한됨'}
                                </span>
                             </td>
                             <td className="px-4 py-3 text-center border-r border-dashed font-semibold text-foreground">
                                {skuPrice}
                             </td>
                             <td className="px-4 py-3 text-center border-r border-dashed text-muted-foreground">—</td>
                             <td className="px-4 py-3 text-center border-r border-dashed font-semibold text-foreground">
                                {skuSales}{skuSales !== "—" && "+"}
                             </td>
                             <td className="px-4 py-3 text-center border-r border-dashed text-muted-foreground">{"<5"}</td>
                             <td className="px-4 py-3 text-center border-r border-dashed"></td>
                             <td className="px-4 py-3 text-center border-r border-dashed text-muted-foreground">미입찰</td>
                             <td className="px-4 py-3 text-center align-middle">
                               <button className="text-[10px] px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded transition-colors font-medium">
                                 바로 입찰
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
      </div>
    </div>
  );
}
