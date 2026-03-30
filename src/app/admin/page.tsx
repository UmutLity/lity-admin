"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  CreditCard,
  Gift,
  ShoppingCart,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AnyJson = Record<string, any>;

interface DashboardData {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayments: number;
  activeProducts: number;
  openTickets: number;
  totalDeposits: number;
  productSales: number;
  mysteryBoxRevenue: number;
  todaySales: number;
  todayRevenue: number;
  todayDeposits: number;
  todayUsers: number;
  todayBoxOpens: number;
  weekSales: number;
  weekRevenue: number;
  weekDeposits: number;
  weekUsers: number;
  weekBoxOpens: number;
  monthSales: number;
  monthRevenue: number;
  monthDeposits: number;
  monthUsers: number;
  monthBoxOpens: number;
  activities: Array<{
    id: string;
    label: string;
    detail: string;
    type: "ticket" | "order" | "payment";
    status: string;
    createdAt: string;
  }>;
  leaderboard: Array<{
    id: string;
    user: string;
    spent: number;
    rank: string;
  }>;
}

const EMPTY: DashboardData = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  pendingPayments: 0,
  activeProducts: 0,
  openTickets: 0,
  totalDeposits: 0,
  productSales: 0,
  mysteryBoxRevenue: 0,
  todaySales: 0,
  todayRevenue: 0,
  todayDeposits: 0,
  todayUsers: 0,
  todayBoxOpens: 0,
  weekSales: 0,
  weekRevenue: 0,
  weekDeposits: 0,
  weekUsers: 0,
  weekBoxOpens: 0,
  monthSales: 0,
  monthRevenue: 0,
  monthDeposits: 0,
  monthUsers: 0,
  monthBoxOpens: 0,
  activities: [],
  leaderboard: [],
};

const RANK_TIERS = [
  { name: "Bronze", min: 10, text: "text-amber-400" },
  { name: "Silver", min: 25, text: "text-slate-300" },
  { name: "Gold", min: 50, text: "text-yellow-400" },
  { name: "Platinum", min: 100, text: "text-cyan-300" },
  { name: "Diamond", min: 250, text: "text-sky-300" },
  { name: "Ascendant", min: 500, text: "text-violet-300" },
  { name: "Sovereign", min: 1000, text: "text-orange-300" },
  { name: "Celestial", min: 2500, text: "text-fuchsia-300" },
] as const;

function resolveRank(spent: number) {
  let current = "Unranked";
  for (const tier of RANK_TIERS) {
    if (spent >= tier.min) current = tier.name;
  }
  return current;
}

