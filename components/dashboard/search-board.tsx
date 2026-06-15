"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Loader2, Gavel, ExternalLink, ImageIcon, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, Settings2, ArrowLeftRight, X,
  Trash2, Ban, ChevronLeft, ChevronsLeft, ChevronsRight, Copy, Check, Clock, Filter
} from "lucide-react";
import { searchPoizonItems, searchPoizonByBrand, getSpuStatistics } from "@/app/actions/poizon";
import { executeBidding, getBidHistoryBySpuIds, type BidPayload } from "@/app/actions/bidding";
import { getSkuRecommendations } from "@/app/actions/recommendations";
import { getNaverShoppingResults } from "@/app/actions/naver";
import { getSystemSettings } from "@/app/actions/settings";
import { getExcludedArticles, addExcludedArticle } from "@/app/actions/excluded-articles";
import { getSkippedItems, addSkippedItems, removeSkippedItems } from "@/app/actions/skipped-items";
import { calculateMargin, type SystemSettings } from "@/lib/utils/calculate-margin";
import { MarginSettingsDialog } from "./margin-settings-dialog";

function extractSkuListFromStat(statItem: any): any[] {
  if (!statItem) return [];
  if (Array.isArray(statItem)) {
    return statItem.flatMap((item) => extractSkuListFromStat(item));
  }
  const nested = statItem.skuInfoList || statItem.skuSaleInfos;
  if (Array.isArray(nested) && nested.length > 0) return nested;
  if (statItem.skuId || statItem.regionSkuId) return [statItem];
  return [];
}

