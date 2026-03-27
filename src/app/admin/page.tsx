"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  Crown,
  CreditCard,
  Gem,
  Gift,
  Search,
  ShoppingCart,
  Sparkles,
  Ticket,
  UserRound,
  Wallet,
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
  { name: "Bronze", min: 10, text: "text-amber-500", chip: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  { name: "Silver", min: 25, text: "text-slate-300", chip: "border-slate-400/25 bg-slate-400/10 text-slate-200" },
  { name: "Gold", min: 50, text: "text-yellow-400", chip: "border-yellow-500/25 bg-yellow-500/10 text-yellow-300" },
  { name: "Platinum", min: 100, text: "text-cyan-300", chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300" },
  { name: "Diamond", min: 250, text: "text-sky-300", chip: "border-sky-500/25 bg-sky-500/10 text-sky-300" },
  { name: "Ascendant", min: 500, text: "text-violet-300", chip: "border-violet-500/30 bg-violet-500/12 text-violet-300" },
  { name: "Sovereign", min: 1000, text: "text-orange-300", chip: "border-orange-500/30 bg-orange-500/12 text-orange-300" },
  { name: "Celestial", min: 2500, text: "text-fuchsia-300", chip: "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-300" },
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
  if (!matched) return { text: "text-zinc-500", chip: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400" };
  return matched;
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
    <div className={cn(
      "rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] p-3.5 shadow-[0_10px_20px_rgba(0,0,0,0.26)] transition-all",
      href ? "cursor-pointer hover:border-[#b9accf]/24 hover:bg-[linear-gradient(180deg,rgba(16,17,25,0.94),rgba(12,13,19,0.98))]" : ""
    )}>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs text-zinc-500">{title}</p>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={cn("text-[15px] font-bold leading-none tracking-tight text-white sm:text-[17px]", valueClass)}>{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
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
    <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] p-3.5 shadow-[0_10px_20px_rgba(0,0,0,0.26)]">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={cn("text-[22px] font-bold leading-none text-emerald-400 sm:text-[24px]", valueClass)}>{value}</p>
      <p className="mt-1.5 text-[11px] text-zinc-500">{subtext}</p>
    </div>
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
    <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] px-3.5 py-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[18px] font-semibold leading-none text-zinc-100 sm:text-[21px]">{title}</h3>
        <ArrowUpRight className="h-4 w-4 text-zinc-600" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="min-w-0">
          <p className="text-[22px] font-bold leading-none text-white sm:text-[24px]">{sales}</p>
          <p className="text-[11px] text-zinc-500">sales</p>
        </div>
        <div className="min-w-0">
          <p className="text-[20px] font-bold leading-none tabular-nums text-emerald-400 whitespace-nowrap sm:text-[22px]">{formatMoney(revenue)}</p>
          <p className="text-[11px] text-zinc-500">product rev.</p>
        </div>
        <div className="min-w-0">
          <p className="text-[20px] font-bold leading-none tabular-nums text-[#c7bdd8] whitespace-nowrap sm:text-[22px]">{formatMoney(deposits)}</p>
          <p className="text-[11px] text-zinc-500">deposits</p>
        </div>
        <div className="min-w-0">
          <p className="text-[22px] font-bold leading-none text-[#c7bdd8] sm:text-[24px]">{boxOpens}</p>
          <p className="text-[11px] text-zinc-500">box opens</p>
        </div>
      </div>

      <div className="mt-3.5 border-t border-white/[0.06] pt-2.5">
        <p className="flex items-center gap-1 text-xs text-zinc-400">
          <UserRound className="h-3.5 w-3.5 text-blue-400" />
          {users} new users
        </p>
      </div>
    </div>
  );
}

const BLOG_POSTS: any[] = [];

