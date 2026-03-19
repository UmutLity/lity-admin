"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Bell, User, LogOut, Settings,
  ChevronDown, Shield, Command,
} from "lucide-react";

interface TopbarProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Topbar({ title, description, children }: TopbarProps) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {role && (
            <Badge
              variant={role === "ADMIN" ? "default" : "secondary"}
              className={cn(
                "text-[10px] font-semibold",
                role === "ADMIN" && "bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 border border-purple-500/20"
              )}
            >
              {role}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ━━━ Global Admin Header (sticky top bar) ━━━ */
export function AdminHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/admin/notifications?limit=5", { credentials: "include" });
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Quick search navigation
  const searchRoutes = [
    { label: "Dashboard", path: "/admin", keywords: "home overview" },
    { label: "Products", path: "/admin/products", keywords: "items store" },
    { label: "Changelog", path: "/admin/changelog", keywords: "updates notes" },
    { label: "Users", path: "/admin/users", keywords: "customers staff" },
    { label: "Settings", path: "/admin/settings", keywords: "config" },
    { label: "Analytics", path: "/admin/analytics", keywords: "stats traffic" },
    { label: "Security", path: "/admin/security", keywords: "auth login" },
    { label: "Revenue", path: "/admin/revenue", keywords: "sales money" },
    { label: "Media", path: "/admin/media", keywords: "images upload" },
    { label: "Audit Log", path: "/admin/audit", keywords: "logs history" },
  ];

  const filteredRoutes = searchQuery
    ? searchRoutes.filter(r =>
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.keywords.includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-white/[0.04] bg-[#0a0f1e]/80 backdrop-blur-xl">
      {/* Left: Search */}
      <div className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="w-full h-9 pl-9 pr-12 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/30 focus:bg-white/[0.06] transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] text-zinc-600 font-medium bg-white/[0.04] px-1.5 py-0.5 rounded">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
        {searchOpen && filteredRoutes.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-[#0d1424] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
            {filteredRoutes.map((route) => (
              <button
                key={route.path}
                onMouseDown={() => { router.push(route.path); setSearchQuery(""); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-zinc-600" />
                {route.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative flex items-center justify-center h-9 w-9 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0a0f1e]" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d1424] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="default" className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/20">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-zinc-600">No notifications</div>
                ) : notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer",
                      !n.readAt && "bg-purple-500/[0.03]"
                    )}
                  >
                    <p className="text-xs font-medium text-zinc-300 line-clamp-1">{n.title}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                ))}
              </div>
              <button
                onMouseDown={() => router.push("/admin/notifications")}
                className="w-full py-2.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-white/[0.02] transition-colors font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.06] mx-1" />

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold">
              {(session?.user?.name || "A").charAt(0).toUpperCase()}
            </div>
            {!session?.user?.name ? null : (
              <span className="hidden md:block text-xs font-medium text-zinc-400 max-w-[100px] truncate">
                {session.user.name}
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-zinc-600" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#0d1424] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-semibold text-white truncate">{session?.user?.name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onMouseDown={() => router.push("/admin/settings")}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button
                  onMouseDown={() => signOut({ callbackUrl: "/admin/login" })}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
