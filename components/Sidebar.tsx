import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { 
  BarChart3, 
  Settings, 
  Search, 
  Package, 
  ListOrdered
} from "lucide-react";

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card/50 backdrop-blur-xl hidden md:flex flex-col h-full shrink-0">
      {/* 1. 로고 영역 */}
      <div className="h-16 flex items-center px-6 border-b">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="text-primary font-black">POIZON</span>
          <span className="text-foreground/80 font-medium">Autosell</span>
        </Link>
      </div>

      {/* 2. 네비게이션 메뉴 */}
      <div className="flex-1 overflow-auto py-6">
        <div className="px-4 space-y-1">
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Main Menu
          </p>
          <NavItem href="/dashboard" icon={<BarChart3 size={18} />} label="Dashboard" />
          <NavItem href="/dashboard/items" icon={<Search size={18} />} label="Item Search" />
          <NavItem href="/dashboard/listings" icon={<Package size={18} />} label="My Listings" />
          <NavItem href="/dashboard/orders" icon={<ListOrdered size={18} />} label="Orders" />
        </div>

        <div className="px-4 mt-8 space-y-1">
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            System
          </p>
          <NavItem href="/dashboard/settings" icon={<Settings size={18} />} label="Settings" />
        </div>
      </div>

      {/* 3. 유저 프로필 섹션 */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-secondary/50 border">
          <UserButton afterSignOutUrl="/sign-in" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">My Account</span>
            <span className="text-xs text-muted-foreground">Manage profile</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 group"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </span>
      {label}
    </Link>
  );
}
