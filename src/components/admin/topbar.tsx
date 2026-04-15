"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Command,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Topbar({ title, description, children }: TopbarProps) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <div className="mb-6 ui-fade-up">
      <Card className="ui-surface">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
              {role ? (
                <Badge
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    role === "FOUNDER"
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                      : role === "MODERATOR"
                        ? "border-sky-400/25 bg-sky-500/10 text-sky-200"
                        : role === "SUPPORT"
                          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                          : "border-[#b9accf]/30 bg-[#a996c4]/12 text-[#e0d7ef]"
                  )}
                >
                  {role}
                </Badge>
              ) : null}
            </div>
            {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="ui-chip inline-flex items-center gap-1 border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live
            </span>
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/admin/notifications?limit=5", { credentials: "include" });
        const data = await res.json();
        if (data?.success) {
          setNotifications(Array.isArray(data.data) ? data.data : []);
          setUnreadCount(Number(data.unreadCount || 0));
        }
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const searchRoutes = useMemo(
    () => [
      { label: "Dashboard", path: "/admin", keywords: "overview home stats" },
      { label: "Products", path: "/admin/products", keywords: "products catalog store" },
      { label: "Orders", path: "/admin/orders", keywords: "orders purchases delivery" },
      { label: "Pending Deliveries", path: "/admin/pending-deliveries", keywords: "manual delivery pending" },
      { label: "Users", path: "/admin/users", keywords: "customers members customer 360 profile" },
      { label: "Tickets", path: "/admin/tickets", keywords: "support replies" },
      { label: "Licenses", path: "/admin/licenses", keywords: "keys plans" },
      { label: "Top-up Requests", path: "/admin/topups", keywords: "balance topup payments" },
      { label: "Coupons", path: "/admin/coupons", keywords: "discount promos" },
      { label: "Reviews", path: "/admin/reviews", keywords: "feedback ratings" },
      { label: "Blog", path: "/admin/blog", keywords: "articles content" },
      { label: "Settings", path: "/admin/settings", keywords: "configuration site settings" },
    ],
    []
  );

  const filteredRoutes = searchQuery.trim()
    ? searchRoutes.filter((route) => {
        const q = searchQuery.toLowerCase();
        return route.label.toLowerCase().includes(q) || route.keywords.includes(q);
      })
    : [];

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0f141d]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center justify-between gap-3 px-3 pl-14 sm:px-4 sm:pl-16 lg:px-6">
        <div className="relative min-w-0 max-w-2xl flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              placeholder="Search pages, tools, and admin sections..."
              className="h-10 rounded-2xl border-white/[0.08] bg-white/[0.03] pl-10 pr-10 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-0 sm:h-11 sm:pr-14"
            />
            <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-500 sm:flex">
              <Command className="h-3 w-3" />
              K
            </div>
          </div>

          {searchOpen && filteredRoutes.length ? (
            <Card className="ui-fade-in absolute left-0 right-0 top-full mt-2 border-white/[0.08] bg-[#121925]/95 shadow-2xl shadow-black/30">
              <CardContent className="p-2">
                {filteredRoutes.map((route) => (
                  <Button
                    key={route.path}
                    variant="ghost"
                    className="h-10 w-full justify-start rounded-xl px-3 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                    onMouseDown={() => {
                      router.push(route.path);
                      setSearchQuery("");
                    }}
                  >
                    <Search className="mr-2 h-4 w-4 text-zinc-500" />
                    {route.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div ref={notifRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl text-zinc-400 hover:bg-white/[0.05] hover:text-white sm:h-10 sm:w-10"
              onClick={() => setNotifOpen((prev) => !prev)}
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#b9accf]" /> : null}
            </Button>

            {notifOpen ? (
              <Card className="ui-fade-in absolute right-0 top-full mt-2 w-[88vw] max-w-80 border-white/[0.08] bg-[#121925]/95 shadow-2xl shadow-black/35">
                <CardContent className="p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    {unreadCount > 0 ? <Badge className="border-[#b9accf]/30 bg-[#a996c4]/12 text-[#e0d7ef]">{unreadCount} new</Badge> : null}
                  </div>
                  <div className="space-y-2">
                    {notifications.length ? (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-xl border border-white/[0.06] px-3 py-2.5",
                            !item.readAt ? "bg-[#a996c4]/[0.06] border-[#b9accf]/20" : "bg-white/[0.02]"
                          )}
                        >
                          <p className="text-sm font-medium text-zinc-100">{item.title || "Notification"}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">{item.message || "No details available."}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center text-sm text-zinc-500">No notifications</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-xl px-1.5 text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white focus:outline-none sm:px-2">
                <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,#8f7ab0,#6e6381)] text-[11px] font-bold text-white">
                  <span className="absolute inset-0 flex items-center justify-center">
                    {(session?.user?.name || "A").charAt(0).toUpperCase()}
                  </span>
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "Admin"}
                      className="relative z-[1] h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div className="hidden text-left md:block">
                  <p className="max-w-[120px] truncate text-sm font-medium text-zinc-200">{session?.user?.name}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ui-fade-in w-56 border-white/[0.08] bg-[#121925]/95 text-zinc-200 backdrop-blur-xl">
              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-white">{session?.user?.name}</p>
                <p className="truncate text-xs text-zinc-500">{session?.user?.email}</p>
              </div>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/[0.05]" onClick={() => router.push("/admin/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-[#e0d7ef] focus:bg-[#a996c4]/10 focus:text-white" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
