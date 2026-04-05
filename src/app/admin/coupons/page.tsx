"use client";

import { useEffect, useState } from "react";
import { TicketPercent, Trash2 } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
};

const INITIAL_FORM = {
  code: "",
  description: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  usageLimit: "",
  expiresAt: "",
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((coupon) => coupon.isActive).length;
  const totalUsage = coupons.reduce((sum, coupon) => sum + Number(coupon.usedCount || 0), 0);
  const topCoupon = [...coupons].sort((a, b) => Number(b.usedCount || 0) - Number(a.usedCount || 0))[0] || null;

  async function loadCoupons() {
    const res = await fetch("/api/admin/coupons", { credentials: "include" });
    const data = await res.json();
    setCoupons(data?.success ? data.data : []);
  }

  async function createCoupon() {
    await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    setForm(INITIAL_FORM);
    await loadCoupons();
  }

  async function toggleCoupon(coupon: Coupon) {
    await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    await loadCoupons();
  }

  async function deleteCoupon(id: string) {
    await fetch(`/api/admin/coupons/${id}`, { method: "DELETE", credentials: "include" });
    await loadCoupons();
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  return (
    <div className="space-y-4">
      <Topbar title="Coupons" description="Create and manage discount codes" />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Total Coupons</p>
          <p className="mt-2 text-2xl font-semibold text-white">{totalCoupons}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{activeCoupons}</p>
        </div>
        <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Total Usage</p>
          <p className="mt-2 text-2xl font-semibold text-violet-200">{totalUsage}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Top Performer</p>
          <p className="mt-2 truncate text-lg font-semibold text-white">{topCoupon?.code || "No usage yet"}</p>
          <p className="mt-1 text-xs text-zinc-500">{topCoupon ? `${topCoupon.usedCount} uses` : "Create and publish a coupon to start tracking."}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
        <div className="premium-card p-4">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <TicketPercent className="h-4 w-4 text-[#c7bdd8]" /> New Coupon
          </p>
          <div className="space-y-3">
            <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed</option>
              </select>
              <input className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" placeholder="Min order" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
              <input className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" placeholder="Usage limit" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </div>
            <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            <button className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white" onClick={createCoupon}>
              Create Coupon
            </button>
          </div>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">{coupon.code}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {coupon.type === "PERCENT" ? `%${coupon.value}` : `$${coupon.value}`} - Used {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                    {coupon.minOrderAmount ? ` - Min $${coupon.minOrderAmount}` : ""}
                  </p>
                  {coupon.description ? <p className="mt-2 text-sm text-zinc-300">{coupon.description}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {coupon.usageLimit
                      ? `Conversion ${Math.round((Number(coupon.usedCount || 0) / Math.max(1, Number(coupon.usageLimit))) * 100)}% of limit`
                      : "No usage limit set"}
                    {coupon.expiresAt ? ` - Expires ${new Date(coupon.expiresAt).toLocaleDateString("tr-TR")}` : " - No expiry"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-200" onClick={() => toggleCoupon(coupon)}>
                    {coupon.isActive ? "Disable" : "Enable"}
                  </button>
                  <button className="rounded-xl border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" onClick={() => deleteCoupon(coupon.id)}>
                    <Trash2 className="mr-2 inline h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
            {!coupons.length ? <div className="p-10 text-center text-sm text-zinc-500">No coupons created yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
