"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  CreditCard,
  ShoppingCart,
  Ticket,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AnyJson = Record<string, any>;

interface DashboardData {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayments: number;
  activeProducts: number;
  openTickets: number;
  todaySales: number;
  todayRevenue: number;
  todayUsers: number;
  weekSales: number;
  weekRevenue: number;
  weekUsers: number;
  monthSales: number;
  monthRevenue: number;
  monthUsers: number;
  activities: Array<{
    id: string;
    label: string;
    detail: string;
    type: "ticket" | "order" | "payment";
    status: string;
    createdAt: string;
  }>;
}

const EMPTY: DashboardData = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  pendingPayments: 0,
  activeProducts: 0,
  openTickets: 0,
  todaySales: 0,
  todayRevenue: 0,
  todayUsers: 0,
  weekSales: 0,
  weekRevenue: 0,
  weekUsers: 0,
  monthSales: 0,
  monthRevenue: 0,
  monthUsers: 0,
  activities: [],
};

function safeArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function isSuccessPayload(data: any) {
  return !!data && data.success === true;
}

async function safeFetch(path: string): Promise<AnyJson | null> {
  try {
    const res = await fetch(path, { credentials: "include" });
    const data = await res.json();
    if (!res.ok || !isSuccessPayload(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function inRange(dateStr: string, from: Date) {
  const ts = new Date(dateStr).getTime();
  return Number.isFinite(ts) && ts >= from.getTime();
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return "-";
  const diffMs = Math.max(0, now - ts);
  const min = Math.floor(diffMs / (1000 * 60));
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  return `${day}d ago`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconClass,
  valueClass,
}: {
  title: string;
  value: string | number;
  icon: any;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(15,16,24,0.95),rgba(12,13,20,0.98))] p-4 shadow-[0_16px_40px_rgba(5,6,10,0.25)]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn("text-[30px] font-bold leading-none tracking-tight text-white", valueClass)}>{value}</p>
    </div>
  );
}

