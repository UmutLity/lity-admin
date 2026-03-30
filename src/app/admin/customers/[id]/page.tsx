"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { ArrowLeft, CreditCard, KeyRound, ShoppingCart, Ticket } from "lucide-react";

type CustomerProfile = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: string;
  isActive: boolean;
  balance: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  orders: Array<{
    id: string;
    status: string;
    totalAmount: number;
    couponCode: string | null;
    customerNote: string | null;
    createdAt: string;
    items: Array<{ id: string; plan: string; amount: number; product: { name: string; slug: string } }>;
  }>;
  licenses: Array<{
    id: string;
    key: string;
    status: string;
    plan: string;
    note: string | null;
    expiresAt: string | null;
    createdAt: string;
    product: { name: string; slug: string };
  }>;
  balanceTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
    createdAt: string;
  }>;
  topUpRequests: Array<{
    id: string;
    amount: number;
    status: string;
    senderName: string;
    senderBankName: string;
    note: string | null;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    ticketNumber: number;
    subject: string;
    status: string;
    priority: string;
    updatedAt: string;
    createdAt: string;
  }>;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function date(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("tr-TR");
}

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers/${params.id}`, { credentials: "include" });
        const payload = await res.json();
        if (res.ok && payload?.success) {
          setData(payload.data);
        } else {
          setData(null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  return (
    <div className="space-y-4">
      <Topbar title="Customer Profile" description="Orders, licenses, tickets, and balance activity in one place" />

      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      {loading ? (
        <div className="grid gap-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      ) : !data ? (
        <div className="premium-card p-10 text-center text-zinc-500">Customer not found.</div>
      ) : (
        <>
          <section className="premium-card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-[#a996c4]/10 ring-1 ring-white/[0.06]">
                {data.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatar} alt={data.username} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#d8cee8]">
                    {(data.username || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-white">{data.username}</h2>
                <p className="text-sm text-zinc-500">{data.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {data.role} • {data.isActive ? "Active" : "Disabled"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Balance</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-400">{money(data.balance)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Spent</p>
                  <p className="mt-2 text-lg font-semibold text-white">{money(data.totalSpent)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Orders</p>
                  <p className="mt-2 text-lg font-semibold text-white">{data.orders.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Tickets</p>
                  <p className="mt-2 text-lg font-semibold text-white">{data.tickets.length}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Member Since</p>
                <p className="mt-2">{date(data.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Last Login</p>
                <p className="mt-2">{date(data.lastLoginAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Password Reset</p>
                <p className="mt-2">{data.mustChangePassword ? "Required" : "Not required"}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
              </div>
              <div className="space-y-3">
                {data.orders.length ? data.orders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">#{order.id.slice(-8)} • {money(order.totalAmount)}</p>
                        <p className="text-xs text-zinc-500">{date(order.createdAt)}</p>
                      </div>
                      <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/[0.05] bg-[#11131c] px-3 py-2 text-sm text-zinc-300">
                          {item.product.name} • {item.plan.split("_").join(" ")} • {money(item.amount)}
                        </div>
                      ))}
                    </div>
                    {order.customerNote ? <p className="mt-3 text-sm text-zinc-400">Note: {order.customerNote}</p> : null}
                    {order.couponCode ? <p className="mt-1 text-sm text-zinc-500">Coupon: {order.couponCode}</p> : null}
                  </div>
                )) : <div className="text-sm text-zinc-500">No recent orders.</div>}
              </div>
            </section>

            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Licenses</h3>
              </div>
              <div className="space-y-3">
                {data.licenses.length ? data.licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{license.product.name}</p>
                        <p className="text-xs text-zinc-500">{license.plan.split("_").join(" ")} • {date(license.createdAt)}</p>
                      </div>
                      <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                        {license.status}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-xs text-zinc-400">{license.key}</p>
                    {license.note ? <p className="mt-2 text-sm text-zinc-400">{license.note}</p> : null}
                  </div>
                )) : <div className="text-sm text-zinc-500">No licenses found.</div>}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Balance Activity</h3>
              </div>
              <div className="space-y-3">
                {data.balanceTransactions.length ? data.balanceTransactions.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{row.reason}</p>
                        <p className="text-xs text-zinc-500">{date(row.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-semibold ${row.type === "CREDIT" ? "text-emerald-400" : "text-rose-300"}`}>
                        {row.type === "CREDIT" ? "+" : "-"}{money(row.amount)}
                      </span>
                    </div>
                  </div>
                )) : <div className="text-sm text-zinc-500">No wallet activity.</div>}
              </div>
            </section>

            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Tickets & Top-ups</h3>
              </div>
              <div className="space-y-3">
                {data.tickets.map((ticketRow) => (
                  <div key={ticketRow.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-sm font-semibold text-white">Ticket #{ticketRow.ticketNumber}</p>
                    <p className="text-sm text-zinc-400">{ticketRow.subject}</p>
                    <p className="mt-1 text-xs text-zinc-500">{ticketRow.status} • {date(ticketRow.updatedAt)}</p>
                  </div>
                ))}
                {data.topUpRequests.map((topup) => (
                  <div key={topup.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-sm font-semibold text-white">Top-up {money(topup.amount)}</p>
                    <p className="text-sm text-zinc-400">{topup.senderBankName} • {topup.senderName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{topup.status} • {date(topup.createdAt)}</p>
                  </div>
                ))}
                {!data.tickets.length && !data.topUpRequests.length ? <div className="text-sm text-zinc-500">No recent support or top-up activity.</div> : null}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
