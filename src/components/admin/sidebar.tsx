"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, FileText, Settings, Image as ImageIcon,
  Users, Shield, ClipboardList, Clock, LogOut, ChevronLeft, Menu,
  ShieldAlert, KeyRound, BarChart3, Server, Bell, DollarSign,
  FolderOpen, Gauge, Brain, Handshake, Zap,
  Search, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, createContext, useContext } from "react";

type Role = "ADMIN" | "EDITOR" | "VIEWER";

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: Role[];
  badge?: number;
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "EDITOR", "VIEWER"] },
      { href: "/admin/executive", label: "Executive", icon: Gauge, roles: ["ADMIN"] },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/categories", label: "Categories", icon: FolderOpen, roles: ["ADMIN"] },
      { href: "/admin/changelog", label: "Changelog", icon: FileText, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/media", label: "Media", icon: ImageIcon, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/revenue", label: "Revenue", icon: DollarSign, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Users & Access",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
      { href: "/admin/roles", label: "Roles", icon: KeyRound, roles: ["ADMIN"] },
      { href: "/admin/security", label: "Security", icon: ShieldAlert, roles: ["ADMIN"] },
      { href: "/admin/resellers", label: "Resellers", icon: Handshake, roles: ["ADMIN"] },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
      { href: "/admin/notifications", label: "Notifications", icon: Bell, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardList, roles: ["ADMIN"] },
      { href: "/admin/timeline", label: "Timeline", icon: Clock, roles: ["ADMIN"] },
      { href: "/admin/insights", label: "AI Insights", icon: Brain, roles: ["ADMIN"] },
      { href: "/admin/seo", label: "SEO", icon: Search, roles: ["ADMIN"] },
      { href: "/admin/performance", label: "Performance", icon: Zap, roles: ["ADMIN"] },
      { href: "/admin/system", label: "System Health", icon: Server, roles: ["ADMIN"] },
    ],
  },
];

// Sidebar context for collapse state sharing
export const SidebarContext = createContext<{ collapsed: boolean; setCollapsed: (v: boolean) => void }>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, setCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userRole = (session?.user as any)?.role as Role | undefined;

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/admin/notifications?unread=true&limit=1");
        const data = await res.json();
        if (data.success) setUnreadCount(data.unreadCount || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => userRole && item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
    const isExact = pathname === item.href;
    const isNotification = item.href === "/admin/notifications";
    const active = isExact || isActive;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          active
            ? "bg-[linear-gradient(135deg,rgba(168,85,247,0.18),rgba(113,113,122,0.12))] text-white shadow-[0_14px_34px_rgba(24,24,33,0.35)] ring-1 ring-violet-400/15"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
        )}
        title={collapsed ? item.label : undefined}
      >
        {/* Active indicator */}
        {active && (
          <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-violet-400 to-fuchsia-300" />
        )}
        <div className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          active
            ? "bg-[linear-gradient(135deg,rgba(168,85,247,0.15),rgba(113,113,122,0.12))] text-violet-300"
            : "text-zinc-500 group-hover:bg-white/[0.04] group-hover:text-zinc-200"
        )}>
          <item.icon className="h-[18px] w-[18px]" />
        </div>
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
        {isNotification && unreadCount > 0 && !collapsed && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {isNotification && unreadCount > 0 && collapsed && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex h-20 flex-shrink-0 items-center border-b border-white/[0.06] px-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed ? (
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] shadow-[0_16px_34px_rgba(109,40,217,0.28)]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white">Lity Admin</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">Control Surface</span>
            </div>
          </Link>
        ) : (
          <Link href="/admin">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] shadow-[0_16px_34px_rgba(109,40,217,0.28)]">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {filteredGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-3 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-600">
                  {group.title}
                </span>
              </div>
            )}
            {collapsed && <div className="mb-1 mx-auto w-6 h-px bg-white/[0.06]" />}
            <div className="space-y-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapsed expand button */}
      {collapsed && (
        <div className="px-3 py-2 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center h-9 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* User Footer */}
        <div className="border-t border-white/[0.06] p-3 flex-shrink-0">
          {!collapsed && session?.user && (
          <div className="mb-1 flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(168,85,247,0.16),rgba(113,113,122,0.1))] text-xs font-bold text-violet-300">
              {(session.user.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{session.user.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-zinc-500 transition-all duration-200 hover:bg-red-500/[0.06] hover:text-red-400",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full flex flex-col transition-all duration-300 ease-in-out",
          "border-r border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,15,22,0.97),rgba(10,10,16,0.96))] backdrop-blur-xl",
          collapsed ? "w-[72px]" : "w-[260px]",
          // Mobile
          "max-lg:w-[260px] max-lg:shadow-2xl max-lg:shadow-black/50",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className={cn(
          "lg:hidden fixed top-4 left-4 z-30 h-10 w-10 flex items-center justify-center rounded-xl",
          "bg-[#0d1424] border border-white/[0.08] text-zinc-400 hover:text-white shadow-lg transition-all",
          mobileOpen && "opacity-0 pointer-events-none"
        )}
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}
