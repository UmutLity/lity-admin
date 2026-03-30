"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, MessageSquareShare, Send, Truck, UserRound } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type DeliveryRow = {
  id: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  customerNote: string | null;
  couponCode: string | null;
  discountAmount: number;
  pendingCount: number;
  deliveryContent?: string | null;
  customer: { id: string; username: string; email: string } | null;
  items: Array<{ id: string; productName: string; productSlug: string; plan: string; amount: number }>;
};

function formatPlan(plan: string) {
  return String(plan || "").split("_").join(" ");
}

function deliveryState(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DELIVERED") return { label: "Delivered", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" };
  if (normalized === "PROCESSING") return { label: "Processing", className: "bg-amber-500/10 text-amber-300 border-amber-500/20" };
  return { label: "Pending", className: "bg-sky-500/10 text-sky-300 border-sky-500/20" };
}

export default function PendingDeliveriesPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "DELIVERED">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DeliveryRow | null>(null);
  const [deliveryContent, setDeliveryContent] = useState("");

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

  async function sendReminder(orderId: string) {
    try {
      setBusyId(orderId);
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "SEND_DISCORD" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not send reminder");
      addToast({ type: "success", title: "Reminder sent", description: "Order reminder was sent to Discord." });
      await loadRows();
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Action failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function deliverSelected() {
    if (!selectedRow) return;
    const content = deliveryContent.trim();
    if (content.length < 3) {
      addToast({ type: "error", title: "Delivery content required", description: "Enter the key, link, or note for the customer." });
      return;
    }

    try {
      setBusyId(selectedRow.id);
      const res = await fetch(`/api/admin/orders/${selectedRow.id}/deliver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryContent: content }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Delivery failed");
      addToast({ type: "success", title: "Delivered", description: "Order marked as delivered and customer notified." });
      setSelectedRow(null);
      setDeliveryContent("");
      await loadRows();
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Delivery failed" });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === "ALL") return rows;
    if (filter === "DELIVERED") return rows.filter((row) => String(row.status).toUpperCase() === "DELIVERED");
    return rows.filter((row) => String(row.status).toUpperCase() !== "DELIVERED");
  }, [filter, rows]);

  return (
    <div className="space-y-4">
      <Topbar title="Pending Deliveries" description="Manual delivery queue for paid orders" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "PENDING" ? "default" : "outline"} onClick={() => setFilter("PENDING")}>Pending</Button>
        <Button size="sm" variant={filter === "DELIVERED" ? "default" : "outline"} onClick={() => setFilter("DELIVERED")}>Delivered</Button>
        <Button size="sm" variant={filter === "ALL" ? "default" : "outline"} onClick={() => setFilter("ALL")}>All</Button>
      </div>

      <div className="premium-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        ) : !filteredRows.length ? (
          <div className="p-10 text-center text-sm text-zinc-500">No orders in this delivery filter.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredRows.map((row) => {
              const state = deliveryState(row.status);
              return (
                <div key={row.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {row.customer?.username || "Unknown customer"} <span className="text-zinc-500">#{row.id.slice(-8)}</span>
                        </p>
                        <Badge variant="outline" className={state.className}>{state.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{row.customer?.email || "-"}</p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {new Date(row.createdAt).toLocaleString("tr-TR")} · ${Number(row.totalAmount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.customer?.id ? (
                        <button
                          className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200"
                          onClick={() => window.location.assign(`/admin/customers/${row.customer?.id}`)}
                        >
                          <UserRound className="mr-2 inline h-4 w-4" /> Profile
                        </button>
                      ) : null}
                      <button
                        className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200"
                        onClick={() => navigator.clipboard.writeText(row.customer?.email || row.customer?.username || "")}
                      >
                        <Copy className="mr-2 inline h-4 w-4" /> Copy User
                      </button>
                      <button
                        className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200"
                        onClick={() => sendReminder(row.id)}
                        disabled={busyId === row.id}
                      >
                        <Send className="mr-2 inline h-4 w-4" /> Send Discord
                      </button>
                      <button
                        className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 disabled:opacity-50"
                        onClick={() => {
                          setSelectedRow(row);
                          setDeliveryContent(row.deliveryContent || "");
                        }}
                        disabled={busyId === row.id}
                      >
                        <Truck className="mr-2 inline h-4 w-4" /> {String(row.status).toUpperCase() === "DELIVERED" ? "Edit Delivery" : "Deliver"}
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
                        {row.deliveryContent ? (
                          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-emerald-300">Current Delivery Content</p>
                            <p className="whitespace-pre-wrap text-sm text-zinc-200">{row.deliveryContent}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) { setSelectedRow(null); setDeliveryContent(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{String(selectedRow?.status).toUpperCase() === "DELIVERED" ? "Edit Delivery" : "Deliver Order"}</DialogTitle>
            <DialogDescription>
              Add the key, download link, or private note that should appear in the customer's delivery modal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-zinc-400">
              {selectedRow?.customer?.username || "Customer"} · {selectedRow?.items.map((item) => item.productName).join(", ")}
            </div>
            <Textarea
              rows={8}
              value={deliveryContent}
              onChange={(e) => setDeliveryContent(e.target.value)}
              placeholder="Paste the key, account details, download URL, or manual delivery note here..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRow(null); setDeliveryContent(""); }}>Cancel</Button>
            <Button onClick={deliverSelected} disabled={!selectedRow || busyId === selectedRow.id}>Save Delivery</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
