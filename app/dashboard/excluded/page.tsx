"use client";

import React, { useEffect, useState } from "react";
import { getExcludedArticles, removeExcludedArticle } from "@/app/actions/excluded-articles";
import { Ban, Search, RefreshCw, Loader2, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";

export default function ExcludedListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await getExcludedArticles();
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        alert(`오류: ${res.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRestore = async (articleNumber: string) => {
    if (!confirm("이 품번을 다시 검색 결과에 포함시키겠사옵니까?")) return;
    
    setIsRestoring(articleNumber);
    try {
      const res = await removeExcludedArticle(articleNumber);
      if (res.success) {
        alert("성공적으로 복원되었사옵니다.");
        setItems(prev => prev.filter(item => item.article_number !== articleNumber));
      } else {
        alert(`복원 실패: ${res.error}`);
      }
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setIsRestoring(null);
    }
  };

  const filteredItems = items.filter(item => 
    item.article_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col gap-4 p-2 w-full animate-in fade-in duration-300">
      <div className="bg-card border border-secondary/40 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-600 rounded-xl">
            <Ban size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">제외 목록 관리</h2>
            <p className="text-sm text-muted-foreground">검색 결과에서 영구 제외시킨 품번들의 목록이옵니다.</p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input 
            type="text" 
            placeholder="품번 또는 상품명 검색..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary/20 border border-secondary/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 bg-card border border-secondary/40 rounded-xl shadow-sm flex flex-col overflow-hidden pointer-events-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/20 text-muted-foreground border-b border-secondary/30">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">품번</th>
                <th className="px-6 py-4 font-bold tracking-wider">상품명</th>
                <th className="px-6 py-4 font-bold tracking-wider">제외 사유</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">제외 일시</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <Loader2 size={24} className="animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground opacity-60">
                      <Ban className="w-10 h-10 mb-3 opacity-20" />
                      <p className="font-medium">제외된 품번이 없사옵니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/10 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-foreground">
                      {item.article_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-foreground/80 line-clamp-2 max-w-sm">
                        {item.title || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.reason ? (
                        <span className="bg-secondary/30 px-3 py-1.5 rounded-md text-xs font-semibold text-foreground/70">
                          {item.reason}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs italic">사유 없음</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-muted-foreground">
                      {format(new Date(item.excluded_at), "yyyy-MM-dd HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleRestore(item.article_number)}
                        disabled={isRestoring === item.article_number}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 hover:bg-secondary text-foreground hover:text-primary rounded-lg text-xs font-bold transition-all"
                      >
                        {isRestoring === item.article_number ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        복원
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
