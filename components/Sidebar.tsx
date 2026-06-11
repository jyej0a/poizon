"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { 
  BarChart3, 
  Settings, 
  Search, 
  Gavel, 
  ListOrdered,
  Ban,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          <NavItem href="/dashboard" icon={<BarChart3 size={18} />} label="Dashboard" isCollapsed={isCollapsed} />
          <NavItem href="/dashboard/items" icon={<Search size={18} />} label="Item Search" isCollapsed={isCollapsed} />
          <NavItem href="/dashboard/listings" icon={<Gavel size={18} />} label="입찰 관리" isCollapsed={isCollapsed} />
          <NavItem href="/dashboard/orders" icon={<ListOrdered size={18} />} label="Orders" isCollapsed={isCollapsed} />
          <NavItem href="/dashboard/excluded" icon={<Ban size={18} />} label="제외 목록" isCollapsed={isCollapsed} />
        </div>

        <div className="px-3 mt-8 space-y-1">
          {!isCollapsed && (
            <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              System
            </p>
          )}
          <NavItem href="/dashboard/settings" icon={<Settings size={18} />} label="Settings" isCollapsed={isCollapsed} />
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

function NavItem({ href, icon, label, isCollapsed }: { href: string; icon: React.ReactNode; label: string; isCollapsed: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 group ${isCollapsed ? "justify-center px-0" : "px-2"}`}
      title={isCollapsed ? label : undefined}
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
        {icon}
      </span>
      {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
