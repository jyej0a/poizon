"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Settings,
  Search,
  Gavel,
  ListOrdered,
  Ban,
  Inbox,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  LineChart,
} from "lucide-react";
import { useSearchJobs } from "@/components/providers/search-jobs-provider";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { runningCount, unclaimedCount, unseenCount } = useSearchJobs();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const jobsBadge =
    runningCount > 0
      ? runningCount
      : unclaimedCount > 0
        ? unclaimedCount
        : unseenCount > 0
          ? unseenCount
          : undefined;
  const jobsBadgeTone: BadgeTone =
    runningCount > 0 ? "progress" : unclaimedCount > 0 ? "queued" : "done";

  return (
    <aside className={`relative z-[1] border-r glass-panel hidden md:flex flex-col h-full shrink-0 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      <div className={`h-16 flex items-center px-4 border-b ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight overflow-hidden">
            <span className="text-primary font-black">POIZON</span>
            <span className="text-foreground/80 font-medium whitespace-nowrap">Autosell</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors shrink-0 inline-flex items-center ${isCollapsed ? "flex-col gap-0.5" : "gap-1"}`}
          title={isCollapsed ? "사이드바 펴기" : "사이드바 접기"}
          aria-label={isCollapsed ? "사이드바 펴기" : "사이드바 접기"}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="text-[10px] font-medium">
            {isCollapsed ? "펴기" : "접기"}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6">
        <NavGroup label="검색" isCollapsed={isCollapsed}>
          <NavItem href="/dashboard" icon={<Search size={18} />} label="검색" isCollapsed={isCollapsed} isActive={isActive("/dashboard")} />
          <NavItem
            href="/dashboard/jobs"
            icon={runningCount > 0 ? <Loader2 size={18} className="animate-spin" /> : <Inbox size={18} />}
            label="검색 작업"
            isCollapsed={isCollapsed}
            isActive={isActive("/dashboard/jobs")}
            badge={jobsBadge}
            badgeTone={jobsBadgeTone}
          />
          <NavItem href="/dashboard/excluded" icon={<Ban size={18} />} label="제외 목록" isCollapsed={isCollapsed} isActive={isActive("/dashboard/excluded")} />
          <NavItem href="/dashboard/malls" icon={<Store size={18} />} label="수집 몰" isCollapsed={isCollapsed} isActive={isActive("/dashboard/malls")} />
        </NavGroup>

        <NavGroup label="판매" isCollapsed={isCollapsed} className="mt-8">
          <NavItem href="/dashboard/listings" icon={<Gavel size={18} />} label="입찰 관리" isCollapsed={isCollapsed} isActive={isActive("/dashboard/listings")} />
          <NavItem href="/dashboard/orders" icon={<ListOrdered size={18} />} label="주문 관리" isCollapsed={isCollapsed} isActive={isActive("/dashboard/orders")} />
          <NavItem href="/dashboard/revenue" icon={<LineChart size={18} />} label="수익 현황" isCollapsed={isCollapsed} isActive={isActive("/dashboard/revenue")} />
        </NavGroup>

        <NavGroup label="시스템" isCollapsed={isCollapsed} className="mt-8">
          <NavItem href="/dashboard/settings" icon={<Settings size={18} />} label="설정" isCollapsed={isCollapsed} isActive={isActive("/dashboard/settings")} />
        </NavGroup>
      </div>

      <div className={`p-4 border-t flex ${isCollapsed ? "justify-center" : ""}`}>
        <div className={`flex items-center gap-3 py-2 rounded-xl border transition-all ${isCollapsed ? "px-2 bg-transparent border-transparent" : "px-2 bg-secondary/50"}`}>
          <UserButton afterSignOutUrl="/sign-in" />
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="text-sm font-medium">내 계정</span>
              <span className="text-xs text-muted-foreground">프로필 관리</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  isCollapsed,
  className = "",
  children,
}: {
  label: string;
  isCollapsed: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <nav className={`px-3 space-y-1 ${className}`} aria-label={label}>
      {!isCollapsed && (
        <p className="px-2 text-xs font-semibold text-muted-foreground tracking-wider mb-2">
          {label}
        </p>
      )}
      {children}
    </nav>
  );
}

type BadgeTone = "progress" | "queued" | "done";

function NavItem({
  href,
  icon,
  label,
  isCollapsed,
  isActive = false,
  badge,
  badgeTone = "done",
  statusBadge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isActive?: boolean;
  badge?: number;
  badgeTone?: BadgeTone;
  statusBadge?: string;
}) {
  const collapsedTitle = statusBadge ? `${label} (${statusBadge})` : label;
  const ariaLabel = statusBadge ? `${label} (${statusBadge})` : label;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isCollapsed ? "justify-center px-0" : "px-2"} ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
      title={isCollapsed ? collapsedTitle : undefined}
      aria-label={ariaLabel}
    >
      <span className={`relative shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
        {icon}
        {isCollapsed && badge !== undefined && (
          <span
            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              badgeTone === "progress"
                ? "bg-blue-500"
                : badgeTone === "queued"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
          />
        )}
        {isCollapsed && statusBadge && badge === undefined && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-muted-foreground/50" />
        )}
      </span>
      {!isCollapsed && (
        <span className="flex flex-1 items-center justify-between whitespace-nowrap gap-2">
          {label}
          {badge !== undefined && (
            <span
              className={`text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                badgeTone === "progress"
                  ? "bg-blue-500/15 text-blue-600"
                  : badgeTone === "queued"
                    ? "bg-amber-500/15 text-amber-700"
                    : "bg-emerald-500/15 text-emerald-600"
              }`}
            >
              {badge}
            </span>
          )}
          {statusBadge && badge === undefined && (
            <span className="text-[10px] font-semibold tracking-wide rounded-full bg-secondary/60 px-1.5 py-0.5 text-muted-foreground/70">
              {statusBadge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
