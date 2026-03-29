"use client";

import { useEffect, useState } from "react";
import { Copy, MessageSquareShare, Send, Truck } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";

type DeliveryRow = {
  id: string;
  createdAt: string;
  totalAmount: number;
  customerNote: string | null;
  couponCode: string | null;
  discountAmount: number;
  pendingCount: number;
  customer: { username: string; email: string } | null;
  items: Array<{ id: string; productName: string; productSlug: string; plan: string; amount: number }>;
};

function formatPlan(plan: string) {
  return String(plan || "").split("_").join(" ");
}

export default function PendingDeliveriesPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-deliveries", { credentials: "include" });
      const data = await res.json();
      setRows(data?.success ? data.data : []);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(orderId: string, action: "MARK_DELIVERED" | "SEND_DISCORD") {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    await loadRows();
  }

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <div className="space-y-4">
      <Topbar title="Pending Deliveries" description="Manual delivery queue for paid orders" />
      <div className="premium-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="p-10 text-center text-sm text-zinc-500">No pending manual deliveries.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {rows.map((row) => (
              <div key={row.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {row.customer?.username || "Unknown customer"} <span className="text-zinc-500">#{row.id.slice(-8)}</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{row.customer?.email || "-"}</p>
                    <p className="mt-2 text-xs text-zinc-400">
                      {new Date(row.createdAt).toLocaleString("tr-TR")} - {row.pendingCount} pending key
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200"
                      onClick={() => navigator.clipboard.writeText(row.customer?.email || row.customer?.username || "")}
                    >
                      <Copy className="mr-2 inline h-4 w-4" /> Copy User
                    </button>
                    <button
                      className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200"
                      onClick={() => runAction(row.id, "SEND_DISCORD")}
                    >
                      <Send className="mr-2 inline h-4 w-4" /> Send Discord
                    </button>
                    <button
                      className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
                      onClick={() => runAction(row.id, "MARK_DELIVERED")}
                    >
                      <Truck className="mr-2 inline h-4 w-4" /> Mark Delivered
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Order Items</p>
                    <div className="mt-3 space-y-2">
                      {row.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/[0.05] bg-[#11131c] px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">{item.productName}</p>
                              <p className="text-xs text-zinc-500">{formatPlan(item.plan)}</p>
                            </div>
                            <span className="text-sm font-semibold text-emerald-400">${Number(item.amount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Delivery Notes</p>
                    <div className="mt-3 space-y-3 text-sm text-zinc-300">
                      <p>
                        Total: <span className="font-semibold text-white">${Number(row.totalAmount || 0).toFixed(2)}</span>
                      </p>
                      {row.couponCode ? (
                        <p>
                          Coupon: <span className="font-semibold text-white">{row.couponCode}</span> (-$
                          {Number(row.discountAmount || 0).toFixed(2)})
                        </p>
                      ) : null}
                      <div className="rounded-xl border border-white/[0.05] bg-[#11131c] p-3">
                        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                          <MessageSquareShare className="h-3.5 w-3.5" /> Customer Note
                        </p>
                        <p className="text-sm text-zinc-300">{row.customerNote || "No note left by customer."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
