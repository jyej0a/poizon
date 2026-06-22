"use client";

import type { NaverShoppingItem } from "@/lib/api/naver-shopping";
import { openNaverProductLink, openNaverShoppingSearch } from "@/lib/utils/naver-shopping-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, ShoppingBag } from "lucide-react";

interface NaverShoppingResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: NaverShoppingItem[] | null;
  articleNumber?: string;
}

export function NaverShoppingResultsDialog({
  isOpen,
  onClose,
  items,
  articleNumber,
}: NaverShoppingResultsDialogProps) {
  const sortedItems = items
    ? [...items].sort((a, b) => Number(a.lprice) - Number(b.lprice))
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-secondary/40 shadow-2xl">
        <DialogHeader className="px-5 py-4 border-b bg-emerald-500/[0.04] text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ShoppingBag size={18} className="text-emerald-600" />
            네이버 쇼핑 검색 결과
          </DialogTitle>
          {articleNumber && (
            <DialogDescription className="font-mono text-xs">
              품번 {articleNumber}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sortedItems.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              표시할 검색 결과가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-secondary/20">
              {sortedItems.map((item, i) => (
                <li key={`${item.productId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => openNaverProductLink(item.link, articleNumber)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-500/[0.04] transition-colors group"
                  >
                    <div className="w-14 h-14 bg-white border border-secondary/30 rounded-lg overflow-hidden shrink-0 p-1">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-secondary/10" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="bg-emerald-500/10 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold truncate max-w-[140px]">
                          {item.mallName}
                        </span>
                      </div>
                      <p
                        className="text-[13px] font-medium text-foreground line-clamp-2 leading-snug"
                        dangerouslySetInnerHTML={{ __html: item.title }}
                      />
                    </div>
                    <div className="shrink-0 text-right pl-2">
                      <div className="text-base font-black text-emerald-600 tabular-nums">
                        ₩{Number(item.lprice).toLocaleString()}
                      </div>
                      <ExternalLink
                        size={12}
                        className="inline-block mt-1 opacity-0 group-hover:opacity-50 text-muted-foreground"
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-secondary/5 sm:justify-between gap-2">
          {articleNumber && (
            <button
              type="button"
              onClick={() => openNaverShoppingSearch(articleNumber)}
              className="text-xs font-semibold text-muted-foreground hover:text-emerald-600 flex items-center gap-1 transition-colors"
            >
              <ExternalLink size={12} />
              네이버 쇼핑에서 더 보기
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-secondary/80 transition-colors uppercase sm:ml-auto"
          >
            닫기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
