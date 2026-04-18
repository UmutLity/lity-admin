"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CreditCard,
  DollarSign,
  ShoppingCart,
  Ticket,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/admin/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/admin/dashboard/dashboard-shell";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { SectionHeader } from "@/components/admin/dashboard/section-header";
import { AlertRow } from "@/components/admin/dashboard/alert-row";
import { AnalyticsCard } from "@/components/admin/dashboard/analytics-card";
import { DataTable } from "@/components/admin/dashboard/data-table";

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
  todayDeposits: number;
  todayUsers: number;
  todayBoxRevenue: number;
  weekSales: number;
  weekRevenue: number;
  weekDeposits: number;
  weekUsers: number;
  weekBoxRevenue: number;
  monthSales: number;
  monthRevenue: number;
  monthDeposits: number;
  monthUsers: number;
  monthBoxRevenue: number;
  criticalUnreadCount: number;
  criticalAlerts: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    user: string;
    product: string;
    amount: number;
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
  todayDeposits: 0,
  todayUsers: 0,
  todayBoxRevenue: 0,
  weekSales: 0,
  weekRevenue: 0,
  weekDeposits: 0,
  weekUsers: 0,
  weekBoxRevenue: 0,
  monthSales: 0,
  monthRevenue: 0,
  monthDeposits: 0,
  monthUsers: 0,
  monthBoxRevenue: 0,
  criticalUnreadCount: 0,
  criticalAlerts: [],
  recentOrders: [],
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
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (hour < 24) return `${hour}h`;
  return `${day}d`;
}

