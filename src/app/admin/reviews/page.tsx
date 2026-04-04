"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Check, CheckCircle2, Clock3, MessageSquare, Search, Star, X } from "lucide-react";

type ReviewRow = {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  productId: string | null;
  productName: string | null;
  content: string;
  rating: number | null;
  isVerifiedPurchase: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt?: string;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
};

type ReviewTab = "PENDING" | "APPROVED" | "ALL";

function getModerationStatus(row: ReviewRow): "PENDING" | "APPROVED" | "REJECTED" {
  if (row.moderationStatus === "APPROVED" || row.moderationStatus === "REJECTED" || row.moderationStatus === "PENDING") {
    return row.moderationStatus;
  }
  return row.isVisible ? "APPROVED" : "PENDING";
}

function renderStars(rating: number | null) {
  const value = Math.max(0, Math.min(5, Number(rating || 0)));
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      className={`h-4 w-4 ${index < value ? "fill-amber-400 text-amber-400" : "text-zinc-700"}`}
    />
  ));
}

export default function AdminReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [tab, setTab] = useState<ReviewTab>("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("ALL");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load reviews");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = rows.filter((row) => {
    const status = getModerationStatus(row);
    if (tab !== "ALL" && status !== tab) return false;
    if (productFilter !== "ALL" && (row.productName || "General Review") !== productFilter) return false;
    if (!search.trim()) return true;
    const haystack = `${row.authorName || ""} ${row.productName || ""} ${row.content || ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pendingCount = rows.filter((row) => getModerationStatus(row) === "PENDING").length;
  const approvedCount = rows.filter((row) => getModerationStatus(row) === "APPROVED").length;
  const rejectedCount = rows.filter((row) => getModerationStatus(row) === "REJECTED").length;
  const productOptions = Array.from(
    new Set(rows.map((row) => row.productName || "General Review"))
  ).sort((a, b) => a.localeCompare(b));

  async function moderateReview(row: ReviewRow, nextStatus: "APPROVED" | "REJECTED", reason?: string) {
    setBusyId(row.id);
    setError("");
    setSuccess("");
    try {
      const body =
        nextStatus === "APPROVED"
          ? { isVisible: true, moderationStatus: "APPROVED", rejectionReason: null }
          : { isVisible: false, moderationStatus: "REJECTED", rejectionReason: reason?.trim() || "Rejected by admin" };

      const res = await fetch(`/api/admin/reviews/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Review update failed");

      setRemovingIds((prev) => [...prev, row.id]);
      window.setTimeout(() => {
        setRows((prev) => prev.map((item) => (item.id === row.id ? data.data : item)));
        setRemovingIds((prev) => prev.filter((id) => id !== row.id));
      }, 220);

      setRejectingId(null);
      setRejectReason("");
      setSuccess(nextStatus === "APPROVED" ? "Review approved." : "Review rejected.");
    } catch (err: any) {
      setError(err.message || "Review update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar title="Reviews" description="Moderate incoming customer reviews and publish approved feedback." />

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#111114] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pending</div>
            <div className="mt-2 text-2xl font-semibold text-white">{pendingCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111114] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Approved</div>
            <div className="mt-2 text-2xl font-semibold text-white">{approvedCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111114] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">All Reviews</div>
            <div className="mt-2 text-2xl font-semibold text-white">{rows.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111114] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Rejected</div>
            <div className="mt-2 text-2xl font-semibold text-white">{rejectedCount}</div>
          </div>
        </div>

        <div className="grid min-w-[320px] gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className="w-full rounded-xl border border-white/10 bg-[#111114] py-2.5 pl-10 pr-3 text-sm text-white outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111114] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="ALL">All products</option>
            {productOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "ALL"] as ReviewTab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === item
                ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                : "border-white/10 bg-[#111114] text-zinc-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {item === "ALL" ? "All" : item === "PENDING" ? "Pending" : "Approved"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div>
      ) : null}

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#111114] p-5 text-sm text-zinc-400">Loading reviews...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111114] p-8 text-center text-sm text-zinc-500">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            No reviews in this tab right now.
          </div>
        ) : (
          filteredRows.map((row) => {
            const status = getModerationStatus(row);
            const isRemoving = removingIds.includes(row.id);
            const isBusy = busyId === row.id;

            return (
              <article
                key={row.id}
                className={`rounded-2xl border border-white/10 bg-[#111114] p-4 transition duration-200 ${
                  isRemoving ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-violet-500/10">
                        {row.authorAvatarUrl ? (
                          <img src={row.authorAvatarUrl} alt={row.authorName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-violet-200">
                            {(row.authorName || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{row.authorName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{row.productName || "General Review"}</span>
                          {row.isVerifiedPurchase ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">{renderStars(row.rating)}</div>
                    <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-200">{row.content}</p>
                    <div className="text-xs text-zinc-500">
                      Submitted {new Date(row.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </div>

                    {status === "REJECTED" && row.rejectionReason ? (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        Rejection reason: {row.rejectionReason}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-[250px] flex-col items-stretch gap-3">
                    <div
                      className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        status === "APPROVED"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : status === "REJECTED"
                            ? "border-red-500/25 bg-red-500/10 text-red-300"
                            : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {status === "APPROVED" ? <Check className="h-3.5 w-3.5" /> : status === "REJECTED" ? <X className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Pending"}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => moderateReview(row, "APPROVED")}
                        className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingId((prev) => (prev === row.id ? null : row.id));
                          setRejectReason("");
                        }}
                        className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>

                    {rejectingId === row.id ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Why is this review being rejected?"
                          className="min-h-[92px] w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => moderateReview(row, "REJECTED", rejectReason)}
                            className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-50"
                          >
                            Confirm Reject
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
