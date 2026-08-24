import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">
            Poizon API 키와 수수료 설정을 관리합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SettingsForm />

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="p-2 bg-accent rounded-lg">
              <ShoppingBag className="text-accent-foreground h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">수집 몰</h3>
              <p className="text-sm text-muted-foreground">원가 오퍼를 가져올 쇼핑몰을 켜고 끕니다.</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            롯데ON, 무신사, SSG 등 연결된 수집 몰의 활성 상태와 연결 점검은 전용 화면에서 관리합니다.
          </p>
          <Link
            href="/dashboard/malls"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            수집 몰 관리
          </Link>
        </div>
      </div>
    </div>
  );
}