function statusBadgeClass(status: string) {
  const value = status.toUpperCase();
  if (value.includes("DELIVERED") || value.includes("PAID")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";
  if (value.includes("PENDING") || value.includes("PROCESSING")) return "bg-amber-500/10 text-amber-300 border-amber-500/25";
  if (value.includes("CANCEL") || value.includes("REFUND")) return "bg-red-500/10 text-red-300 border-red-500/25";
  return "bg-violet-500/10 text-violet-300 border-violet-500/25";
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>(EMPTY);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [productsRes, customersRes, ticketsRes, paymentsRes, criticalRes, ordersRes] = await Promise.all([
        safeFetch("/api/admin/products"),
        safeFetch("/api/admin/customers"),
        safeFetch("/api/admin/tickets?status=ALL"),
        safeFetch("/api/admin/logs?type=payment&page=1&pageSize=300"),
        safeFetch("/api/admin/notifications?severity=CRITICAL&unread=true&limit=6"),
        safeFetch("/api/admin/orders"),
      ]);

      const products = safeArray(productsRes?.data);
      const customers = safeArray(customersRes?.data);
      const tickets = safeArray(ticketsRes?.data);
      const payments = safeArray(paymentsRes?.data);
      const orders = safeArray(ordersRes?.data);

      const criticalAlerts = safeArray(criticalRes?.data).map((item: any, idx: number) => ({
        id: String(item.id || `critical-${idx}-${Date.now()}`),
        title: String(item.title || "Critical alert"),
        message: String(item.message || ""),
        createdAt: String(item.createdAt || new Date().toISOString()),
      }));
      const criticalUnreadCount = Number(criticalRes?.unreadCount || criticalAlerts.length || 0);

      const debitPayments = payments.filter((p) => String(p.type || "").toUpperCase() === "DEBIT");
      const creditPayments = payments.filter((p) => String(p.type || "").toUpperCase() === "CREDIT");
      const mysteryPayments = debitPayments.filter((p) => String(p.reason || "").toLowerCase().includes("mystery"));

      const totalUsers = customers.length;
      const totalOrders = customers.reduce((acc, c) => acc + Number(c?._count?.orders || 0), 0);
      const totalRevenue = debitPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const activeProducts = products.filter((p) => p.isActive).length;
      const openTickets = tickets.filter((t) => ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(String(t.status))).length;
      const pendingPayments = creditPayments.filter((p) => String(p.status || "").toUpperCase() === "PENDING").length;

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

      const mysteryToday = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), todayFrom));
      const mysteryWeek = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), weekFrom));
      const mysteryMonth = mysteryPayments.filter((p) => inRange(String(p.createdAt || ""), monthFrom));

      const recentOrders = orders
        .slice(0, 8)
        .map((order: any) => ({
          id: String(order.id || ""),
          user: String(order?.customer?.username || order?.customer?.email || "Guest"),
          product: String(order?.items?.[0]?.product?.name || "Product"),
          amount: Number(order.totalAmount || 0),
          status: String(order.status || "PENDING"),
          createdAt: String(order.createdAt || new Date().toISOString()),
        }));

      if (!active) return;

      setData({
        totalUsers,
        totalOrders,
        totalRevenue,
        pendingPayments,
        activeProducts,
        openTickets,
        todaySales: salesToday.length,
        todayRevenue: salesToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        todayDeposits: depositsToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        todayUsers: usersToday,
        todayBoxRevenue: mysteryToday.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        weekSales: salesWeek.length,
        weekRevenue: salesWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        weekDeposits: depositsWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        weekUsers: usersWeek,
        weekBoxRevenue: mysteryWeek.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        monthSales: salesMonth.length,
        monthRevenue: salesMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        monthDeposits: depositsMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        monthUsers: usersMonth,
        monthBoxRevenue: mysteryMonth.reduce((acc, s) => acc + Number(s.amount || 0), 0),
        criticalUnreadCount,
        criticalAlerts,
        recentOrders,
      });
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "id", header: "ID", render: (row: DashboardData["recentOrders"][number]) => <span className="font-mono text-[11px] text-zinc-400">{row.id.slice(0, 8)}</span> },
      { key: "user", header: "User", render: (row: DashboardData["recentOrders"][number]) => <span className="text-zinc-200">{row.user}</span> },
      { key: "product", header: "Product", render: (row: DashboardData["recentOrders"][number]) => <span className="text-zinc-300">{row.product}</span> },
      { key: "amount", header: "Amount", render: (row: DashboardData["recentOrders"][number]) => <span className="font-semibold text-emerald-300">${row.amount.toFixed(2)}</span> },
      {
        key: "status",
        header: "Status",
        render: (row: DashboardData["recentOrders"][number]) => (
          <Badge className={cn("rounded-full border text-[10px] uppercase tracking-wide", statusBadgeClass(row.status))}>{row.status}</Badge>
        ),
      },
      { key: "date", header: "Date", render: (row: DashboardData["recentOrders"][number]) => <span className="text-zinc-500">{timeAgo(row.createdAt)}</span> },
    ],
    []
  );

  return (
    <DashboardShell>
      <div className="grid gap-4">
        <Topbar title="Dashboard" description="Operational overview">
          <Link href="/admin/orders">
            <Button variant="outline" className="h-8 rounded-xl border-white/[0.1] bg-white/[0.02] px-3 text-xs text-zinc-200 hover:bg-white/[0.06]">
              Open Orders
            </Button>
          </Link>
        </Topbar>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            <KpiCard label="Revenue" value={`$${data.totalRevenue.toFixed(2)}`} icon={DollarSign} tone="green" />
            <KpiCard label="Orders" value={data.totalOrders} icon={ShoppingCart} tone="green" />
            <KpiCard label="Tickets" value={data.openTickets} icon={Ticket} tone="red" />
            <KpiCard label="Pending Payments" value={data.pendingPayments} icon={CreditCard} tone="yellow" />
            <KpiCard label="Users" value={data.totalUsers} icon={UserRound} tone="purple" />
            <KpiCard label="Products" value={data.activeProducts} icon={Boxes} tone="purple" />
          </div>

          <div className="admin-card rounded-2xl p-4">
            <SectionHeader
              title="Critical Alerts"
              description="High-priority system events"
              action={<Badge className="rounded-full border border-red-500/30 bg-red-500/10 text-[10px] uppercase tracking-wide text-red-200">{data.criticalUnreadCount} unread</Badge>}
            />
            <div className="mt-3 grid gap-2">
              {loading ? (
                <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
              ) : data.criticalAlerts.length === 0 ? (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-zinc-500">No unread critical alerts.</p>
              ) : (
                data.criticalAlerts.slice(0, 4).map((alert) => (
                  <AlertRow
                    key={alert.id}
                    title={alert.title}
                    message={alert.message}
                    time={timeAgo(alert.createdAt)}
                    action={
                      <Link href="/admin/notifications?filter=critical">
                        <Button variant="outline" className="h-7 rounded-lg border-red-500/30 bg-red-500/10 px-2 text-[11px] text-red-100 hover:bg-red-500/15">
                          Open
                        </Button>
                      </Link>
                    }
                  />
                ))
              )}
            </div>
          </div>

          <AnalyticsCard
            today={{
              salesCount: data.todaySales,
              revenue: data.todayRevenue,
              deposits: data.todayDeposits,
              boxRevenue: data.todayBoxRevenue,
              users: data.todayUsers,
            }}
            week={{
              salesCount: data.weekSales,
              revenue: data.weekRevenue,
              deposits: data.weekDeposits,
              boxRevenue: data.weekBoxRevenue,
              users: data.weekUsers,
            }}
            month={{
              salesCount: data.monthSales,
              revenue: data.monthRevenue,
              deposits: data.monthDeposits,
              boxRevenue: data.monthBoxRevenue,
              users: data.monthUsers,
            }}
          />

          <div className="admin-card rounded-2xl p-4">
            <SectionHeader title="Recent Orders" description="Latest transactions and delivery state" />
            <div className="mt-3">
              <DataTable columns={columns} rows={data.recentOrders} emptyText="No recent orders." />
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