function PeriodCard({
  title,
  sales,
  revenue,
  users,
}: {
  title: string;
  sales: number;
  revenue: number;
  users: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(14,16,24,0.94),rgba(12,13,20,0.98))] px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[28px] font-semibold text-zinc-200">{title}</h3>
        <ArrowUpRight className="h-4 w-4 text-zinc-600" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="min-w-0">
          <p className="truncate text-3xl font-bold leading-tight tabular-nums text-white xl:text-4xl">{sales}</p>
          <p className="text-xs text-zinc-500">sales</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-3xl font-bold leading-tight tabular-nums text-emerald-400 xl:text-4xl">${revenue.toFixed(2)}</p>
          <p className="text-xs text-zinc-500">revenue</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-3xl font-bold leading-tight tabular-nums text-blue-400 xl:text-4xl">
            <UserRound className="h-4 w-4 shrink-0" />
            {users}
          </p>
          <p className="text-xs text-zinc-500">new users</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>(EMPTY);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [productsRes, customersRes, ticketsRes, paymentsRes] = await Promise.all([
        safeFetch("/api/admin/products"),
        safeFetch("/api/admin/customers"),
        safeFetch("/api/admin/tickets?status=ALL"),
        safeFetch("/api/admin/logs?type=payment&page=1&pageSize=300"),
      ]);

      const products = safeArray(productsRes?.data);
      const customers = safeArray(customersRes?.data);
      const tickets = safeArray(ticketsRes?.data);
      const payments = safeArray(paymentsRes?.data);

      const totalUsers = customers.length;
      const totalOrders = customers.reduce((acc, c) => acc + Number(c?._count?.orders || 0), 0);
      const totalRevenue = payments
        .filter((p) => String(p.type || "").toUpperCase() === "DEBIT")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const activeProducts = products.filter((p) => p.isActive).length;
      const openTickets = tickets.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(String(t.status))).length;
      const pendingPayments = 0;

      const todayFrom = startOfToday();
      const weekFrom = daysAgo(7);
      const monthFrom = daysAgo(30);

      const salesToday = payments.filter((p) => String(p.type || "").toUpperCase() === "DEBIT" && inRange(String(p.createdAt || ""), todayFrom));
      const salesWeek = payments.filter((p) => String(p.type || "").toUpperCase() === "DEBIT" && inRange(String(p.createdAt || ""), weekFrom));
      const salesMonth = payments.filter((p) => String(p.type || "").toUpperCase() === "DEBIT" && inRange(String(p.createdAt || ""), monthFrom));

      const usersToday = customers.filter((c) => inRange(String(c.createdAt || ""), todayFrom)).length;
      const usersWeek = customers.filter((c) => inRange(String(c.createdAt || ""), weekFrom)).length;
      const usersMonth = customers.filter((c) => inRange(String(c.createdAt || ""), monthFrom)).length;

      const ticketActivities = tickets.slice(0, 6).map((t: any) => ({
        id: `ticket-${t.id}`,
        label: t.email || t.discordUsername || "User",
        detail: t.subject || "Support ticket",
        type: "ticket" as const,
        status: String(t.status || "OPEN").toLowerCase(),
        createdAt: String(t.createdAt || new Date().toISOString()),
      }));

      const paymentActivities = payments.slice(0, 6).map((p: any) => ({
        id: `payment-${p.id}`,
        label: p.customer?.username || "Customer",
        detail: `$${Number(p.amount || 0).toFixed(2)} via ${p.reason || "wallet"}`,
        type: "payment" as const,
        status: String(p.type || "").toUpperCase() === "DEBIT" ? "approved" : "credit",
        createdAt: String(p.createdAt || new Date().toISOString()),
      }));

      const activities = [...ticketActivities, ...paymentActivities]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 10);

      const next: DashboardData = {
        totalUsers,
        totalOrders,
        totalRevenue,
        pendingPayments,
        activeProducts,
        openTickets,
        todaySales: salesToday.length,
        todayRevenue: salesToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        todayUsers: usersToday,
        weekSales: salesWeek.length,
        weekRevenue: salesWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        weekUsers: usersWeek,
        monthSales: salesMonth.length,
        monthRevenue: salesMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        monthUsers: usersMonth,
        activities,
      };

      if (active) {
        setData(next);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const activityStatusClass = useMemo(() => {
    return (status: string) => {
      if (status.includes("open")) return "bg-blue-500/15 text-blue-300 border border-blue-500/25";
      if (status.includes("progress")) return "bg-amber-500/15 text-amber-300 border border-amber-500/25";
      if (status.includes("waiting")) return "bg-orange-500/15 text-orange-300 border border-orange-500/25";
      if (status.includes("resolved") || status.includes("closed") || status.includes("approved")) return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25";
      if (status.includes("credit")) return "bg-violet-500/15 text-violet-300 border border-violet-500/25";
      return "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25";
    };
  }, []);

  if (loading) {
    return (
      <div>
        <Topbar title="Admin Dashboard" description="Overview of your platform" />
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Admin Dashboard" description="Overview of your platform" />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={data.totalUsers} icon={UserRound} iconClass="bg-blue-500/15 text-blue-300" />
          <StatCard title="Total Orders" value={data.totalOrders} icon={ShoppingCart} iconClass="bg-emerald-500/15 text-emerald-300" />
          <StatCard title="Total Revenue" value={`$${data.totalRevenue.toFixed(2)}`} icon={BadgeDollarSign} iconClass="bg-emerald-500/18 text-emerald-300" valueClass="text-emerald-400" />
          <StatCard title="Pending Payments" value={data.pendingPayments} icon={CreditCard} iconClass="bg-amber-500/15 text-amber-300" />
          <StatCard title="Active Products" value={data.activeProducts} icon={Boxes} iconClass="bg-violet-500/18 text-violet-300" />
          <StatCard title="Open Tickets" value={data.openTickets} icon={AlertTriangle} iconClass="bg-rose-500/15 text-rose-300" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <PeriodCard title="Today" sales={data.todaySales} revenue={data.todayRevenue} users={data.todayUsers} />
          <PeriodCard title="This Week" sales={data.weekSales} revenue={data.weekRevenue} users={data.weekUsers} />
          <PeriodCard title="This Month" sales={data.monthSales} revenue={data.monthRevenue} users={data.monthUsers} />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,16,24,0.95),rgba(11,12,19,0.98))] p-5 shadow-[0_22px_60px_rgba(4,6,12,0.28)]">
          <div className="mb-5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <h3 className="text-3xl font-semibold text-white">Recent Activity</h3>
          </div>

          <div className="space-y-2">
            {data.activities.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-5 text-zinc-500">No activity found.</div>
            ) : (
              data.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                        activity.type === "ticket" ? "bg-blue-500/12 text-blue-300" : "bg-violet-500/12 text-violet-300"
                      )}
                    >
                      {activity.type === "ticket" ? <Ticket className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{activity.label}</p>
                      <p className="truncate text-xs text-zinc-500">{activity.detail}</p>
                    </div>
                  </div>

                  <div className="ml-4 flex items-center gap-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", activityStatusClass(activity.status))}>
                      {activity.status}
                    </span>
                    <span className="text-xs text-zinc-500">{timeAgo(activity.createdAt)}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-700" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
