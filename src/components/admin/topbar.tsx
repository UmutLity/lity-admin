"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Bell, LogOut, Settings,
  ChevronDown, Command,
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
    <div className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(31,30,38,0.72),rgba(23,23,29,0.48))] px-6 py-5 shadow-[0_22px_52px_rgba(7,7,12,0.24)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {role && (
            <Badge
              variant={role === "ADMIN" ? "default" : "secondary"}
              className={cn(
                "border text-[10px] font-semibold uppercase tracking-[0.22em]",
                role === "ADMIN"
                  ? "border-[#b9accf]/30 bg-[#a996c4]/12 text-[#c7bdd8]"
                  : "border-white/[0.08] bg-white/[0.04] text-zinc-300"
              )}
            >
              {role}
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
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
    { label: "Users", path: "/admin/users", keywords: "customers staff" },
    { label: "Tickets", path: "/admin/tickets", keywords: "support replies messages" },
    { label: "Licenses", path: "/admin/licenses", keywords: "keys plans" },
    { label: "Guides", path: "/admin/changelog", keywords: "changelog docs updates" },
    { label: "Payments", path: "/admin/revenue", keywords: "revenue sales money" },
    { label: "Reviews", path: "/admin/reviews", keywords: "feedback" },
    { label: "Community", path: "/admin/notifications", keywords: "announcements notifications" },
    { label: "Settings", path: "/admin/settings", keywords: "config" },
  ];

  const filteredRoutes = searchQuery
    ? searchRoutes.filter(r =>
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.keywords.includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(20,19,26,0.92),rgba(15,15,21,0.78))] px-6 backdrop-blur-2xl">
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
            className="h-10 w-full rounded-2xl border border-white/[0.06] bg-white/[0.04] pl-10 pr-12 text-sm text-zinc-300 placeholder:text-zinc-600 transition-all focus:border-[#b9accf]/35 focus:bg-white/[0.06] focus:outline-none"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] text-zinc-600 font-medium bg-white/[0.04] px-1.5 py-0.5 rounded">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
        {searchOpen && filteredRoutes.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131a] shadow-2xl shadow-black/40">
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
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#b9accf] ring-2 ring-[#0a0f1e]" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131a] shadow-2xl shadow-black/40">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                      <Badge variant="default" className="border-[#b9accf]/30 bg-[#a996c4]/12 text-[10px] text-[#c7bdd8]">
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
                      !n.readAt && "bg-[#a996c4]/[0.05]"
                    )}
                  >
                    <p className="text-xs font-medium text-zinc-300 line-clamp-1">{n.title}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                ))}
              </div>
              <button
                onMouseDown={() => router.push("/admin/notifications")}
                className="w-full py-2.5 text-xs font-medium text-[#c7bdd8] transition-colors hover:bg-white/[0.02] hover:text-[#ddd4ea]"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-white/[0.06]" />

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex h-10 items-center gap-2 rounded-2xl pl-1.5 pr-2 transition-all hover:bg-white/[0.04]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8f7ab0,#77688f)] text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(55,49,71,0.24)]">
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
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131a] shadow-2xl shadow-black/40">
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
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[#c9bddb]/80 hover:text-[#ddd4ea] hover:bg-[#a996c4]/[0.12] transition-colors"
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
