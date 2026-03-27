"use client";

import React from "react";
import { getMallWhitelist, toggleMallActive, addMallToWhitelist, removeMallFromWhitelist } from "@/app/actions/malls";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Store } from "lucide-react";

export function MallWhitelistManager() {
  const [malls, setMalls] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [newMallName, setNewMallName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const fetchMalls = async () => {
    setIsLoading(true);
    const res = await getMallWhitelist();
    if (res.success) {
      setMalls(res.data || []);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchMalls();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const res = await toggleMallActive(id, !currentStatus);
    if (res.success) {
      setMalls(malls.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
    }
  };

  const handleAdd = async () => {
    if (!newMallName.trim()) return;
    setIsAdding(true);
    const res = await addMallToWhitelist(newMallName.trim());
    if (res.success) {
      setNewMallName("");
      fetchMalls();
    } else {
      alert("오류: " + res.error);
    }
    setIsAdding(false);
  };

  const handleRemove = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await removeMallFromWhitelist(id);
    if (res.success) {
      setMalls(malls.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input 
          placeholder="추가할 쇼핑몰명 (예: SSG닷컴)" 
          value={newMallName} 
          onChange={(e) => setNewMallName(e.target.value)}
          className="bg-secondary/20 border-none font-bold text-[13px]"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={isAdding || !newMallName.trim()} size="sm" className="shrink-0 bg-primary font-bold">
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <div className="bg-secondary/10 rounded-xl overflow-hidden border border-secondary/20">
        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin opacity-20" /></div>
          ) : malls.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground italic opacity-50">등록된 쇼핑몰이 없사옵니다.</div>
          ) : (
            <div className="divide-y divide-secondary/10">
              {malls.map((mall) => (
                <div key={mall.id} className="flex items-center justify-between p-3 hover:bg-secondary/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-secondary/10 flex items-center justify-center text-primary shadow-xs">
                      <Store size={14} />
                    </div>
                    <span className="text-[13px] font-bold text-foreground/80">{mall.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={mall.is_active} onCheckedChange={() => handleToggle(mall.id, mall.is_active)} />
                    <button onClick={() => handleRemove(mall.id)} className="p-1.5 text-muted-foreground/20 hover:text-destructive hover:bg-destructive/5 rounded-md transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">* 활성화된 쇼핑몰의 가격만 네이버 검색 시 필터링되어 반영되옵니다.</p>
    </div>
  );
}
