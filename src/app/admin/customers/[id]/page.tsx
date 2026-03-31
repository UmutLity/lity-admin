"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/admin/topbar";
import { ArrowLeft, CreditCard, KeyRound, NotebookPen, ShoppingCart, Ticket, Truck } from "lucide-react";

type CustomerProfile = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: string;
  isActive: boolean;
  balance: number;
  totalSpent: number;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  orders: Array<{
    id: string;
    status: string;
    totalAmount: number;
    discountAmount: number;
    couponCode: string | null;
    customerNote: string | null;
    deliveryContent: string | null;
    timeline: any;
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
    proofImageUrl?: string | null;
    reviewNote?: string | null;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    ticketNumber: number;
    subject: string;
    status: string;
    priority: string;
    adminNotes?: string | null;
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

function statusTone(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DELIVERED" || normalized === "APPROVED" || normalized === "ACTIVE" || normalized === "RESOLVED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (normalized === "REJECTED" || normalized === "REVOKED" || normalized === "CLOSED" || normalized === "CANCELED") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [noteMessage, setNoteMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${params.id}`, { credentials: "include" });
      const payload = await res.json();
      if (res.ok && payload?.success) {
        setData(payload.data);
        setNotesDraft(payload.data.adminNotes || "");
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const mergedTimeline = useMemo(() => {
    if (!data) return [];

    const orderEvents = data.orders.map((order) => ({
      id: `order-${order.id}`,
      title: `${order.status === "DELIVERED" ? "Delivered order" : "Order created"} · ${money(order.totalAmount)}`,
      meta: order.items.map((item) => `${item.product.name} (${item.plan.split("_").join(" ")})`).join(", "),
      createdAt: order.createdAt,
      tone: order.status === "DELIVERED" ? "emerald" : "violet",
    }));

    const topupEvents = data.topUpRequests.map((row) => ({
      id: `topup-${row.id}`,
      title: `Top-up ${row.status.toLowerCase()} · ${money(row.amount)}`,
      meta: `${row.senderBankName} / ${row.senderName}`,
      createdAt: row.createdAt,
      tone: row.status === "APPROVED" ? "emerald" : row.status === "REJECTED" ? "red" : "amber",
    }));

    const ticketEvents = data.tickets.map((row) => ({
      id: `ticket-${row.id}`,
      title: `Ticket #${row.ticketNumber} · ${row.status}`,
      meta: row.subject,
      createdAt: row.updatedAt || row.createdAt,
      tone: row.status === "RESOLVED" ? "emerald" : "violet",
    }));

    return [...orderEvents, ...topupEvents, ...ticketEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [data]);

  async function saveAdminNotes() {
    if (!data) return;
    setSavingNotes(true);
    setNoteMessage("");
    try {
      const res = await fetch(`/api/admin/customers/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminNotes: notesDraft }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Could not save notes");
      setData((prev) => (prev ? { ...prev, adminNotes: notesDraft.trim() || null } : prev));
      setNoteMessage("Internal notes saved.");
    } catch (error: any) {
      setNoteMessage(error.message || "Could not save notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-4">
      <Topbar title="Customer 360" description="Orders, wallet, support, delivery state, and internal notes in one place." />

      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      {loading ? (
        <div className="grid gap-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-96 rounded-2xl" />
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
                  {data.role} · {data.isActive ? "Active" : "Disabled"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Licenses</p>
                  <p className="mt-2 text-lg font-semibold text-white">{data.licenses.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Tickets</p>
                  <p className="mt-2 text-lg font-semibold text-white">{data.tickets.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Member Since</p>
                <p className="mt-2">{date(data.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Last Login</p>
                <p className="mt-2">{date(data.lastLoginAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Pending Deliveries</p>
                <p className="mt-2">{data.orders.filter((order) => ["PENDING", "PAID", "PROCESSING"].includes(order.status)).length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-zinc-300">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Password Reset</p>
                <p className="mt-2">{data.mustChangePassword ? "Required" : "Not required"}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Internal Notes</h3>
              </div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                className="min-h-[170px] w-full rounded-2xl border border-white/[0.08] bg-[#11131c] px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-violet-500/40"
                placeholder="Private admin notes about this customer..."
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">{noteMessage || "Only staff can see these notes."}</p>
                <button
                  type="button"
                  onClick={saveAdminNotes}
                  disabled={savingNotes}
                  className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 disabled:opacity-50"
                >
                  {savingNotes ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </section>

            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Recent Timeline</h3>
              </div>
              <div className="space-y-3">
                {mergedTimeline.length ? mergedTimeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-zinc-400">{item.meta}</p>
                      </div>
                      <span className="text-xs text-zinc-500">{date(item.createdAt)}</span>
                    </div>
                  </div>
                )) : <div className="text-sm text-zinc-500">No recent activity.</div>}
              </div>
            </section>
          </div>

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
                        <p className="text-sm font-semibold text-white">#{order.id.slice(-8)} · {money(order.totalAmount)}</p>
                        <p className="text-xs text-zinc-500">{date(order.createdAt)}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/[0.05] bg-[#11131c] px-3 py-2 text-sm text-zinc-300">
                          {item.product.name} · {item.plan.split("_").join(" ")} · {money(item.amount)}
                        </div>
                      ))}
                    </div>
                    {order.customerNote ? <p className="mt-3 text-sm text-zinc-400">Customer note: {order.customerNote}</p> : null}
                    {order.deliveryContent ? <p className="mt-2 text-sm text-emerald-300">Delivery content saved.</p> : null}
                    {order.couponCode ? <p className="mt-1 text-sm text-zinc-500">Coupon: {order.couponCode} (-{money(order.discountAmount)})</p> : null}
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
                        <p className="text-xs text-zinc-500">{license.plan.split("_").join(" ")} · {date(license.createdAt)}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(license.status)}`}>
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
                <h3 className="text-lg font-semibold text-white">Balance & Top-ups</h3>
              </div>
              <div className="space-y-3">
                {data.balanceTransactions.map((row) => (
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
                ))}
                {data.topUpRequests.map((topup) => (
                  <div key={topup.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Top-up {money(topup.amount)}</p>
                        <p className="text-sm text-zinc-400">{topup.senderBankName} · {topup.senderName}</p>
                        {topup.note ? <p className="mt-2 text-sm text-zinc-500">Customer note: {topup.note}</p> : null}
                        {topup.reviewNote ? <p className="mt-1 text-sm text-violet-300">Admin note: {topup.reviewNote}</p> : null}
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(topup.status)}`}>
                          {topup.status}
                        </span>
                        {topup.proofImageUrl ? (
                          <a href={topup.proofImageUrl} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-violet-300 hover:text-violet-200">
                            View proof
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {!data.balanceTransactions.length && !data.topUpRequests.length ? <div className="text-sm text-zinc-500">No wallet activity.</div> : null}
              </div>
            </section>

            <section className="premium-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#c7bdd8]" />
                <h3 className="text-lg font-semibold text-white">Support Tickets</h3>
              </div>
              <div className="space-y-3">
                {data.tickets.length ? data.tickets.map((ticketRow) => (
                  <div key={ticketRow.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Ticket #{ticketRow.ticketNumber}</p>
                        <p className="text-sm text-zinc-400">{ticketRow.subject}</p>
                        {ticketRow.adminNotes ? <p className="mt-2 text-sm text-violet-300">Admin: {ticketRow.adminNotes}</p> : null}
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(ticketRow.status)}`}>
                          {ticketRow.status}
                        </span>
                        <p className="mt-2 text-xs text-zinc-500">{date(ticketRow.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-sm text-zinc-500">No recent support activity.</div>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
