"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  BookOpen,
  ClipboardList,
  Download,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Package,
  PanelLeft,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Ticket,
  TicketPercent,
  Truck,
  UserRoundCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Role = "FOUNDER" | "ADMIN" | "EDITOR" | "VIEWER" | "MODERATOR" | "SUPPORT" | "ANALYST";

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: Role[];
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["FOUNDER", "ADMIN", "MODERATOR", "SUPPORT", "EDITOR", "VIEWER", "ANALYST"] },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, roles: ["FOUNDER", "ADMIN", "MODERATOR", "SUPPORT"] },
      { href: "/admin/pending-deliveries", label: "Pending Deliveries", icon: Truck, roles: ["FOUNDER", "ADMIN", "MODERATOR", "SUPPORT"] },
      { href: "/admin/tickets", label: "Tickets", icon: Ticket, roles: ["FOUNDER", "ADMIN", "MODERATOR", "SUPPORT", "EDITOR"] },
      { href: "/admin/users", label: "Users", icon: Users, roles: ["FOUNDER", "ADMIN"] },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, roles: ["FOUNDER", "ADMIN", "EDITOR"] },
      { href: "/admin/licenses", label: "Licenses", icon: Download, roles: ["FOUNDER", "ADMIN", "MODERATOR"] },
      { href: "/admin/revenue", label: "Payments", icon: Wallet, roles: ["FOUNDER", "ADMIN"] },
      { href: "/admin/topups", label: "Top-up Requests", icon: Landmark, roles: ["FOUNDER", "ADMIN", "SUPPORT"] },
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, roles: ["FOUNDER", "ADMIN"] },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, roles: ["FOUNDER", "ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/changelog", label: "Changelogs", icon: FileText, roles: ["FOUNDER", "ADMIN", "EDITOR"] },
      { href: "/admin/guides", label: "Guides", icon: BookOpen, roles: ["FOUNDER", "ADMIN", "EDITOR"] },
      { href: "/admin/blog", label: "Blog", icon: Newspaper, roles: ["FOUNDER", "ADMIN", "EDITOR"] },
      { href: "/admin/logs", label: "Logs", icon: ClipboardList, roles: ["FOUNDER", "ADMIN"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["FOUNDER", "ADMIN"] },
    ],
  },
];

export const SidebarContext = createContext<{ collapsed: boolean; setCollapsed: (v: boolean) => void }>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <SidebarContext.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarContext.Provider>;
}