function resolveSkuDetails(rawData: any, skuList: any[]): any[] {
  const fromStats = rawData.skuStats;
  if (Array.isArray(fromStats) && fromStats.length > 0) {
    const extracted = fromStats.flatMap((item) => extractSkuListFromStat(item));
    if (extracted.length > 0) return extracted;
  }
  return skuList;
}

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

  // 품번 제외용 State
  const [excludedArticles, setExcludedArticles] = useState<string[]>([]);
  const [isExcludeModalOpen, setIsExcludeModalOpen] = useState(false);
  const [itemToExclude, setItemToExclude] = useState<{ articleNumber: string, title: string, idx: number } | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [isExcluding, setIsExcluding] = useState(false);

  // 열 너비 조절 기능
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    info: 340,
    avg: 100,
    naver: 110,
    exposure: 120,
    profit: 100,
    salesChina: 90,
    salesLocal: 90,
    bid: 160,
    manage: 70,
    skip: 60
  });

  const [skippedSkuIds, setSkippedSkuIds] = useState<Set<string>>(new Set());

  const [resizing, setResizing] = useState<string | null>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [bidHistory, setBidHistory] = useState<Record<string, { price: number, date: string }>>({});
  const [showOnlyProfitable, setShowOnlyProfitable] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("전체");

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

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, skippedRes] = await Promise.all([
        getSystemSettings(),
        getSkippedItems()
      ]);
      
      if (settingsRes.success && settingsRes.data) {
        setSystemSettings(settingsRes.data as any);
      }
      
      if (skippedRes.success && skippedRes.data) {
        setSkippedSkuIds(new Set(skippedRes.data.map((item: any) => String(item.sku_id))));
      }
    };
    fetchData();
  }, []);

  // 입찰 이력 동기화 로직
  const fetchBidHistory = async () => {
    // ... items state 대신 실제 표시되는 행들의 ID 수집
    const targetItems = showOnlyProfitable 
      ? Array.from(new Set(flattenedRows.map(r => r.parent))) 
      : items;

    const identifiers = targetItems.map(item => {
      const numericId = Number(String(item.id).replace(/[^0-9]/g, ""));
      return {
        spuId: isNaN(numericId) ? null : numericId,
        articleNumber: item.articleNumber
      };
    }).filter(id => id.spuId !== null || id.articleNumber);

    if (identifiers.length === 0) return;

    const spuIds = identifiers.map(id => id.spuId).filter((id): id is number => id !== null);
    const res = await getBidHistoryBySpuIds(spuIds);
    
    if (res.success && res.data) {
      const historyMap: Record<string, { price: number, date: string }> = {};
      res.data.forEach((entry: any) => {
        const sId = String(entry.spu_id);
        if (!historyMap[sId]) {
          historyMap[sId] = {
            price: entry.bid_price,
            date: new Date(entry.created_at).toLocaleDateString('ko-KR', { month: '6', day: 'numeric' }).replace('.', '월').replace('.', '일')
          };
        }
      });
      setBidHistory(historyMap);
    }
  };

  useEffect(() => {
    if (items.length > 0) {
      fetchBidHistory();
    }
  }, [items]);

  const toggleRow = (id: string, skus?: any[]) => {
    // 알짜배기 목록(Flattened) 모드에서는 아코디언이 필요 없사옵니다.
    if (showOnlyProfitable) return;
    
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

  React.useEffect(() => {
    setBiddingPrices(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(skuRecommendations).forEach(skuId => {
        if (!next[skuId]) {
          const rec = skuRecommendations[skuId];
          const exposurePr = rec?.leakInfos?.find((l: any) => (l.buyerRegion === "CN" || l.region === "CN"))?.leakPrice ?? rec?.globalMinPrice;
          if (exposurePr) {
            next[skuId] = String(exposurePr);
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [skuRecommendations]);

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

  const handleToggleSkip = async (itemOrSku: any, isSku = false) => {
    // 1. 토글할 SKU ID 목록을 먼저 확정하옵니다.
    const skuIdsToToggle: string[] = isSku 
      ? [String(itemOrSku.skuId)]
      : (itemOrSku.skuDetails || []).map((sku: any) => String(sku.skuId));

    if (skuIdsToToggle.length === 0 && !isSku) {
      // SKU 정보가 없으면 articleNumber만이라도 기록하여 마마의 수고를 덜어드립시다. (미구현 SKU 대응)
      return;
    }

    // 2. 현재 상태를 확인하옵니다.
    const isCurrentlySkipped = isSku 
      ? skippedSkuIds.has(String(itemOrSku.skuId))
      : skuIdsToToggle.length > 0 && skuIdsToToggle.every(id => skippedSkuIds.has(id));

    // 3. [낙관적 업데이트] 서버 응답 전에 화면부터 즉시 바꾸어 마마를 기쁘게 해드립시다.
    setSkippedSkuIds(prev => {
      const next = new Set(prev);
      if (isCurrentlySkipped) {
        skuIdsToToggle.forEach(id => next.delete(id));
      } else {
        skuIdsToToggle.forEach(id => next.add(id));
      }
      return next;
    });

    try {
      if (isCurrentlySkipped) {
        // 해제
        await removeSkippedItems(skuIdsToToggle);
      } else {
        // 추가
        const itemsToSkip = isSku 
          ? [{ sku_id: String(itemOrSku.skuId), spu_id: String(itemOrSku.parent?.id || ""), article_number: itemOrSku.parent?.articleNumber }]
          : itemOrSku.skuDetails.map((sku: any) => ({
              sku_id: String(sku.skuId),
              spu_id: String(itemOrSku.id),
              article_number: itemOrSku.articleNumber
            }));
            
        await addSkippedItems(itemsToSkip);
      }
    } catch (error) {
      console.error("Failed to toggle skip", error);
      // 실패 시 다시 원래대로 되돌려 정직한 장부를 유지하옵니다.
      setSkippedSkuIds(prev => {
        const next = new Set(prev);
        if (isCurrentlySkipped) {
          skuIdsToToggle.forEach(id => next.add(id));
        } else {
          skuIdsToToggle.forEach(id => next.delete(id));
        }
        return next;
      });
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

  // 알짜배기 목록(Flattened View)을 위한 계산 로직
  const flattenedRows = React.useMemo(() => {
    if (!showOnlyProfitable) return [];
    
    const rows: any[] = [];
    items.forEach(item => {
      const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
      const skus = item.skuDetails || [];
      
      skus.forEach(sku => {
        const skuPriceRaw = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "0";
        const skuPriceNum = Number(String(skuPriceRaw).replace(/[^0-9]/g, ""));
        
        let profit = -999999;
        if (naverPrice && skuPriceNum > 0 && systemSettings) {
          const { fee } = calculateMargin(skuPriceNum, systemSettings);
          profit = skuPriceNum - fee - Number(naverPrice);
        }

        // 필터 로직: 
        // 1. 네이버 가격 로딩 중이면 일단 노출 (마마 말씀대로 아무것도 안 뜨면 안 되기에)
        // 2. 가격이 있는데 수익이 0 이하이면 제외
        if (naverPrice && profit <= 0) return;

        rows.push({
          ...sku,
          parent: item,
          profit,
          naverPrice: naverPrice ? Number(naverPrice) : null,
          skuPrice: skuPriceRaw
        });
      });
    });
    return rows;
  }, [items, naverResults, showOnlyProfitable, systemSettings]);

  // --- 카테고리 목록 추출 ---
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    const sortedCategories = Array.from(set).sort();
    return ["전체", ...sortedCategories];
  }, [items]);

  // --- 필터링된 목록 계산 ---
  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
      const categoryMatch = selectedCategory === "전체" || item.category === selectedCategory;
      if (!categoryMatch) return false;
      
      if (showOnlyProfitable) {
        // 기존 수익 상품 필터 로직
        const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
        const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
        if (naverPrice && !isNaN(poizonPriceNum) && poizonPriceNum > 0 && systemSettings) {
          const { fee } = calculateMargin(poizonPriceNum, systemSettings);
          const profit = poizonPriceNum - fee - Number(naverPrice);
          return profit > 0;
        }
        return false;
      }
      return true;
    });
  }, [items, selectedCategory, showOnlyProfitable, naverResults, systemSettings]);

  const filteredFlattenedRows = React.useMemo(() => {
    return flattenedRows.filter(row => {
      const categoryMatch = selectedCategory === "전체" || row.parent.category === selectedCategory;
      return categoryMatch;
    });
  }, [flattenedRows, selectedCategory]);

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
        fetchBidHistory();
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
        fetchBidHistory();
      } else {
        const failedCount = (res.data as any)?.filter?.((r: any) => !r.success)?.length || 0;
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
        
        // 1. 모든 품번을 병렬로 동시 검색 (속도 개선 1)
        const searchPromises = searchTerms.map(term => searchPoizonItems(term));
        const searchResults = await Promise.all(searchPromises);
        
        const validItemDataList: { data: any, term: string }[] = [];
        const spuIdsForStats: number[] = [];
        
        searchResults.forEach((res, index) => {
          if (res.success && res.data) {
            let itemData = res.data.data || res.data;
            if (Array.isArray(itemData)) itemData = itemData[0];
            
            if (itemData) {
              validItemDataList.push({ data: itemData, term: searchTerms[index] });
              const sId = Number(itemData.spuInfo?.spuId || itemData.spuId || itemData.goodsId);
              if (sId) spuIdsForStats.push(sId);
            }
          }
        });

        // 2. 통계 정보를 한꺼번에 일괄 요청 (속도 개선 2)
        if (spuIdsForStats.length > 0) {
          const [statsResKR, statsResCN] = await Promise.all([
            getSpuStatistics(spuIdsForStats, ["KR"]),
            getSpuStatistics(spuIdsForStats, ["CN"])
          ]);

          const statsMapKR = new Map();
          const statsMapCN = new Map();

          if (statsResKR.success && statsResKR.data.KR) {
            statsResKR.data.KR.forEach((st: any) => {
              const id = st.spuSaleInfo?.spuId || st.spuInfo?.spuId || st.spuId;
              if (id) statsMapKR.set(Number(id), st);
            });
          }
          if (statsResCN.success && statsResCN.data.CN) {
            statsResCN.data.CN.forEach((st: any) => {
              const id = st.spuSaleInfo?.spuId || st.spuInfo?.spuId || st.spuId;
              if (id) statsMapCN.set(Number(id), st);
            });
          }

          // 검색된 데이터에 통계 정보 병합
          validItemDataList.forEach(itemEntry => {
            const sId = Number(itemEntry.data.spuInfo?.spuId || itemEntry.data.spuId || itemEntry.data.goodsId);
            const stKR = statsMapKR.get(sId);
            const stCN = statsMapCN.get(sId);
            
            if (stKR) {
              itemEntry.data.skuStats = extractSkuListFromStat(stKR);
              itemEntry.data.spuStats = stKR.spuSaleInfo || stKR.spuInfo || {};
            }
            if (stCN) {
              itemEntry.data.spuStatsCN = stCN.spuSaleInfo || stCN.spuInfo || {};
              itemEntry.data.skuStatsCN = extractSkuListFromStat(stCN);
            }
          });
        }

        // 3. 파싱 및 결과 목록에 추가 (네이버 검색은 여기서 순차적으로 트리거됨)
        validItemDataList.forEach(itemEntry => {
          parseAndPushItem(itemEntry.data, newItems, itemEntry.term);
        });
        
        const curExcludedRes = await getExcludedArticles();
        const curExcluded = curExcludedRes.success && curExcludedRes.data ? curExcludedRes.data.map((r: any) => r.article_number) : [];
        setExcludedArticles(curExcluded);
        const filteredItems = newItems.filter(item => !curExcluded.includes(item.articleNumber));

        if (filteredItems.length > 0) {
          setItems(prev => [...filteredItems, ...prev]);
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
            const spuIds = results.map((item: any) => item.spuId || item.goodsId).filter(Boolean);
            if (spuIds.length > 0) {
              const [statsResKR, statsResCN] = await Promise.all([
                getSpuStatistics(spuIds, ["KR"]),
                getSpuStatistics(spuIds, ["CN"])
              ]);
              
              const statsMapKR = new Map();
              const statsMapCN = new Map();

              const dataKR = statsResKR.success ? statsResKR.data.KR : [];
              const dataCN = statsResCN.success ? statsResCN.data.CN : [];

              if (statsResKR.success && dataKR) {
                 for (const statItem of dataKR) {
                    const spuData = statItem.spuSaleInfo || statItem.spuInfo || statItem;
                    const sId = Number(spuData?.spuId || spuData?.goodsId);
                    if (sId) statsMapKR.set(sId, statItem);
                 }
              }
              
              if (statsResCN.success && dataCN) {
                 for (const statItem of dataCN) {
                    const spuData = statItem.spuSaleInfo || statItem.spuInfo || statItem;
                    const sId = Number(spuData?.spuId || spuData?.goodsId);
                    if (sId) statsMapCN.set(sId, statItem);
                 }
              }

              results = results.map(item => {
                 const sId = Number(item.spuId || item.goodsId);
                 const stKR = statsMapKR.get(sId);
                 const stCN = statsMapCN.get(sId);
                 return { 
                   ...item, 
                   skuStats: extractSkuListFromStat(stKR), 
                   spuStats: stKR?.spuSaleInfo || stKR?.spuInfo || stKR || {},
                   spuStatsCN: stCN?.spuSaleInfo || stCN?.spuInfo || stCN || {},
                   skuStatsCN: extractSkuListFromStat(stCN)
                 };
              });
            }


            for (const item of results) {
              parseAndPushItem(item, newItems, searchKeyword);
            }
            
            const curExcludedRes = await getExcludedArticles();
            const curExcluded = curExcludedRes.success && curExcludedRes.data ? curExcludedRes.data.map((r: any) => r.article_number) : [];
            setExcludedArticles(curExcluded);
            const filteredItems = newItems.filter(item => !curExcluded.includes(item.articleNumber));
            
            setItems(filteredItems);
            setTotalCount(res.total || 0); // 참고용
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
    
    if (!spuInfo?.title && !rawData?.title) return;
    
    const articleNum = spuInfo.articleNumber || spuInfo.goodsNo || rawData.articleNumber || term || "N/A";
    const spuIdRaw = spuInfo.spuId || spuInfo.goodsId || rawData.spuId || rawData.goodsId;
    const finalId = spuIdRaw ? String(spuIdRaw) : term;
    
    // 네이버 검색 트리거 (이미 검색 중인 경우 제외)
    if (articleNum !== "N/A" && !naverResults[articleNum] && !loadingNaver[articleNum]) {
      fetchNaverPrice(articleNum);
    }

    // 자식(SKU)들의 판매량을 합산하여 SPU 전체 판매량 정의 (HK 데이터 우선)
    const skusKR = resolveSkuDetails(rawData, skuList);
    const skusHK = rawData.skuStatsHK || rawData.skuStatsCN || [];
    
    // 중국 시장 총 판매량: 홍콩(HK) 글로벌 판매량이 0이면 HK SKU 합산, 그것도 0이면 KR 정보
    const spuSalesHK = rawData.spuStatsHK?.commoditySales || {};
    const sumHKGlobal = skusHK.reduce((sum: number, s: any) => sum + (s.commoditySales?.globalSoldNum30 || 0), 0);
    const totalSalesValue = spuSalesHK.globalSoldNum30 || sumHKGlobal || rawData.spuStats?.commoditySales?.globalSoldNum30 || 0;

    // 현지 판매자 판매량: 한국(KR) 로컬 판매량 우선, 0이면 KR SKU의 로컬 합산 (마마의 8, 12건 추적용)
    const spuSalesKR = rawData.spuStats?.commoditySales || {};
    const sumKRLocal = skusKR.reduce((sum: number, s: any) => sum + (s.commoditySales?.localSoldNum30 || 0), 0);
    const localSalesValue = spuSalesKR.localSoldNum30 || sumKRLocal || 0;

    targetArray.push({
      id: finalId,
      articleNumber: articleNum,
      brand: spuInfo.brandName || spuInfo.brand || "-",
      category: spuInfo.level1CategoryName && spuInfo.level2CategoryName 
                ? `${spuInfo.level1CategoryName} > ${spuInfo.level2CategoryName}`
                : spuInfo.level2CategoryName || spuInfo.categoryName || "-",
      title: spuInfo.title || spuInfo.spuTitle || spuInfo.goodsName || rawData.title || "Unknown Product",
      image: spuInfo.logoUrl || spuInfo.images?.[0] || spuInfo.image || spuInfo.imgUrl || skuList[0]?.image || null,
      skus: skuList,
      raw: rawData,
      salesVolume: totalSalesValue > 0 ? `${totalSalesValue.toLocaleString()}${totalSalesValue >= 500 ? "+" : ""}` : "-",
      localSalesVolume: localSalesValue > 0 ? `${localSalesValue.toLocaleString()}` : "-",
      minPrice: (() => {
        const pr = rawData.spuStats?.marketPrice?.globalMarketPriceVO?.amountText ?? 
                  rawData.spuStats?.minPrice?.globalMinPriceVO?.amountText ?? 
                  rawData.spuStats?.minPrice?.price ?? 
                  rawData.spuStats?.authPriceVO?.amountText ??
                  rawData.spuStats?.authPrice?.amount;
        if (!pr) return "-";
        if (typeof pr === 'string' && pr.includes('₩')) return pr;
        const num = Number(String(pr).replace(/[^0-9]/g, ""));
        return isNaN(num) ? "—" : `₩${num.toLocaleString()}`;
      })(),
      avgPrice: (() => {
        const pr = rawData.spuStats?.averagePrice?.averagePriceVO?.amountText ??
                  rawData.spuStats?.averagePrice?.averagePrice?.amount ??
                  rawData.spuStats?.averagePrice?.globalAveragePriceVO?.amountText ?? 
                  rawData.spuStats?.averagePrice?.globalAveragePrice?.amount;
        if (!pr) return "-";
        if (typeof pr === 'string' && pr.includes('₩')) return pr;
        const num = Number(String(pr).replace(/[^0-9]/g, ""));
        return isNaN(num) ? "—" : `₩${num.toLocaleString()}`;
      })(),

      skuDetails: skusKR.map((sk: any) => {
        // 검색 결과(skuList)에서 해당 SKU의 상세 이미지 정보를 찾아 병합하옵니다.
        const originalSku = skuList.find((s: any) => String(s.skuId) === String(sk.skuId));
        return {
          ...sk,
          image: originalSku?.image || originalSku?.logoUrl || sk.image || null
        };
      }),
      skuDetailsHK: skusHK,
      skuStatsCN: rawData.skuStatsCN || [],
      spuStats: rawData.spuStats || {},
      spuStatsCN: rawData.spuStatsCN || {},
      spuStatsHK: rawData.spuStatsHK || {},
    });

  };

  const removeItem = (indexToRemove: number) => {
    setItems(items.filter((_, idx) => idx !== indexToRemove));
  };

  const handleExcludeSubmit = async () => {
    if (!itemToExclude) return;
    setIsExcluding(true);
    try {
      const res = await addExcludedArticle(itemToExclude.articleNumber, itemToExclude.title, excludeReason);
      if (res.success) {
        setExcludedArticles(prev => [...prev, itemToExclude.articleNumber]);
        removeItem(itemToExclude.idx);
        setIsExcludeModalOpen(false);
      } else {
        alert(`제외 처리 실패: ${res.error}`);
      }
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setIsExcluding(false);
    }
  };

  const isSearchExpanded = isHeaderVisible || isInputFocused;
  const toolbarBtn =
    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors";
  const toolbarBtnOutline = `${toolbarBtn} border border-border bg-background hover:bg-secondary/60 text-foreground`;
  const toolbarBtnGhost = `${toolbarBtn} border border-transparent hover:bg-secondary/60 text-muted-foreground`;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Unified workspace card */}
      <div className="flex-1 min-h-0 bg-card border border-border/60 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Search — hover to expand */}
        <div
          className="shrink-0 border-b border-border/40"
          onMouseEnter={() => setIsHeaderVisible(true)}
          onMouseLeave={() => !isInputFocused && setIsHeaderVisible(false)}
        >
          {!isSearchExpanded ? (
            <div
              className="h-2 cursor-n-resize bg-gradient-to-r from-transparent via-primary/25 to-transparent"
              onMouseEnter={() => setIsHeaderVisible(true)}
            />
          ) : (
            <div className={`px-4 py-3 transition-colors ${isInputFocused ? "bg-primary/[0.02]" : "bg-secondary/[0.03]"}`}>
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div className="flex bg-secondary/40 p-0.5 rounded-lg shrink-0 h-9">
                  <button onClick={() => setSearchType("article")} className={`px-3 h-full text-xs font-medium rounded-md transition-all ${searchType === "article" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>품번</button>
                  <button onClick={() => setSearchType("brand")} className={`px-3 h-full text-xs font-medium rounded-md transition-all ${searchType === "brand" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>브랜드</button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder={searchType === "article" ? "품번 (콤마 구분) 입력 후 조회" : "브랜드명 입력 후 조회"}
                    className="w-full h-9 pl-9 pr-4 bg-background border border-border/60 rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">조회수</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
                    >
                      <option value={50}>50개</option>
                      <option value={100}>100개</option>
                      <option value={200}>200개</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleSearch(1)}
                    disabled={isLoading || !keyword.trim()}
                    className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    조회
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Workspace toolbar */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold tracking-tight shrink-0">비딩 워크스페이스</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
              {showOnlyProfitable ? flattenedRows.length : items.length} 건
            </span>
            {error && (
              <div className="flex items-center gap-1.5 text-destructive font-medium text-xs truncate">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border/50">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">분류</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`${toolbarBtnOutline} h-8 min-w-[72px] cursor-pointer`}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowOnlyProfitable(!showOnlyProfitable)}
              className={`${toolbarBtn} border ${
                showOnlyProfitable
                  ? "bg-blue-500/10 border-blue-500/40 text-blue-600"
                  : "border-border bg-background hover:bg-secondary/60 text-muted-foreground"
              }`}
            >
              <Filter size={13} className={showOnlyProfitable ? "fill-blue-600/10" : ""} />
              수익 상품만
            </button>
            <button onClick={saveWidths} className={`${toolbarBtnOutline} text-primary border-primary/30 hover:bg-primary/5`}>
              <ArrowLeftRight size={13} /> 열 너비
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className={toolbarBtnGhost}>
              <Settings2 size={13} /> 마진
            </button>
            <button
              onClick={handleBatchBid}
              disabled={(showOnlyProfitable ? filteredFlattenedRows : filteredItems).length === 0 || Object.values(selectedSkus).filter(Boolean).length === 0 || isBidding}
              className={`${toolbarBtn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30`}
            >
              <Gavel size={13} /> 일괄 입찰
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar w-full">
          <table className={`w-full text-[13px] text-left whitespace-nowrap table-fixed border-collapse ${resizing ? 'cursor-col-resize select-none' : ''}`}>
            <thead className="text-[11px] text-muted-foreground bg-muted/20 sticky top-0 z-20 border-b border-border/40 uppercase font-semibold tracking-wide">
              <tr className="h-10">
                <th style={{ width: `${columnWidths.skip}px` }} className="relative group/header px-1 text-center bg-muted/30 border-r border-border/30">
                  <span>SKIP</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'skip')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: '40px' }} className="px-1 text-center border-r border-secondary/10">  </th>
                
                <th style={{ width: `${columnWidths.info}px` }} className="relative group/header px-4 border-r border-secondary/10">
                  <span>{showOnlyProfitable ? "알짜 수익 상품 (SKU)" : "중국 시장 정보"}</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'info')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.avg}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-primary/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5">
                    <span>30일 거래가</span>
                    <span className="text-[9px] opacity-60">(전 세계 평균)</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'avg')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.exposure}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-orange-500/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-0.5">
                    <span>중국 노출가</span>
                    <span className="text-[8px] opacity-60 hover:opacity-100 transition-opacity">판매자 센터 노출가 기준</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'exposure')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.naver}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.03]">
                  <span>네이버 최저/원가</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'naver')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.profit}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-blue-500/[0.04]">
                  <div className="flex flex-col leading-tight -space-y-0.5">
                    <span>순수익</span>
                    <span className="text-[9px] opacity-60">(노출가-수수료-원가)</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'profit')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.salesChina}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-primary/[0.02]">
                  <div className="flex flex-col leading-tight -space-y-1">
                    <span>30일 판매량</span>
                    <span className="text-[9px] opacity-60">(중국)</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'salesChina')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.salesLocal}px` }} className="relative group/header px-1 text-center border-r border-secondary/10 bg-primary/[0.04]">
                  <div className="flex flex-col leading-tight -space-y-1">
                    <span>30일 판매량</span>
                    <span className="text-[9px] opacity-60">(현지 판매자)</span>
                  </div>
                  <div onMouseDown={(e) => handleResizeStart(e, 'salesLocal')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>

                <th style={{ width: `${columnWidths.bid}px` }} className="relative group/header px-1 text-center border-r border-secondary/10">
                  <span>나의 입찰 제안</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'bid')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
                
                <th style={{ width: `${columnWidths.manage}px` }} className="relative group/header px-1 text-center">
                  <span>관리</span>
                  <div onMouseDown={(e) => handleResizeStart(e, 'manage')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {(!showOnlyProfitable && filteredItems.length === 0) || (showOnlyProfitable && filteredFlattenedRows.length === 0) ? (
                <tr><td colSpan={10} className="py-16 text-center text-muted-foreground/70 text-sm">
                  {items.length === 0 ? "검색을 시작해 주소서." : "해당 분류나 수익 조건에 맞는 보배가 장부에 없사옵니다."}
                </td></tr>
              ) : showOnlyProfitable ? (
                // --- 마마를 위한 알짜배기 목록 (Flattened Mode) ---
                filteredFlattenedRows.map((row, idx) => {
                  const item = row.parent;
                  const sku = row;
                  const rec = skuRecommendations[sku.skuId];
                  const isLoadingRec = loadingRecommendations[sku.skuId];
                  const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                  const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                  const bidPrice = biddingPrices[sku.skuId];
                  const naverPrice = row.naverPrice;
                  const margin = getMargin(bidPrice, naverPrice || undefined);
                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isSkipped = skippedSkuIds.has(String(sku.skuId));

                  return (
                    <tr key={`${sku.skuId}-${idx}`} className={`hover:bg-blue-500/[0.02] transition-colors group h-16 border-l-2 border-l-transparent hover:border-l-blue-500 ${isSkipped ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                      <td className="px-1 text-center bg-secondary/[0.02] border-r border-secondary/10">
                        <input 
                          type="checkbox" 
                          checked={isSkipped} 
                          onChange={(e) => { e.stopPropagation(); handleToggleSkip(row, true); }}
                          className="w-4 h-4 cursor-pointer accent-blue-500 shadow-sm"
                        />
                      </td>
                      <td className="px-1 text-center border-r border-secondary/10">
                        <div className="flex flex-col items-center gap-2 py-1">
                          <input type="checkbox" checked={!!selectedSkus[sku.skuId]} onChange={() => toggleSkuSelection(sku.skuId)} className="w-3.5 h-3.5 accent-primary cursor-pointer shadow-sm" />
                          
                          {/* 입찰 이력 아이콘 및 툴팁 */}
                          {bidHistory[String(item.id)] ? (
                            <div className="relative group/bid-history">
                              <div className="p-1 text-blue-500 bg-blue-500/10 rounded-full cursor-help hover:bg-blue-500/20 transition-colors">
                                <Clock size={12} strokeWidth={3} />
                              </div>
                              {/* 입찰 정보 툴팁 */}
                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/bid-history:block z-[60] animate-in fade-in slide-in-from-left-1 duration-200">
                                <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded shadow-xl whitespace-nowrap font-bold flex items-center gap-1.5 border border-white/10">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  입찰 완료 (₩{bidHistory[String(item.id)].price.toLocaleString()}, {bidHistory[String(item.id)].date})
                                </div>
                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-4 h-4" /> // 이력이 없을 때 정렬 유지용
                          )}
                        </div>
                      </td>
                      <td className="px-4 border-r border-secondary/10 overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
                            {sku.image || item.image ? <img src={sku.image || item.image} className="w-full h-full object-contain" /> : <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />}
                            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="bg-blue-500/10 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">{propsStr}</span>
                              <span className="font-bold text-foreground text-[12px] truncate tracking-tight">{item.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                              <CopyableArticleNumber articleNumber={item.articleNumber} />
                              <span className="opacity-30">|</span>
                              <span className="font-bold text-foreground/40">{item.brand}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* 30일 거래가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01] font-bold text-foreground/60">
                        {(() => {
                           const avgObj = sku.averagePrice;
                           const avg = avgObj?.averagePrice?.amount || avgObj?.globalAveragePrice?.amount || 0;
                           return avg > 0 ? `₩${Number(avg).toLocaleString()}` : "—";
                        })()}
                      </td>
                      {/* 중국 노출가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-orange-500/[0.01] leading-none">
                        <div className="font-bold text-[11px] text-orange-600/80 mb-0.5 italic shrink-0" onClick={() => {
                          const exposurePr = rec?.leakInfos?.find((l: any) => l.buyerRegion === "CN")?.leakPrice ?? rec?.globalMinPrice ?? row.skuPrice;
                          handleBiddingPriceChange(sku.skuId, String(exposurePr));
                        }}>
                          {isLoadingRec ? <Loader2 size={10} className="animate-spin mx-auto opacity-20"/> : (
                            (() => {
                              const exposurePr = rec?.leakInfos?.find((l: any) => l.buyerRegion === "CN")?.leakPrice;
                              const displayPr = exposurePr ?? rec?.globalMinPrice ?? row.skuPrice;
                              if (!displayPr || displayPr === "—") return "—";
                              const numStr = String(displayPr).replace(/[^0-9]/g, "");
                              return numStr ? `₩${Number(numStr).toLocaleString()}` : displayPr;
                            })()
                          )}
                        </div>
                        {row.profit !== -999999 && (
                          <span className={`text-[9px] font-bold ${row.profit > 0 ? 'text-blue-500' : 'text-destructive/50'}`}>
                            수익: ₩{Math.round(row.profit).toLocaleString()}
                          </span>
                        )}
                      </td>
                      {/* 네이버 원가 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-emerald-500/[0.01] font-bold text-emerald-600">
                        <div className="flex flex-col items-center justify-center">
                           {naverPrice ? (
                             <span className="hover:underline cursor-pointer">₩{Number(naverPrice).toLocaleString()}</span>
                           ) : <Loader2 size={12} className="animate-spin opacity-40" />}
                         </div>
                      </td>
                      {/* 순수익 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-blue-500/[0.02]">
                        {(() => {
                          if (!naverPrice || !systemSettings) return <span className="opacity-10 text-[11px]">—</span>;
                          const rawSkuPrice = String(rec?.globalMinPrice || row.skuPrice || "").replace(/[^0-9]/g, "");
                          const poizonSkuPrice = Number(rawSkuPrice);
                          if (isNaN(poizonSkuPrice) || poizonSkuPrice <= 0) return <span className="opacity-10 text-[11px]">—</span>;
                          const { fee: skuFee } = calculateMargin(poizonSkuPrice, systemSettings);
                          const skuProfit = poizonSkuPrice - skuFee - Number(naverPrice);
                          return (
                            <div className="flex flex-col items-center leading-none gap-0.5">
                              <span className={`font-bold text-[12px] ${skuProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                {skuProfit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(skuProfit)).toLocaleString()}
                              </span>
                              <span className="text-[9px] text-muted-foreground/40 font-bold">수수료 ₩{skuFee.toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </td>
                      {/* 판매량 (중국/현지) */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01]">
                         <div className="font-bold text-[11px] text-foreground/50">
                            {(() => {
                              const skuCN = item.skuStatsCN?.find((s: any) => s.skuId === sku.skuId);
                              const val = skuCN?.commoditySales?.globalSoldNum30 ?? sku.commoditySales?.globalSoldNum30;
                              return val !== undefined ? `${val.toLocaleString()}` : "—";
                            })()}
                         </div>
                      </td>
                      <td className="px-1 text-center border-r border-secondary/10 bg-secondary/[0.01]">
                        <div className="font-bold text-[11px] text-foreground/40">
                           {(() => {
                             const skuCN = item.skuStatsCN?.find((s: any) => s.skuId === sku.skuId);
                             const val = skuCN?.commoditySales?.localSoldNum30 ?? sku.commoditySales?.localSoldNum30;
                             return val !== undefined ? `${val.toLocaleString()}` : "—";
                           })()}
                         </div>
                      </td>
                      {/* 입찰 제안 */}
                      <td className="px-1 text-center border-r border-secondary/10 bg-blue-500/[0.01]">
                         <div className="flex items-center justify-between px-2 gap-2">
                           <div className="relative group/input w-full max-w-[120px] mx-auto">
                             <input type="text" value={bidPrice ? Number(bidPrice).toLocaleString() : ""} onChange={(e) => handleBiddingPriceChange(sku.skuId, e.target.value)} className="w-full text-[11px] py-1 pl-4 pr-1.5 bg-background border border-secondary/30 rounded-md text-right font-mono font-bold focus:ring-1 focus:ring-primary/30 outline-none transition-all" placeholder="0" />
                             <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-20 group-focus-within/input:opacity-50">₩</span>
                           </div>
                         </div>
                      </td>
                      {/* 관리 (BID) */}
                      <td className="px-2 text-center">
                         <button onClick={() => handleSingleBid(sku.skuId, item.id)} disabled={!bidPrice || isBidding} className="px-5 h-7 bg-primary text-primary-foreground rounded-md text-[10px] font-bold shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all uppercase tracking-wider italic">BID</button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // --- 기존 품번 중심 목록 (Hierarchy Mode) ---
                filteredItems.map((item, idx) => {
                  const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
                  const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
                  
                  // 수익 계산 로직 (필터링용)
                  let profit = -999999;
                  if (naverPrice && !isNaN(poizonPriceNum) && poizonPriceNum > 0 && systemSettings) {
                    const { fee } = calculateMargin(poizonPriceNum, systemSettings);
                    profit = poizonPriceNum - fee - Number(naverPrice);
                  }

                  // 필터링 적용: '수익 상품만 보기' 활성화 시 수익이 0 이하인 항목은 숨김
                  if (showOnlyProfitable && profit <= 0) return null;

                  const isBiddable = item.raw?.userCanBidding !== false;
                  const isExpanded = !!expandedRows[item.id];
                  const allSkusSkipped = (item.skuDetails || []).length > 0 && (item.skuDetails || []).every((sku: any) => skippedSkuIds.has(String(sku.skuId)));

                  return (
                    <React.Fragment key={`${item.articleNumber}-${idx}`}>
                      <tr
                        className={`hover:bg-secondary/5 transition-colors group h-14 ${isExpanded ? 'bg-secondary/[0.02]' : ''} ${allSkusSkipped ? 'opacity-40 grayscale-[0.5]' : ''} ${item.skuDetails?.length > 0 ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (item.skuDetails?.length > 0) toggleRow(item.id, item.skuDetails);
                        }}
                      >
                        <td className="px-1 text-center bg-secondary/[0.02] border-r border-secondary/10" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={allSkusSkipped} 
                            onChange={(e) => { e.stopPropagation(); handleToggleSkip(item, false); }}
                            className="w-4 h-4 cursor-pointer accent-blue-500 shadow-sm"
                          />
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center gap-2 py-1">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                            
                            {bidHistory[String(item.id)] ? (
                              <div className="relative group/bid-history">
                                <div className="p-1 text-blue-500 bg-blue-500/10 rounded-full cursor-help hover:bg-blue-500/20 transition-colors">
                                  <Clock size={12} strokeWidth={3} />
                                </div>
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/bid-history:block z-[60] animate-in fade-in slide-in-from-left-1 duration-200">
                                  <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded shadow-xl whitespace-nowrap font-bold flex items-center gap-1.5 border border-white/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    입찰 완료 (₩{bidHistory[String(item.id)].price.toLocaleString()}, {bidHistory[String(item.id)].date})
                                  </div>
                                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 border-r border-secondary/10 overflow-hidden">
                          <div className="flex items-center gap-3">
                            {item.skuDetails?.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleRow(item.id, item.skuDetails); }}
                                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-border/60 bg-background text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                                title={isExpanded ? "옵션 접기" : "옵션 펼치기"}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <div className="w-7 h-7 shrink-0" />
                            )}
                            <div className="w-10 h-10 shrink-0 bg-white border border-secondary/20 rounded-lg p-1 relative shadow-sm">
                              {item.image ? <img src={item.image} className="w-full h-full object-contain" /> : <ImageIcon size={16} className="opacity-10 mx-auto mt-2" />}
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${isBiddable ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-400'}`} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 leading-tight gap-0.5">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase">{item.brand}</span>
                                <span className="font-bold text-foreground text-[12px] truncate tracking-tight">{item.title}</span>
                                {item.skuDetails?.length > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold shrink-0">
                                    {item.skuDetails.length}개 옵션
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                                <CopyableArticleNumber articleNumber={item.articleNumber} />
                                <span className="opacity-30">|</span>
                                <span>{item.category}</span>
                                {isBiddable && <span className="ml-1 bg-emerald-500/10 text-emerald-600 text-[8px] px-1 py-0.5 rounded border border-emerald-500/20 font-bold">입찰 가능</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01] font-bold text-foreground/80">
                          {item.avgPrice}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-orange-500/[0.01] leading-none">
                            <div className="font-bold text-[11px] text-orange-600/80 mb-0.5 italic shrink-0">
                                {item.minPrice}
                            </div>
                            {naverResults[item.articleNumber]?.length > 0 && item.minPrice !== "—" && (
                              (() => {
                                const naverPrice = Number(naverResults[item.articleNumber][0].lprice);
                                if (isNaN(naverPrice)) return null;
                                
                                const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
                                if (isNaN(poizonPriceNum) || poizonPriceNum <= 0) return null;
                                
                                const potentialMargin = calculateMargin(poizonPriceNum, systemSettings || {} as any);
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
                        {/* 순수익 컬럼: 포이즌 노출가 - 수수료 - 네이버 최저가 */}
                        <td className="px-1 text-center border-r border-secondary/10 bg-blue-500/[0.02]">
                          {(() => {
                            const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
                            if (!naverPrice || item.minPrice === "—" || !systemSettings) return <span className="opacity-20 text-[11px]">—</span>;
                            const poizonPriceNum = Number(String(item.minPrice).replace(/[^0-9]/g, ""));
                            if (isNaN(poizonPriceNum) || poizonPriceNum <= 0) return <span className="opacity-20 text-[11px]">—</span>;
                            const { fee } = calculateMargin(poizonPriceNum, systemSettings);
                            const profit = poizonPriceNum - fee - Number(naverPrice);
                            return (
                              <div className="flex flex-col items-center leading-none gap-0.5">
                                <span className={`font-bold text-[12px] ${profit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                  {profit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(profit)).toLocaleString()}
                                </span>
                                <span className="text-[9px] text-muted-foreground/40 font-bold">
                                  수수료 ₩{fee.toLocaleString()}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-primary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/70">{item.salesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-r border-secondary/10 bg-secondary/[0.01]">
                          <div className="font-bold text-[11px] text-foreground/50">{item.localSalesVolume}</div>
                        </td>
                        <td className="px-1 text-center border-secondary/10 text-[10px] text-muted-foreground/30 italic font-bold">SELECT SKU</td>
                        <td className="px-1 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button 
                              onClick={() => {
                                setItemToExclude({ articleNumber: item.articleNumber, title: item.title, idx });
                                setExcludeReason("");
                                setIsExcludeModalOpen(true);
                              }} 
                              title="이 품번 검색에서 영구 제외"
                              className="p-1.5 text-muted-foreground/30 hover:text-orange-500 hover:bg-orange-500/5 rounded-md transition-all"
                            ><Ban size={14}/></button>
                            <button onClick={() => removeItem(idx)} title="목록에서 임시 삭제" className="p-1.5 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 rounded-md transition-all"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && item.skuDetails?.map((sku: any) => {
                        const rec = skuRecommendations[sku.skuId];
                        const isLoadingRec = loadingRecommendations[sku.skuId];
                        const propsRaw = sku.regionSalePvInfoList || sku.properties || [];
                        const propsStr = propsRaw.map((p: any) => p.value || p.propertyValue).join(" / ");
                        const skuPrice = sku.minPrice?.globalMinPriceVO?.amountText ?? sku.minPrice?.price ?? "—";
                        const bidPrice = biddingPrices[sku.skuId];
                        const naverPrice = naverResults[item.articleNumber]?.[0]?.lprice;
                        const margin = getMargin(bidPrice, naverPrice ? Number(naverPrice) : undefined);
                        const isSkuSkipped = skippedSkuIds.has(String(sku.skuId));
                        
                        return (
                          <tr key={sku.skuId} className={`bg-secondary/[0.04] text-[11px] h-12 border-b border-dashed border-secondary/20 ${isSkuSkipped ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                            <td className="px-2 text-center bg-secondary/[0.02] border-r border-secondary/5 border-dashed">
                              <input 
                                type="checkbox" 
                                checked={isSkuSkipped} 
                                onChange={(e) => { e.stopPropagation(); handleToggleSkip({ ...sku, parent: item }, true); }}
                                className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                              />
                            </td>
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
                              <div className="cursor-pointer hover:underline font-bold text-orange-600/70 block mb-0.5 text-[11px]" onClick={() => {
                                const exposurePr = rec?.leakInfos?.find((l: any) => l.buyerRegion === "CN")?.leakPrice ?? rec?.globalMinPrice ?? skuPrice;
                                handleBiddingPriceChange(sku.skuId, String(exposurePr));
                              }}>
                                {isLoadingRec ? <Loader2 size={10} className="animate-spin mx-auto opacity-20"/> : (
                                  (() => {
                                    const exposurePr = rec?.leakInfos?.find((l: any) => l.buyerRegion === "CN")?.leakPrice;
                                    const displayPr = exposurePr ?? rec?.globalMinPrice ?? skuPrice;
                                    return typeof displayPr === 'number' ? `₩${displayPr.toLocaleString()}` : displayPr;
                                  })()
                                )}
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
                            {/* SKU 순수익 컬럼 */}
                            <td className="px-1 text-center border-r border-dashed bg-blue-500/[0.02]">
                              {(() => {
                                if (!naverPrice || !systemSettings) return <span className="opacity-10 text-[11px]">—</span>;
                                const rawSkuPrice = String(rec?.globalMinPrice || skuPrice || "").replace(/[^0-9]/g, "");
                                const poizonSkuPrice = Number(rawSkuPrice);
                                if (isNaN(poizonSkuPrice) || poizonSkuPrice <= 0) return <span className="opacity-10 text-[11px]">—</span>;
                                const { fee: skuFee } = calculateMargin(poizonSkuPrice, systemSettings);
                                const skuProfit = poizonSkuPrice - skuFee - Number(naverPrice);
                                return (
                                  <div className="flex flex-col items-center leading-none gap-0.5">
                                    <span className={`font-bold text-[11px] ${skuProfit > 0 ? 'text-blue-600' : 'text-destructive'}`}>
                                      {skuProfit > 0 ? '▲' : '▼'} ₩{Math.abs(Math.round(skuProfit)).toLocaleString()}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/40 font-bold">수수료 ₩{skuFee.toLocaleString()}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-primary/[0.01]">
                              <div className="font-bold text-[11px] text-foreground/40">
                                {(() => {
                                  const skuCN = item.skuDetailsCN?.find((s: any) => s.skuId === sku.skuId);
                                  const val = skuCN?.commoditySales?.globalSoldNum30 ?? sku.commoditySales?.globalSoldNum30;
                                  return val !== undefined ? `${val.toLocaleString()}` : "—";
                                })()}
                              </div>
                            </td>
                            <td className="px-1 text-center border-r border-dashed bg-secondary/[0.01]">
                              <div className="font-bold text-[11px] text-foreground/40">
                                {(() => {
                                  const skuCN = item.skuDetailsCN?.find((s: any) => s.skuId === sku.skuId);
                                  const val = skuCN?.commoditySales?.localSoldNum30 ?? sku.commoditySales?.localSoldNum30;
                                  return val !== undefined ? `${val.toLocaleString()}` : "—";
                                })()}
                              </div>
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

        {/* Pagination */}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-secondary shadow-2xl rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden text-[13px]">
            <div className="flex items-center justify-between p-4 border-b bg-secondary/10">
              <h3 className="text-lg font-bold tracking-tight">네이버 쇼핑 검색 결과</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-secondary/20 rounded-full transition-colors">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid gap-3">
                {selectedNaverItems.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 bg-card hover:bg-white border rounded-xl transition-all group">
                    <div className="w-16 h-16 bg-white border rounded-lg overflow-hidden shrink-0 shadow-xs p-1">
                      <img src={item.image} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-bold">{item.mallName}</span>
                      </div>
                      <h4 className="text-[13px] font-bold truncate" dangerouslySetInnerHTML={{ __html: item.title }} />
                      <div className="mt-1 text-lg font-black italic">₩{Number(item.lprice).toLocaleString()}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
            <div className="p-4 border-t bg-background flex justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-secondary/80 transition-colors uppercase">닫기</button>
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

      {/* Exclude Article Modal */}
      {isExcludeModalOpen && itemToExclude && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-[420px] rounded-2xl shadow-xl border overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-muted/30">
              <div className="flex items-center gap-3 text-orange-500 mb-1">
                <Ban size={20} />
                <h3 className="font-bold text-lg text-foreground">품번 영구 제외</h3>
              </div>
              <p className="text-sm text-muted-foreground">이 품번은 앞으로 검색 결과에 표시되지 않사옵니다.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-1">제외할 품번</p>
                <div className="text-sm font-bold bg-secondary/20 p-2 rounded-md">{itemToExclude.articleNumber}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1 block">제외 사유</label>
                <textarea 
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="예: 한국 미판매 상품, 마진율 저조 등"
                  className="w-full text-sm p-3 bg-secondary/10 border border-secondary/30 rounded-lg min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setIsExcludeModalOpen(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground">취소</button>
              <button onClick={handleExcludeSubmit} disabled={isExcluding} className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                {isExcluding ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                영구 제외하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyableArticleNumber({ articleNumber }: { articleNumber: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(articleNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 group/copy">
      <span className="font-mono text-primary/70">{articleNumber}</span>
      <button 
        onClick={handleCopy} 
        className="p-0.5 text-muted-foreground/30 opacity-0 group-hover/copy:opacity-100 hover:text-primary transition-all rounded hover:bg-primary/10"
        title="품번 복사"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
