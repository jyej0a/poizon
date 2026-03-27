"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Save, Loader2, AlertCircle } from "lucide-react";
import { savePoizonSettings, getPoizonSettings } from "@/app/actions/settings";

export function SettingsForm() {
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      const res = await getPoizonSettings();
      if (res.success && res.data) {
        setAppKey(res.data.poizon_app_key || "");
        setAppSecret(res.data.poizon_app_secret || "");
        setAccessToken((res.data as any).poizon_access_token || "");
      }
      setIsInitializing(false);
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!appKey || !appSecret) {
      setMessage({ type: "error", text: "App Key와 App Secret을 모두 입력해주세요." });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    const res = await savePoizonSettings(appKey, appSecret, accessToken || undefined);
    
    if (res.success) {
      setMessage({ type: "success", text: "설정이 성공적으로 저장되었습니다." });
    } else {
      setMessage({ type: "error", text: res.error || "저장 중 오류가 발생했습니다." });
    }
    
    setIsLoading(false);
  };

  if (isInitializing) {
    return <div className="h-40 flex items-center justify-center border rounded-2xl bg-card animate-pulse">설정을 불러오는 중입니다...</div>;
  }

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ShieldCheck className="text-primary h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Poizon API Integration</h3>
          <p className="text-sm text-muted-foreground">Configure Open Platform credentials.</p>
        </div>
        <div>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>
      
      {message && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {message.type === 'error' && <AlertCircle size={16} />}
          {message.text}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">App Key</label>
          <input 
            type="text" 
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder="Enter Poizon App Key" 
            className="w-full px-3 py-2 bg-secondary/50 border rounded-lg outline-none focus:border-primary transition-colors" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">App Secret</label>
          <input 
            type="password" 
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder="Enter Poizon App Secret" 
            className="w-full px-3 py-2 bg-secondary/50 border rounded-lg outline-none focus:border-primary transition-colors" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            Access Token
            <span className="text-xs text-amber-500 font-normal bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
              ⚡ 입찰 필수
            </span>
          </label>
          <input 
            type="password" 
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Enter Poizon Access Token (OAuth)" 
            className="w-full px-3 py-2 bg-secondary/50 border rounded-lg outline-none focus:border-primary transition-colors" 
          />
        </div>
        <div className="pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            * App Key/Secret은 API 서명용 자격증명입니다. 입찰과 같은 셀러 계정 행위(Listing)에는 추가적으로 <strong>Access Token(OAuth 셀러 토큰)</strong>이 필요합니다.
            발급 방법: Poizon Open Platform &gt; Console &gt; 내 앱 클릭 &gt; Traffic Certificate 탭 참조
          </p>
        </div>
      </div>
    </div>
  );
}