function getRoleTone(role?: string) {
  const normalized = String(role || "ADMIN").toUpperCase();
  if (normalized === "FOUNDER") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (normalized === "MODERATOR") return "border-sky-400/25 bg-sky-500/10 text-sky-200";
  if (normalized === "SUPPORT") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  return "border-[#b9accf]/30 bg-[#a996c4]/12 text-[#e0d7ef]";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, update } = useSession();
  const { collapsed, setCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRole = (session?.user as any)?.role as Role | undefined;
  const imageUrl = session?.user?.image || "";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/admin/notifications?limit=5", { credentials: "include" });
        const data = await res.json();
        if (data?.success) {
          setUnreadCount(Number(data.unreadCount || 0));
          setNotifications(Array.isArray(data.data) ? data.data : []);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => userRole && item.roles.includes(userRole)),
        }))
        .filter((group) => group.items.length > 0),
    [userRole]
  );

  const updateAvatarUrl = async () => {
    const nextUrl = window.prompt("Enter profile photo URL", imageUrl || "");
    if (nextUrl === null) return;
    try {
      setAvatarBusy(true);
      const res = await fetch("/api/admin/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: nextUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Upload failed");
      await update?.({ image: data.data?.avatar || null });
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Profile photo update failed.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));

    return (
      <Button
        key={item.href}
        asChild
        variant={active ? "secondary" : "ghost"}
        className={cn(
          "h-10 w-full justify-start rounded-xl px-3 text-sm font-medium transition-all",
          active
            ? "border border-white/[0.08] bg-white/[0.07] text-white shadow-none hover:bg-white/[0.08]"
            : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
          collapsed && "justify-center px-0"
        )}
      >
        <Link href={item.href} title={collapsed ? item.label : undefined}>
          <item.icon className={cn("h-4 w-4 flex-shrink-0", !collapsed && "mr-2.5")} />
          {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </Link>
      </Button>
    );
  };

  const notificationsPanel = (
    <div ref={notifRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setNotifOpen((prev) => !prev)}
        className={cn(
          "h-10 w-full justify-start rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#a996c4] px-1 text-[10px] font-semibold text-[#140f1a]">
              {unreadCount}
            </span>
          ) : null}
        </div>
        {!collapsed ? (
          <>
            <span className="ml-2.5 flex-1 text-left">Notifications</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-300">{unreadCount}</span>
          </>
        ) : null}
      </Button>

      {notifOpen ? (
        <Card className="absolute bottom-[calc(100%+12px)] left-0 z-[90] w-[320px] border-white/[0.08] bg-[#11131a]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#b9accf]" />
                <span className="text-sm font-semibold text-white">Notifications</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-white" onClick={() => setNotifOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto p-3">
              {notifications.length ? (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
                      !item.readAt && "border-[#b9accf]/20 bg-[#a996c4]/[0.06]"
                    )}
                  >
                    <p className="text-sm font-medium text-zinc-100">{item.title || "Notification"}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{item.message || "No details available."}</p>
                  </div>
                ))
              ) : (
                <div className="flex min-h-[160px] flex-col items-center justify-center text-center text-zinc-500">
                  <Bell className="mb-3 h-8 w-8 text-zinc-700" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  const userCard = session?.user ? (
    <Card className="border-white/[0.06] bg-white/[0.03] shadow-none">
      <CardContent className={cn("p-3", collapsed && "p-2.5")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <button
            type="button"
            disabled={avatarBusy}
            onClick={updateAvatarUrl}
            title="Set profile photo URL"
            className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(169,150,196,0.3),rgba(25,23,33,0.92))] text-sm font-bold text-white disabled:cursor-wait"
          >
            <span className="absolute inset-0 flex items-center justify-center">{(session.user.name || "A").charAt(0).toUpperCase()}</span>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={session.user.name || "Admin"}
                className="relative z-[1] h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </button>

          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{session.user.name}</p>
                <p className="truncate text-xs text-zinc-500">{session.user.email}</p>
              </div>
              <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", getRoleTone(userRole))}>
                {userRole || "ADMIN"}
              </Badge>
            </>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="h-9 flex-1 justify-start border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white" onClick={() => router.push("/admin/settings")}>
              <UserRoundCog className="h-4 w-4" /> Profile
            </Button>
            <Button variant="outline" className="h-9 flex-1 justify-start border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:bg-white/[0.05] hover:text-white" onClick={() => router.push("/admin/settings")}>
              <UserRoundCog className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:bg-white/[0.05] hover:text-white" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  ) : null;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-20 items-center border-b border-white/[0.06] px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,#8f7ab0,#6e6381)] shadow-[0_12px_28px_rgba(27,23,35,0.28)]">
            <Shield className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-white">Lity Software</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Admin Console</p>
            </div>
          ) : null}
        </Link>

        {!collapsed ? (
          <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-xl text-zinc-500 hover:bg-white/[0.05] hover:text-white lg:flex" onClick={() => setCollapsed(true)}>
            <PanelLeft className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed ? (
          <Card className="mb-4 border-white/[0.06] bg-white/[0.03] shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Search className="h-4 w-4 text-zinc-500" />
                <span>Use the top search to jump fast</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              {!collapsed ? <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{group.title}</p> : null}
              <div className="space-y-1.5">{group.items.map(renderNavItem)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="space-y-3">
          {notificationsPanel}
          {userCard}
          {collapsed ? (
            <Button variant="ghost" size="icon" className="hidden h-10 w-full rounded-xl border border-white/[0.06] text-zinc-400 hover:bg-white/[0.05] hover:text-white lg:flex" onClick={() => setCollapsed(false)}>
              <Menu className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen ? <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-[70] flex h-full flex-col border-r border-white/[0.06] bg-[#0d1016]/95 backdrop-blur-2xl transition-all duration-300",
          collapsed ? "w-[88px]" : "w-[292px]",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "max-lg:w-[292px] max-lg:shadow-2xl max-lg:shadow-black/50"
        )}
      >
        {sidebarContent}
      </aside>

      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className={cn(
          "fixed left-4 top-[calc(env(safe-area-inset-top,0px)+0.9rem)] z-[80] h-10 w-10 rounded-xl border-white/[0.08] bg-[#121620] text-zinc-300 shadow-lg lg:hidden",
          mobileOpen && "pointer-events-none opacity-0"
        )}
      >
        <Menu className="h-5 w-5" />
      </Button>
    </>
  );
}
