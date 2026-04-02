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
  deliveredAt?: string | null;
  totalAmount: number;
  customerNote: string | null;
  couponCode: string | null;
  discountAmount: number;
  pendingCount: number;
  deliveryContent?: string | null;
  deliveredBy?: { id: string; name: string } | null;
  customer: { id: string; username: string; email: string } | null;
  items: Array<{ id: string; productName: string; productSlug: string; plan: string; amount: number }>;
};

type DeliveryTemplateType = "KEY" | "LOADER" | "ACCOUNT" | "CUSTOM" | "MIXED";

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
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PROCESSING" | "DELIVERED">("PENDING");
  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DeliveryRow | null>(null);
  const [deliveryContent, setDeliveryContent] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryTemplateType>("CUSTOM");
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [templateName, setTemplateName] = useState("");
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const templatesRaw = localStorage.getItem("lity_saved_delivery_templates");
      const notesRaw = localStorage.getItem("lity_order_internal_notes");
      const parsedTemplates = templatesRaw ? JSON.parse(templatesRaw) : [];
      const parsedNotes = notesRaw ? JSON.parse(notesRaw) : {};
      setSavedTemplates(Array.isArray(parsedTemplates) ? parsedTemplates : []);
      setInternalNotes(parsedNotes && typeof parsedNotes === "object" ? parsedNotes : {});
    } catch {
      setSavedTemplates([]);
      setInternalNotes({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lity_saved_delivery_templates", JSON.stringify(savedTemplates));
    } catch {}
  }, [savedTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem("lity_order_internal_notes", JSON.stringify(internalNotes));
    } catch {}
  }, [internalNotes]);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-deliveries", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Could not load pending deliveries");
      }
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      setRows([]);
      addToast({ type: "error", title: "Error", description: error.message || "Could not load pending deliveries" });
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

  async function markProcessing(orderId: string) {
    try {
      setBusyId(orderId);
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "MARK_PROCESSING" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not move order to processing");
      addToast({ type: "success", title: "Processing", description: "Order moved to processing and customer notified." });
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
      setDeliveryType("CUSTOM");
      await loadRows();
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Delivery failed" });
    } finally {
      setBusyId(null);
    }
  }

  function applyTemplate(type: DeliveryTemplateType) {
    setDeliveryType(type);
    const productNames = selectedRow?.items.map((item) => item.productName).join(", ") || "Product";
    const customerName = selectedRow?.customer?.username || "customer";
    const templates: Record<DeliveryTemplateType, string> = {
      KEY: `Delivery Type: License Key\nCustomer: ${customerName}\nProduct: ${productNames}\n\nLicense Key:\n-\n\nInstructions:\n- Open your loader / launcher\n- Paste the key exactly as sent\n- Contact support if activation fails`,
      LOADER: `Delivery Type: Loader Access\nCustomer: ${customerName}\nProduct: ${productNames}\n\nLoader URL:\n-\n\nLogin / Key:\n-\n\nInstructions:\n- Download from the link above\n- Run as administrator if required\n- Use the login/key shown above`,
      ACCOUNT: `Delivery Type: Account Delivery\nCustomer: ${customerName}\nProduct: ${productNames}\n\nUsername / Email:\n-\nPassword:\n-\nRegion / Platform:\n-\n\nNotes:\n- Change credentials if your workflow requires it\n- Keep this information private`,
      CUSTOM: `Delivery Type: Custom Note\nCustomer: ${customerName}\nProduct: ${productNames}\n\nDelivery Details:\n-\n\nNotes:\n-`,
      MIXED: `Delivery Type: Mixed Delivery\nCustomer: ${customerName}\nProduct: ${productNames}\n\nLoader URL:\n-\nLicense Key:\n-\nAccount / Extra Access:\n-\n\nInstructions:\n-`,
    };
    setDeliveryContent(templates[type]);
  }

  function saveCurrentTemplate() {
    const name = templateName.trim();
    const content = deliveryContent.trim();
    if (!name || content.length < 3) {
      addToast({ type: "error", title: "Template missing", description: "Add a template name and some delivery content first." });
      return;
    }
    const next = [
      { id: `${Date.now()}`, name, content },
      ...savedTemplates.filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
    ].slice(0, 12);
    setSavedTemplates(next);
    setTemplateName("");
    addToast({ type: "success", title: "Template saved", description: `${name} is ready for quick reuse.` });
  }

  function removeSavedTemplate(id: string) {
    setSavedTemplates((current) => current.filter((item) => item.id !== id));
  }

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    let next = rows;
    if (filter !== "ALL") {
      next = next.filter((row) => String(row.status).toUpperCase() === filter);
    }
    if (gameFilter !== "ALL") {
      next = next.filter((row) => row.items.some((item) => item.productName.toLowerCase().includes(gameFilter.toLowerCase())));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      next = next.filter((row) =>
        row.customer?.username?.toLowerCase().includes(q) ||
        row.customer?.email?.toLowerCase().includes(q) ||
        row.items.some((item) => item.productName.toLowerCase().includes(q))
      );
    }
    return next;
  }, [filter, gameFilter, query, rows]);

  const gameOptions = useMemo(() => {
    const names = Array.from(new Set(rows.flatMap((row) => row.items.map((item) => item.productName))));
    return names.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-4">
      <Topbar title="Pending Deliveries" description="Manual delivery queue for paid orders" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "PENDING" ? "default" : "outline"} onClick={() => setFilter("PENDING")}>Pending</Button>
        <Button size="sm" variant={filter === "PROCESSING" ? "default" : "outline"} onClick={() => setFilter("PROCESSING")}>Processing</Button>
        <Button size="sm" variant={filter === "DELIVERED" ? "default" : "outline"} onClick={() => setFilter("DELIVERED")}>Delivered</Button>
        <Button size="sm" variant={filter === "ALL" ? "default" : "outline"} onClick={() => setFilter("ALL")}>All</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer or product"
          className="h-10 min-w-[240px] rounded-xl border border-white/[0.08] bg-[#10131c] px-3 text-sm text-zinc-100 outline-none"
        />
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="h-10 rounded-xl border border-white/[0.08] bg-[#10131c] px-3 text-sm text-zinc-100 outline-none"
        >
          <option value="ALL">All Products</option>
          {gameOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
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
                        className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 disabled:opacity-50"
                        onClick={() => markProcessing(row.id)}
                        disabled={busyId === row.id || String(row.status).toUpperCase() === "DELIVERED"}
                      >
                        <Truck className="mr-2 inline h-4 w-4" /> Processing
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
                          setDeliveryType("CUSTOM");
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
                        <div className="rounded-xl border border-violet-500/10 bg-violet-500/5 p-3">
                          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-violet-300">Internal Note</p>
                          <textarea
                            value={internalNotes[row.id] || ""}
                            onChange={(e) => setInternalNotes((current) => ({ ...current, [row.id]: e.target.value }))}
                            placeholder="Internal staff note for this order..."
                            className="min-h-[84px] w-full rounded-xl border border-white/[0.08] bg-[#0f1119] px-3 py-2 text-sm text-zinc-100 outline-none"
                          />
                          <p className="mt-2 text-xs text-zinc-500">Saved locally for quick manual delivery workflow.</p>
                        </div>
                        {row.deliveryContent ? (
                          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-emerald-300">Current Delivery Content</p>
                            <p className="whitespace-pre-wrap text-sm text-zinc-200">{row.deliveryContent}</p>
                            {(row.deliveredAt || row.deliveredBy?.name) ? (
                              <p className="mt-2 text-xs text-zinc-400">
                                {row.deliveredAt ? `Delivered ${new Date(row.deliveredAt).toLocaleString("tr-TR")}` : "Delivered"}
                                {row.deliveredBy?.name ? ` by ${row.deliveredBy.name}` : ""}
                              </p>
                            ) : null}
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

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) { setSelectedRow(null); setDeliveryContent(""); setDeliveryType("CUSTOM"); } }}>
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
            <div className="flex flex-wrap gap-2">
              {([
                ["KEY", "Key"],
                ["LOADER", "Loader"],
                ["ACCOUNT", "Account"],
                ["MIXED", "Mixed"],
                ["CUSTOM", "Custom"],
              ] as Array<[DeliveryTemplateType, string]>).map(([value, label]) => (
                <Button key={value} type="button" size="sm" variant={deliveryType === value ? "default" : "outline"} onClick={() => applyTemplate(value)}>
                  {label}
                </Button>
              ))}
            </div>
            {savedTemplates.length ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Saved Templates</div>
                <div className="flex flex-wrap gap-2">
                  {savedTemplates.map((template) => (
                    <div key={template.id} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1">
                      <button type="button" className="text-xs font-medium text-zinc-200" onClick={() => setDeliveryContent(template.content)}>
                        {template.name}
                      </button>
                      <button type="button" className="text-xs text-zinc-500 hover:text-red-300" onClick={() => removeSavedTemplate(template.id)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <Textarea
              rows={8}
              value={deliveryContent}
              onChange={(e) => setDeliveryContent(e.target.value)}
              placeholder="Paste the key, account details, download URL, or manual delivery note here..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="h-10 min-w-[180px] rounded-xl border border-white/[0.08] bg-[#10131c] px-3 text-sm text-zinc-100 outline-none"
              />
              <Button type="button" variant="outline" onClick={saveCurrentTemplate}>Save Template</Button>
            </div>
            {selectedRow ? (
              <div className="rounded-xl border border-violet-500/10 bg-violet-500/5 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-violet-300">Internal Note</div>
                <textarea
                  value={internalNotes[selectedRow.id] || ""}
                  onChange={(e) => setInternalNotes((current) => ({ ...current, [selectedRow.id]: e.target.value }))}
                  placeholder="Internal note for this order..."
                  className="min-h-[84px] w-full rounded-xl border border-white/[0.08] bg-[#0f1119] px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRow(null); setDeliveryContent(""); setDeliveryType("CUSTOM"); }}>Cancel</Button>
            <Button onClick={deliverSelected} disabled={!selectedRow || busyId === selectedRow.id}>Save Delivery</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