function BlogCard({
  title,
  excerpt,
  authorName,
  date,
}: {
  title: string;
  excerpt: string;
  authorName: string;
  date: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(17,16,24,0.92),rgba(12,12,18,0.98))] shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
      <div className="relative h-40 bg-[radial-gradient(circle_at_30%_20%,rgba(169,150,196,0.24),transparent_55%),linear-gradient(135deg,rgba(95,78,125,0.45),rgba(20,18,30,0.2))]">
        <span className="absolute left-3 top-3 rounded-full border border-[#b9accf]/35 bg-[#a996c4]/14 px-2.5 py-0.5 text-[10px] font-semibold text-[#d8cee8]">Blog</span>
      </div>
      <div className="space-y-2 p-4">
        <h4 className="line-clamp-2 text-xl font-semibold text-zinc-100">{title}</h4>
        <p className="line-clamp-2 text-sm text-zinc-400">{excerpt}</p>
        <p className="text-xs text-zinc-500">
          {date} • by {authorName}
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#d8cee8]">
          Live article
        </span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [blogSearch, setBlogSearch] = useState("");
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [rankSearch, setRankSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [productsRes, customersRes, ticketsRes, paymentsRes, blogRes] = await Promise.all([
        safeFetch("/api/admin/products"),
        safeFetch("/api/admin/customers"),
        safeFetch("/api/admin/tickets?status=ALL"),
        safeFetch("/api/admin/logs?type=payment&page=1&pageSize=300"),
        safeFetch("/api/admin/blog"),
      ]);

      const products = safeArray(productsRes?.data);
      const customers = safeArray(customersRes?.data);
      const tickets = safeArray(ticketsRes?.data);
      const payments = safeArray(paymentsRes?.data);
      const blog = safeArray(blogRes?.data);

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
        if (prev) {
          prev.spent += Number(payment.amount || 0);
        } else {
          spenderMap.set(cid, { id: cid, user, spent: Number(payment.amount || 0) });
        }
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
        .slice(0, 8)
        .map((row) => ({
          ...row,
          rank: resolveRank(row.spent),
        }));

      const next: DashboardData = {
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
      };

      if (active) {
        setData(next);
        setBlogPosts(blog);
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

  const filteredPosts = useMemo(() => {
    const query = blogSearch.trim().toLowerCase();
    return (blogPosts.length ? blogPosts : BLOG_POSTS)
      .filter((post: any) => !post.isDraft)
      .filter((post: any) => {
        if (!query) return true;
        return `${post.title || ""} ${post.excerpt || ""}`.toLowerCase().includes(query);
      })
      .slice(0, 12);
  }, [blogPosts, blogSearch]);

  const filteredLeaderboard = useMemo(() => {
    return data.leaderboard.filter((row) => row.user.toLowerCase().includes(rankSearch.toLowerCase()));
  }, [data.leaderboard, rankSearch]);

  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="text-[36px] font-bold leading-none text-white sm:text-[40px]">Admin Dashboard</h1>
          <p className="mt-2 text-[16px] text-zinc-400 sm:text-[18px]">Overview of your platform</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-xl border border-white/[0.07] bg-zinc-900/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[30px] font-bold leading-none text-white sm:text-[34px]">Admin Dashboard</h1>
        <p className="mt-1.5 text-[14px] text-zinc-400 sm:text-[16px]">Overview of your platform</p>
      </div>

      <div className="space-y-3.5">
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
          />
          <SummaryCard
            title="Product Sales"
            value={`$${data.productSales.toFixed(2)}`}
            subtext="Revenue from product purchases"
            icon={ShoppingCart}
            iconClass="bg-teal-500/15 text-teal-300"
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

        <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,15,22,0.94),rgba(11,12,18,0.98))] p-3.5 shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c7bdd8]" />
            <h3 className="text-[22px] font-semibold text-white">Recent Activity</h3>
          </div>

          <div className="space-y-2">
            {data.activities.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-5 text-zinc-500">No activity found.</div>
            ) : (
              data.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] px-3.5 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                        activity.type === "ticket" ? "bg-blue-500/12 text-blue-300" : "bg-emerald-500/12 text-emerald-300"
                      )}
                    >
                      {activity.type === "ticket" ? <Ticket className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
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
        </div>

        <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,15,22,0.94),rgba(11,12,18,0.98))] p-3.5 shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
          <div className="mb-4">
            <h3 className="text-[22px] font-semibold text-white">Blog</h3>
            <p className="text-sm text-zinc-400">Gaming tips, guides and updates</p>
          </div>

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative w-full xl:max-w-[620px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={blogSearch}
                onChange={(e) => setBlogSearch(e.target.value)}
                placeholder="Search articles..."
                className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-10 pr-3 text-sm text-zinc-300 placeholder:text-zinc-500 outline-none transition focus:border-[#b9accf]/35 focus:bg-white/[0.03]"
              />
            </label>
            <Link href="/admin/blog/new" className="rounded-xl border border-[#b9accf]/35 bg-[#a996c4]/14 px-4 py-2 text-xs font-semibold text-[#d8cee8] transition hover:bg-[#a996c4]/20">
              Write New Post
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredPosts.map((post: any) => (
              <BlogCard
                key={post.id}
                title={post.title}
                excerpt={post.excerpt || "No excerpt."}
                authorName={post.authorName || "Lity Team"}
                date={new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,15,22,0.94),rgba(11,12,18,0.98))] p-3.5 shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
          <div className="mb-4">
            <h3 className="text-[22px] font-semibold text-white">Leaderboard</h3>
            <p className="text-sm text-zinc-400">Top spenders and rank thresholds</p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {RANK_TIERS.map((tier) => (
              <span key={tier.name} className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium", tier.chip)}>
                {tier.name} ${tier.min}+
              </span>
            ))}
          </div>

          <label className="relative mb-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={rankSearch}
              onChange={(e) => setRankSearch(e.target.value)}
              placeholder="Search users..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-10 pr-3 text-sm text-zinc-300 placeholder:text-zinc-500 outline-none transition focus:border-[#b9accf]/35 focus:bg-white/[0.03]"
            />
          </label>

          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-white/[0.02]">
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Rank</th>
                  <th className="px-4 py-2.5 text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboard.map((row, idx) => {
                    const style = tierStyles(row.rank);
                    return (
                      <tr key={row.id} className="border-t border-white/[0.05] text-sm text-zinc-200">
                        <td className="px-4 py-3">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-zinc-100">{row.user}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", style.chip)}>
                            {row.rank === "Celestial" ? <Crown className="h-3 w-3" /> : row.rank === "Diamond" ? <Gem className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            <span className={style.text}>{row.rank}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">${row.spent.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
