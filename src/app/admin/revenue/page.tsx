"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DollarSign, ShoppingCart, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { formatCurrency, formatDate } from "@/lib/utils";

type OrderRow = {
  id: string;
  createdAt: string;
  status: string;
  paymentMethod: string | null;
  totalAmount: number;
  discountAmount?: number | null;
  customer: { id: string; username: string; email: string } | null;
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    plan: string;
    amount: number;
    licenseCount: number;
  }>;
};

type OrdersResponse = {
  success: boolean;
  data: {
    summary: {
      totalOrders: number;
      totalRevenue: number;
      licensesSold: number;
    };
    orders: OrderRow[];
  };
};

type TopupRow = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  customer: { id: string; username: string; email: string; balance: number };
};

function startOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(value: string | Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

export default function RevenuePage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [topups, setTopups] = useState<TopupRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const [ordersRes, topupsRes] = await Promise.all([
          fetch("/api/admin/orders?limit=200", { credentials: "include" }),
          fetch("/api/admin/topup-requests?status=ALL&page=1&pageSize=200", { credentials: "include" }),
        ]);

        const ordersJson: OrdersResponse = await ordersRes.json();
        const topupsJson = await topupsRes.json();

        if (!alive) return;
        setOrders(Array.isArray(ordersJson?.data?.orders) ? ordersJson.data.orders : []);
        setTopups(Array.isArray(topupsJson?.data) ? topupsJson.data : []);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const validOrders = orders.filter((order) => order.status !== "CANCELED");
    const now = new Date();
    const thisMonth = validOrders.filter((order) => {
      const created = new Date(order.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    const thisWeek = validOrders.filter((order) => now.getTime() - new Date(order.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
    const approvedTopups = topups.filter((row) => row.status === "APPROVED");

    return {
      totalRevenue: validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      monthlyRevenue: thisMonth.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      weeklyRevenue: thisWeek.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      totalOrders: validOrders.length,
      averageOrderValue: validOrders.length
        ? validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0) / validOrders.length
        : 0,
      approvedTopupVolume: approvedTopups.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }, [orders, topups]);

  const revenueSeries = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      buckets.set(dayKey(date), 0);
    }
    orders
      .filter((order) => order.status !== "CANCELED")
      .forEach((order) => {
        const key = dayKey(order.createdAt);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + Number(order.totalAmount || 0));
      });

    const max = Math.max(...Array.from(buckets.values()), 1);
    return Array.from(buckets.entries()).map(([key, amount]) => ({
      key,
      amount,
      height: `${Math.max(12, Math.round((amount / max) * 100))}%`,
      label: new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; revenue: number; sales: number }>();
    orders.filter((order) => order.status !== "CANCELED").forEach((order) => {
      order.items.forEach((item) => {
        const existing = map.get(item.productSlug) || {
          name: item.productName,
          slug: item.productSlug,
          revenue: 0,
          sales: 0,
        };
        existing.revenue += Number(item.amount || 0);
        existing.sales += 1;
        map.set(item.productSlug, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { id: string; username: string; email: string; spent: number; orders: number }>();
    orders.filter((order) => order.status !== "CANCELED").forEach((order) => {
      if (!order.customer) return;
      const existing = map.get(order.customer.id) || {
        id: order.customer.id,
        username: order.customer.username,
        email: order.customer.email,
        spent: 0,
        orders: 0,
      };
      existing.spent += Number(order.totalAmount || 0);
      existing.orders += 1;
      map.set(order.customer.id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6">
      <Topbar title="Revenue & Sales" description="Live revenue analytics, top customers, and sales performance." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Revenue", value: formatCurrency(metrics.totalRevenue), sub: "All completed orders", icon: DollarSign, tone: "text-emerald-300" },
          { label: "Monthly Revenue", value: formatCurrency(metrics.monthlyRevenue), sub: "Current calendar month", icon: TrendingUp, tone: "text-violet-300" },
          { label: "Weekly Revenue", value: formatCurrency(metrics.weeklyRevenue), sub: "Last 7 days", icon: ArrowUpRight, tone: "text-sky-300" },
          { label: "Orders", value: String(metrics.totalOrders), sub: "Non-canceled orders", icon: ShoppingCart, tone: "text-zinc-100" },
          { label: "Approved Top-ups", value: formatCurrency(metrics.approvedTopupVolume), sub: "Manual deposit volume", icon: Wallet, tone: "text-amber-300" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <div className="text-2xl font-semibold text-white">{card.value}</div>
            <p className="mt-2 text-sm text-zinc-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue Last 7 Days</h2>
              <p className="text-sm text-zinc-500">Quick pulse on recent order income.</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Average order value</div>
              <div className="mt-1 text-lg font-semibold text-white">{formatCurrency(metrics.averageOrderValue)}</div>
            </div>
          </div>
          <div className="grid h-64 grid-cols-7 items-end gap-3">
            {revenueSeries.map((point) => (
              <div key={point.key} className="flex h-full flex-col justify-end gap-2">
                <div className="text-center text-xs text-zinc-500">{formatCurrency(point.amount)}</div>
                <div className="relative flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <div
                    className="absolute inset-x-2 bottom-2 rounded-xl bg-gradient-to-t from-violet-500 to-violet-300"
                    style={{ height: point.height }}
                  />
                </div>
                <div className="text-center text-xs text-zinc-500">{point.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-5">
          <h2 className="text-lg font-semibold text-white">Top Products</h2>
          <p className="mb-4 text-sm text-zinc-500">Highest earning products from recent orders.</p>
          <div className="space-y-3">
            {topProducts.length ? topProducts.map((item, index) => (
              <div key={item.slug} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">#{index + 1}</div>
                    <div className="mt-1 font-medium text-white">{item.name}</div>
                    <div className="text-xs text-zinc-500">/{item.slug} · {item.sales} sales</div>
                  </div>
                  <div className="text-right font-semibold text-emerald-300">{formatCurrency(item.revenue)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-zinc-500">No product sales yet.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Top Customers</h2>
              <p className="text-sm text-zinc-500">Highest spenders across recent order history.</p>
            </div>
            <Link href="/admin/users" className="text-sm text-violet-300 hover:text-violet-200">Open users</Link>
          </div>
          <div className="space-y-3">
            {topCustomers.length ? topCustomers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">{customer.username}</div>
                  <div className="truncate text-xs text-zinc-500">{customer.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-300">{formatCurrency(customer.spent)}</div>
                  <div className="text-xs text-zinc-500">{customer.orders} orders</div>
                </div>
              </div>
            )) : <div className="text-sm text-zinc-500">No customer spend data yet.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
              <p className="text-sm text-zinc-500">Latest order flow with product and buyer context.</p>
            </div>
            <Link href="/admin/orders" className="text-sm text-violet-300 hover:text-violet-200">Open orders</Link>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 6).map((order) => (
              <div key={order.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-white">#{order.id.slice(-8)} · {order.customer?.username || "Guest"}</div>
                    <div className="truncate text-xs text-zinc-500">
                      {order.items.map((item) => item.productName).join(", ") || "No items"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-300">{formatCurrency(Number(order.totalAmount || 0))}</div>
                    <div className="text-xs text-zinc-500">{formatDate(order.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
            {!loading && orders.length === 0 ? <div className="text-sm text-zinc-500">No orders yet.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
