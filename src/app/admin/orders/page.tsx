"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Send,
  Search,
  ShoppingCart,
  Ticket,
  Truck,
  UserRound,
} from "lucide-react";

type OrderItemRow = {
  id: string;
  productName: string;
  productSlug: string;
  plan: string;
  amount: number;
  licenseCount: number;
};

type OrderRow = {
  id: string;
  createdAt: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  subtotalAmount?: number | null;
  discountAmount?: number;
  couponCode?: string | null;
  customerNote?: string | null;
  timeline?: Array<{ type: string; title: string; description?: string; createdAt: string }>;
  customer: {
    id: string;
    username: string;
    email: string;
    avatar: string | null;
  } | null;
  items: OrderItemRow[];
};

type OrdersPayload = {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    licensesSold: number;
  };
  orders: OrderRow[];
};

const EMPTY_DATA: OrdersPayload = {
  summary: {
    totalOrders: 0,
    totalRevenue: 0,
    licensesSold: 0,
  },
  orders: [],
};

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPlan(plan: string) {
  return String(plan || "").split("_").join(" ");
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("tr-TR");
}

function statusClass(status: string) {
  const key = String(status || "").toUpperCase();
  if (key === "PAID") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
  if (key === "PENDING") return "border-amber-400/25 bg-amber-500/10 text-amber-300";
  if (key === "REFUNDED") return "border-sky-400/25 bg-sky-500/10 text-sky-300";
  if (key === "CANCELED") return "border-rose-400/25 bg-rose-500/10 text-rose-300";
  return "border-zinc-400/20 bg-zinc-500/10 text-zinc-300";
}

export default function OrdersPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrdersPayload>(EMPTY_DATA);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  async function orderAction(orderId: string, action: "MARK_DELIVERED" | "SEND_DISCORD") {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    await loadOrders();
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders().catch(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`/api/admin/orders?${params.toString()}`, { credentials: "include" });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        setData(EMPTY_DATA);
        return;
      }
      const next = (payload.data || EMPTY_DATA) as OrdersPayload;
      setData(next);
      setOpenRows((current) => {
        const valid = new Set(next.orders.map((order) => order.id));
        const cleaned: Record<string, boolean> = {};
        for (const [id, isOpen] of Object.entries(current)) {
          if (valid.has(id) && isOpen) cleaned[id] = true;
        }
        return cleaned;
      });
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(id: string) {
    setOpenRows((current) => ({ ...current, [id]: !current[id] }));
  }

  const cards = useMemo(
    () => [
      {
        title: "Total Orders",
        value: data.summary.totalOrders,
        icon: ShoppingCart,
        valueClass: "text-white",
        iconClass: "bg-violet-500/15 text-violet-300",
      },
      {
        title: "Total Revenue",
        value: formatMoney(data.summary.totalRevenue),
        icon: BadgeDollarSign,
        valueClass: "text-emerald-400",
        iconClass: "bg-emerald-500/15 text-emerald-300",
      },
      {
        title: "Licenses Sold",
        value: data.summary.licensesSold,
        icon: KeyRound,
        valueClass: "text-white",
        iconClass: "bg-blue-500/15 text-blue-300",
      },
    ],
    [data.summary]
  );

  return (
    <div className="space-y-4">
      <Topbar title="Order Management" description="Track and manage all orders" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.17em] text-zinc-500">{card.title}</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconClass}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-3xl font-semibold leading-none ${card.valueClass}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="premium-card p-4">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user, product, or order ID..."
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/35"
          />
        </div>
      </div>

      <div className="premium-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : data.orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">No orders found.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {data.orders.map((order) => {
              const firstItem = order.items[0];
              const isOpen = !!openRows[order.id];
              return (
                <div key={order.id} className="bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() => toggleRow(order.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#a996c4]/10 text-[#c7bdd8]">
                        {order.customer?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={order.customer.avatar} alt={order.customer.username} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <UserRound className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{order.customer?.username || "Guest Customer"}</p>
                        <p className="truncate text-xs text-zinc-500">{order.customer?.email || "-"}</p>
                      </div>
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-5">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{firstItem?.productName || "Order Item"}</p>
                        <p className="text-xs text-zinc-500">
                          {firstItem ? `${formatPlan(firstItem.plan)} - ${firstItem.licenseCount} key(s)` : "No items"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{formatMoney(order.totalAmount)}</p>
                        <p className="text-xs text-zinc-500">{formatDateTime(order.createdAt)}</p>
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass(order.status)}`}>
                        {order.status}
                      </span>

                      {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.06] bg-[#11131c]/70 px-4 py-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Order #{order.id.slice(-10)}</p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {order.customer?.id ? (
                          <button
                            type="button"
                            onClick={() => window.location.assign(`/admin/customers/${order.customer?.id}`)}
                            className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-200"
                          >
                            <UserRound className="mr-2 inline h-4 w-4" /> Customer Profile
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(order.customer?.email || order.customer?.username || order.id)}
                          className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-200"
                        >
                          <Copy className="mr-2 inline h-4 w-4" /> Copy User
                        </button>
                        <button
                          type="button"
                          onClick={() => orderAction(order.id, "SEND_DISCORD")}
                          className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-200"
                        >
                          <Send className="mr-2 inline h-4 w-4" /> Send Discord
                        </button>
                        <button
                          type="button"
                          onClick={() => window.location.assign("/admin/tickets")}
                          className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-200"
                        >
                          <Ticket className="mr-2 inline h-4 w-4" /> Open Tickets
                        </button>
                        <button
                          type="button"
                          onClick={() => orderAction(order.id, "MARK_DELIVERED")}
                          className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
                        >
                          <Truck className="mr-2 inline h-4 w-4" /> Mark Delivered
                        </button>
                      </div>

                      {(order.customerNote || order.couponCode || (order.timeline && order.timeline.length)) && (
                        <div className="mb-3 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-zinc-300">
                            <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-zinc-500">Customer Note</p>
                            <p>{order.customerNote || "No note left."}</p>
                          </div>
                          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-zinc-300">
                            <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-zinc-500">Discount</p>
                            <p>{order.couponCode ? `${order.couponCode} • -$${Number(order.discountAmount || 0).toFixed(2)}` : "No coupon used."}</p>
                          </div>
                          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-zinc-300">
                            <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-zinc-500">Timeline</p>
                            <p>{order.timeline?.length ? order.timeline[order.timeline.length - 1]?.title : "No timeline events yet."}</p>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                        <table className="w-full min-w-[720px]">
                          <thead className="bg-white/[0.02]">
                            <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">
                              <th className="px-3 py-2.5">Product</th>
                              <th className="px-3 py-2.5">Plan</th>
                              <th className="px-3 py-2.5">License Count</th>
                              <th className="px-3 py-2.5">Amount</th>
                              <th className="px-3 py-2.5">Method</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id} className="border-t border-white/[0.05] text-sm text-zinc-200">
                                <td className="px-3 py-2.5">
                                  <p className="font-medium text-white">{item.productName}</p>
                                  <p className="text-xs text-zinc-500">/{item.productSlug}</p>
                                </td>
                                <td className="px-3 py-2.5">{formatPlan(item.plan)}</td>
                                <td className="px-3 py-2.5">{item.licenseCount}</td>
                                <td className="px-3 py-2.5 font-semibold text-emerald-400">{formatMoney(item.amount)}</td>
                                <td className="px-3 py-2.5 text-zinc-400">{order.paymentMethod}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
