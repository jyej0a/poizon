"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { 
  BarChart3, 
  Settings, 
  Search, 
  Gavel, 
  ListOrdered,
  Ban,
  Inbox,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Store
} from "lucide-react";
import { useSearchJobs } from "@/components/providers/search-jobs-provider";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { activeCount, unseenCount } = useSearchJobs();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className={`border-r bg-card/50 backdrop-blur-xl hidden md:flex flex-col h-full shrink-0 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      {/* 1. 로고 영역 */}
      <div className={`h-16 flex items-center px-4 border-b ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight overflow-hidden">
            <span className="text-primary font-black">POIZON</span>
            <span className="text-foreground/80 font-medium whitespace-nowrap">Autosell</span>
          </Link>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors shrink-0"
          title="사이드바 접기/펴기"
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* 2. 네비게이션 메뉴 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6">
        <div className="px-3 space-y-1">
          {!isCollapsed && (
            <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Main Menu
            </p>
          )}
          <NavItem href="/dashboard" icon={<BarChart3 size={18} />} label="Dashboard" isCollapsed={isCollapsed} isActive={isActive("/dashboard")} />
          <NavItem href="/dashboard/items" icon={<Search size={18} />} label="Item Search" isCollapsed={isCollapsed} comingSoon />
          <NavItem
            href="/dashboard/jobs"
            icon={activeCount > 0 ? <Loader2 size={18} className="animate-spin" /> : <Inbox size={18} />}
            label="검색 작업"
            isCollapsed={isCollapsed}
            isActive={isActive("/dashboard/jobs")}
            badge={activeCount > 0 ? activeCount : unseenCount > 0 ? unseenCount : undefined}
            badgeTone={activeCount > 0 ? "progress" : "done"}
          />
          <NavItem href="/dashboard/listings" icon={<Gavel size={18} />} label="입찰 관리" isCollapsed={isCollapsed} isActive={isActive("/dashboard/listings")} />
          <NavItem href="/dashboard/orders" icon={<ListOrdered size={18} />} label="Orders" isCollapsed={isCollapsed} comingSoon />
          <NavItem href="/dashboard/excluded" icon={<Ban size={18} />} label="제외 목록" isCollapsed={isCollapsed} isActive={isActive("/dashboard/excluded")} />
          <NavItem href="/dashboard/malls" icon={<Store size={18} />} label="수집 몰" isCollapsed={isCollapsed} isActive={isActive("/dashboard/malls")} />
        </div>

        <div className="px-3 mt-8 space-y-1">
          {!isCollapsed && (
            <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              System
            </p>
          )}
          <NavItem href="/dashboard/settings" icon={<Settings size={18} />} label="Settings" isCollapsed={isCollapsed} isActive={isActive("/dashboard/settings")} />
        </div>
      </div>

      {/* 3. 유저 프로필 섹션 */}
      <div className={`p-4 border-t flex ${isCollapsed ? "justify-center" : ""}`}>
        <div className={`flex items-center gap-3 py-2 rounded-xl border transition-all ${isCollapsed ? "px-2 bg-transparent border-transparent" : "px-2 bg-secondary/50"}`}>
          <UserButton afterSignOutUrl="/sign-in" />
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="text-sm font-medium">My Account</span>
              <span className="text-xs text-muted-foreground">Manage profile</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  isCollapsed,
  isActive = false,
  comingSoon = false,
  badge,
  badgeTone = "done",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isActive?: boolean;
  comingSoon?: boolean;
  /** 진행 중 잡 수 또는 아직 열어보지 않은 완료 잡 수 */
  badge?: number;
  badgeTone?: "progress" | "done";
}) {
  if (comingSoon) {
    return (
      <div
        aria-disabled
        className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/40 cursor-not-allowed select-none ${isCollapsed ? "justify-center px-0" : "px-2"}`}
        title={`${label} (준비 중)`}
      >
        <span className="shrink-0">{icon}</span>
        {!isCollapsed && (
          <span className="flex flex-1 items-center justify-between whitespace-nowrap">
            {label}
            <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-secondary/60 px-1.5 py-0.5 text-muted-foreground/60">
              준비 중
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isCollapsed ? "justify-center px-0" : "px-2"} ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
      title={isCollapsed ? label : undefined}
    >
      <span className={`relative shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
        {icon}
        {/* 사이드바가 접힌 상태에서는 아이콘 위에 점으로만 표시 */}
        {isCollapsed && badge !== undefined && (
          <span
            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              badgeTone === "progress" ? "bg-blue-500" : "bg-emerald-500"
            }`}
          />
        )}
      </span>
      {!isCollapsed && (
        <span className="flex flex-1 items-center justify-between whitespace-nowrap">
          {label}
          {badge !== undefined && (
            <span
              className={`text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                badgeTone === "progress"
                  ? "bg-blue-500/15 text-blue-600"
                  : "bg-emerald-500/15 text-emerald-600"
              }`}
            >
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