function tierStyles(rank: string) {
  const matched = RANK_TIERS.find((t) => t.name === rank);
  return matched ? matched.text : "text-zinc-500";
}

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
  href,
}: {
  title: string;
  value: string | number;
  icon: any;
  iconClass: string;
  valueClass?: string;
  href?: string;
}) {
  const card = (
    <Card
      className={cn(
        "border-white/[0.06] bg-white/[0.03] shadow-none transition-colors",
        href ? "cursor-pointer hover:border-white/[0.14] hover:bg-[#121520]" : ""
      )}
    >
      <CardContent className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-zinc-500">{title}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06]", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn("text-[18px] font-bold leading-none tracking-tight text-white sm:text-[19px]", valueClass)}>{value}</p>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function SummaryCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconClass,
  valueClass,
}: {
  title: string;
  value: string;
  subtext: string;
  icon: any;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.03] shadow-none">
      <CardContent className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06]", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn("text-[28px] font-bold leading-none sm:text-[30px]", valueClass || "text-white")}>{value}</p>
      <p className="mt-2 text-[11px] text-zinc-500">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function PeriodCard({
  title,
  sales,
  revenue,
  deposits,
  users,
  boxOpens,
}: {
  title: string;
  sales: number;
  revenue: number;
  deposits: number;
  users: number;
  boxOpens: number;
}) {
  const formatMoney = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card className="border-white/[0.06] bg-white/[0.03] shadow-none">
      <CardContent className="px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[18px] font-semibold leading-none text-zinc-100 sm:text-[20px]">{title}</h3>
        <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Summary
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="min-w-0">
          <p className="text-[20px] font-bold leading-none text-white sm:text-[22px]">{sales}</p>
          <p className="mt-1 text-[11px] text-zinc-500">sales</p>
        </div>
        <div className="min-w-0">
          <p className="text-[18px] font-bold leading-none text-emerald-400 sm:text-[20px]">{formatMoney(revenue)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">product rev.</p>
        </div>
        <div className="min-w-0">
          <p className="text-[18px] font-bold leading-none text-[#c7bdd8] sm:text-[20px]">{formatMoney(deposits)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">deposits</p>
        </div>
        <div className="min-w-0">
          <p className="text-[20px] font-bold leading-none text-[#c7bdd8] sm:text-[22px]">{boxOpens}</p>
          <p className="mt-1 text-[11px] text-zinc-500">box opens</p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <p className="flex items-center gap-1 text-xs text-zinc-400">
          <UserRound className="h-3.5 w-3.5 text-blue-400" />
          {users} new users
        </p>
      </div>
      </CardContent>
    </Card>
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

      const debitPayments = payments.filter((p) => String(p.type || "").toUpperCase() === "DEBIT");
      const creditPayments = payments.filter((p) => String(p.type || "").toUpperCase() === "CREDIT");
      const mysteryPayments = debitPayments.filter((p) => String(p.reason || "").toLowerCase().includes("mystery"));

      const totalUsers = customers.length;
      const totalOrders = customers.reduce((acc, c) => acc + Number(c?._count?.orders || 0), 0);
      const totalRevenue = debitPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const activeProducts = products.filter((p) => p.isActive).length;
      const openTickets = tickets.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(String(t.status))).length;
      const pendingPayments = creditPayments.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length;
      const totalDeposits = creditPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const productSales = totalRevenue;
      const mysteryBoxRevenue = mysteryPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const todayFrom = startOfToday();
      const weekFrom = daysAgo(7);
      const monthFrom = daysAgo(30);

      const salesToday = debitPayments.filter((p) => inRange(String(p.createdAt || ""), todayFrom));
      const salesWeek = debitPayments.filter((p) => inRange(String(p.createdAt || ""), weekFrom));
      const salesMonth = debitPayments.filter((p) => inRange(String(p.createdAt || ""), monthFrom));

      const depositsToday = creditPayments.filter((p) => inRange(String(p.createdAt || ""), todayFrom));
      const depositsWeek = creditPayments.filter((p) => inRange(String(p.createdAt || ""), weekFrom));
      const depositsMonth = creditPayments.filter((p) => inRange(String(p.createdAt || ""), monthFrom));

      const usersToday = customers.filter((c) => inRange(String(c.createdAt || ""), todayFrom)).length;
      const usersWeek = customers.filter((c) => inRange(String(c.createdAt || ""), weekFrom)).length;
      const usersMonth = customers.filter((c) => inRange(String(c.createdAt || ""), monthFrom)).length;

      const mysteryToday = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), todayFrom)).length;
      const mysteryWeek = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), weekFrom)).length;
      const mysteryMonth = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), monthFrom)).length;

      const ticketActivities = tickets.slice(0, 8).map((t: any) => ({
        id: `ticket-${t.id}`,
        label: t.email || t.discordUsername || "User",
        detail: t.subject || "Support ticket",
        type: "ticket" as const,
        status: String(t.status || "OPEN").toLowerCase(),
        createdAt: String(t.createdAt || new Date().toISOString()),
      }));

      const paymentActivities = payments.slice(0, 8).map((p: any) => ({
        id: `payment-${p.id}`,
        label: p.customer?.username || "Customer",
        detail: `$${Number(p.amount || 0).toFixed(2)} via ${p.reason || "wallet"}`,
        type: "payment" as const,
        status: String(p.type || "").toUpperCase() === "DEBIT" ? "active" : "awaiting",
        createdAt: String(p.createdAt || new Date().toISOString()),
      }));

      const activities = [...ticketActivities, ...paymentActivities]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 10);

      const spenderMap = new Map<string, { id: string; user: string; spent: number }>();
      for (const payment of debitPayments) {
        const cid = String(payment.customerId || payment.customer?.id || payment.customer?.email || payment.id);
        const user = payment.customer?.username || payment.customer?.email || "Guest User";
        const prev = spenderMap.get(cid);
        if (prev) prev.spent += Number(payment.amount || 0);
        else spenderMap.set(cid, { id: cid, user, spent: Number(payment.amount || 0) });
      }

      if (spenderMap.size === 0) {
        customers.slice(0, 6).forEach((c: any, idx: number) => {
          const cid = String(c.id || idx + 1);
          spenderMap.set(cid, {
            id: cid,
            user: c.username || c.email || `User ${idx + 1}`,
            spent: 0,
          });
        });
      }

      const leaderboard = Array.from(spenderMap.values())
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 6)
        .map((row) => ({
          ...row,
          rank: resolveRank(row.spent),
        }));

      if (active) {
        setData({
          totalUsers,
          totalOrders,
          totalRevenue,
          pendingPayments,
          activeProducts,
          openTickets,
          totalDeposits,
          productSales,
          mysteryBoxRevenue,
          todaySales: salesToday.length,
          todayRevenue: salesToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          todayDeposits: depositsToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          todayUsers: usersToday,
          todayBoxOpens: mysteryToday,
          weekSales: salesWeek.length,
          weekRevenue: salesWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          weekDeposits: depositsWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          weekUsers: usersWeek,
          weekBoxOpens: mysteryWeek,
          monthSales: salesMonth.length,
          monthRevenue: salesMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          monthDeposits: depositsMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
          monthUsers: usersMonth,
          monthBoxOpens: mysteryMonth,
          activities,
          leaderboard,
        });
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
      if (status.includes("waiting") || status.includes("awaiting")) return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/25";
      if (status.includes("resolved") || status.includes("closed")) return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25";
      if (status.includes("active")) return "bg-teal-500/15 text-teal-300 border border-teal-500/25";
      return "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25";
    };
  }, []);

  if (loading) {
    return (
      <div>
        <Topbar title="Admin Dashboard" description="Overview of your platform" />
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="h-96 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            <div className="h-96 rounded-2xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Admin Dashboard" description="Overview of your platform">
        <Button asChild variant="outline" className="border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] hover:text-white">
          <Link href="/admin/orders">Open Orders</Link>
        </Button>
      </Topbar>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={data.totalUsers} icon={UserRound} iconClass="bg-blue-500/15 text-blue-300" />
          <StatCard title="Total Orders" value={data.totalOrders} icon={ShoppingCart} iconClass="bg-emerald-500/15 text-emerald-300" />
          <StatCard title="Total Revenue" value={`$${data.totalRevenue.toFixed(2)}`} icon={BadgeDollarSign} iconClass="bg-emerald-500/15 text-emerald-300" valueClass="text-emerald-400" />
          <StatCard title="Pending Payments" value={data.pendingPayments} icon={CreditCard} iconClass="bg-amber-500/15 text-amber-300" href="/admin/topups" />
          <StatCard title="Active Products" value={data.activeProducts} icon={Boxes} iconClass="bg-violet-500/15 text-violet-300" href="/admin/products" />
          <StatCard title="Open Tickets" value={data.openTickets} icon={AlertTriangle} iconClass="bg-rose-500/15 text-rose-300" href="/admin/tickets" />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <SummaryCard
            title="Balance Deposits"
            value={`$${data.totalDeposits.toFixed(2)}`}
            subtext="Total approved deposits"
            icon={Wallet}
            iconClass="bg-emerald-500/15 text-emerald-300"
            valueClass="text-emerald-400"
          />
          <SummaryCard
            title="Product Sales"
            value={`$${data.productSales.toFixed(2)}`}
            subtext="Revenue from product purchases"
            icon={ShoppingCart}
            iconClass="bg-teal-500/15 text-teal-300"
            valueClass="text-emerald-400"
          />
          <SummaryCard
            title="Mystery Box"
            value={`$${data.mysteryBoxRevenue.toFixed(2)}`}
            subtext={`${data.monthBoxOpens} total opens this month`}
            icon={Gift}
            iconClass="bg-[#a996c4]/18 text-[#d7caea]"
            valueClass="text-[#d7caea]"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <PeriodCard
            title="Today"
            sales={data.todaySales}
            revenue={data.todayRevenue}
            deposits={data.todayDeposits}
            users={data.todayUsers}
            boxOpens={data.todayBoxOpens}
          />
          <PeriodCard
            title="This Week"
            sales={data.weekSales}
            revenue={data.weekRevenue}
            deposits={data.weekDeposits}
            users={data.weekUsers}
            boxOpens={data.weekBoxOpens}
          />
          <PeriodCard
            title="This Month"
            sales={data.monthSales}
            revenue={data.monthRevenue}
            deposits={data.monthDeposits}
            users={data.monthUsers}
            boxOpens={data.monthBoxOpens}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_0.9fr]">
          <Card className="border-white/[0.06] bg-white/[0.03] shadow-none">
            <CardHeader className="pb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#c7bdd8]" />
                <CardTitle className="text-[22px] font-semibold text-white">Recent Activity</CardTitle>
              </div>
              <CardDescription>Orders, payments, and support signals across the platform.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">

            <div className="space-y-2">
              {data.activities.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-zinc-500">No activity found.</div>
              ) : (
                data.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-colors hover:bg-white/[0.035]"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.06]",
                          activity.type === "ticket" ? "bg-blue-500/10 text-blue-300" : "bg-emerald-500/10 text-emerald-300"
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
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-700" />
                    </div>
                  </div>
                ))
              )}
            </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.06] bg-white/[0.03] shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-[22px] font-semibold text-white">Top Customers</CardTitle>
              <CardDescription>Highest spenders this cycle</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">

            <div className="space-y-2">
              {data.leaderboard.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-zinc-500">No user data yet.</div>
              ) : (
                data.leaderboard.map((row, idx) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-sm font-semibold text-zinc-300">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">{row.user}</p>
                        <div className="mt-1">
                          <Badge variant="outline" className={cn("border-white/[0.08] bg-white/[0.03] text-xs font-medium", tierStyles(row.rank))}>
                            {row.rank}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white">${row.spent.toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
