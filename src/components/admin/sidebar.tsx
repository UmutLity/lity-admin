"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Settings, FileText, Bell, DollarSign, MessageSquare, BookOpen,
  Users, Shield, LogOut, Menu, ClipboardList,
  Download, PanelLeftClose, PanelLeft, Ticket, Landmark, Newspaper, ShoppingCart, TicketPercent, Truck, UserRoundCog, X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, createContext, useContext, useEffect, useRef } from "react";

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
  badge?: number;
}

const navGroups: NavGroup[] = [
  {
    title: "Navigation",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "EDITOR", "VIEWER"] },
      { href: "/admin/products", label: "Products", icon: Package, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/licenses", label: "Licenses", icon: Download, roles: ["ADMIN"] },
      { href: "/admin/changelog", label: "Changelogs", icon: FileText, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/guides", label: "Guides", icon: BookOpen, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/blog", label: "Blog", icon: Newspaper, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
      { href: "/admin/revenue", label: "Payments", icon: DollarSign, roles: ["ADMIN"] },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, roles: ["ADMIN"] },
      { href: "/admin/pending-deliveries", label: "Pending Deliveries", icon: Truck, roles: ["ADMIN"] },
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, roles: ["ADMIN"] },
      { href: "/admin/topups", label: "Top-up Requests", icon: Landmark, roles: ["ADMIN"] },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/notifications", label: "Community", icon: Bell, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/tickets", label: "Tickets", icon: Ticket, roles: ["ADMIN", "EDITOR"] },
      { href: "/admin/logs", label: "Logs", icon: ClipboardList, roles: ["ADMIN"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
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
  const router = useRouter();
  const { data: session, update } = useSession();
  const { collapsed, setCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const uploadAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      window.alert("Only PNG, JPG, or WEBP files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert("Profile photo size must be 5MB or less.");
      return;
    }

    try {
      setAvatarBusy(true);
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/admin/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Upload failed");
      await update?.({ image: data.data?.avatar || null });
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Profile photo upload failed.");
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => userRole && item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
    const isExact = pathname === item.href;
    const active = isExact || isActive;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:shadow-none",
          active
            ? "bg-[linear-gradient(135deg,rgba(154,136,187,0.14),rgba(136,132,152,0.08))] text-white shadow-[0_10px_24px_rgba(20,18,26,0.24)]"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
        )}
        title={collapsed ? item.label : undefined}
      >
        {/* Active indicator */}
        {active && (
          <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#b8abcf] to-[#9e92b7]" />
        )}
        <div className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          active
            ? "bg-[linear-gradient(135deg,rgba(154,136,187,0.16),rgba(136,132,152,0.12))] text-[#c1b5d4]"
            : "text-zinc-500 group-hover:bg-white/[0.04] group-hover:text-zinc-200"
        )}>
          <item.icon className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="truncate">{item.label}</span>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8f7ab0,#77688f)] shadow-[0_12px_28px_rgba(40,36,52,0.28)]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white">Lity Software</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">Control Surface</span>
            </div>
          </Link>
        ) : (
          <Link href="/admin">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8f7ab0,#77688f)] shadow-[0_12px_28px_rgba(40,36,52,0.28)]">
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
        {!collapsed && session?.user ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
            <div ref={notifRef} className="relative border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-6 w-6 items-center justify-center text-zinc-500">
                    <Bell className="h-[17px] w-[17px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#2b2038] px-1 text-[10px] font-bold text-[#e4daf5]">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[15px] font-medium text-[#cbbfe0]">Notifications</span>
                </div>
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#17131f] px-2 text-[10px] font-semibold text-[#cbbfe0]">
                  {unreadCount}
                </span>
              </button>

              {notifOpen && (
                <div className="absolute bottom-[calc(100%+10px)] left-0 z-[90] w-[320px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151515] shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#c83a57]" />
                      <span className="text-sm font-semibold text-white">Notifications</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="max-h-[280px] overflow-y-auto px-3 py-3">
                    {notifications.length === 0 ? (
                      <div className="flex min-h-[160px] flex-col items-center justify-center text-center text-zinc-500">
                        <Bell className="mb-3 h-9 w-9 text-zinc-700" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {notifications.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
                              !item.readAt && "bg-[#a996c4]/[0.06] border-[#a996c4]/20"
                            )}
                          >
                            <p className="text-sm font-medium text-zinc-200">{item.title || "Notification"}</p>
                            <p className="mt-1 text-xs text-zinc-500">{item.message || "No details available."}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
                className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/[0.06] transition hover:ring-white/[0.12] disabled:cursor-wait"
                title="Upload profile photo"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(147,112,219,0.18),rgba(34,28,46,0.92))] text-[12px] font-bold text-[#f2eaff]">
                  {(session.user.name || "A").charAt(0).toUpperCase()}
                </div>
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-none text-[#ff808f]">
                  {session.user.name}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff6d80]">
                  {userRole || "ADMIN"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/settings")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                title="Open settings"
              >
                <UserRoundCog className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.03] hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-zinc-500 transition-all duration-200 hover:bg-[#a996c4]/10 hover:text-[#c7bdd8]",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {collapsed && <span className="sr-only">Logout</span>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[70] h-full flex flex-col transition-all duration-300 ease-in-out",
          "border-r border-white/[0.06] bg-[linear-gradient(180deg,rgba(17,18,24,0.97),rgba(13,14,19,0.96))] backdrop-blur-xl",
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
          "lg:hidden fixed left-4 z-[80] h-10 w-10 flex items-center justify-center rounded-xl",
          "top-[calc(env(safe-area-inset-top,0px)+0.75rem)]",
          "bg-[#12131a] border border-white/[0.08] text-zinc-400 hover:text-white shadow-lg transition-all",
          mobileOpen && "opacity-0 pointer-events-none"
        )}
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}
