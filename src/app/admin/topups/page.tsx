"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type TopUpStatus = "PENDING" | "APPROVED" | "REJECTED";

interface TopUpRequestRow {
  id: string;
  senderName: string;
  senderBankName: string;
  amount: number;
  note: string | null;
  status: TopUpStatus;
  reviewNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  customer: {
    id: string;
    username: string;
    email: string;
    balance: number;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function TopUpsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TopUpRequestRow[]>([]);
  const [status, setStatus] = useState<"ALL" | TopUpStatus>("PENDING");
  const [query, setQuery] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("q", query);
      params.set("page", "1");
      params.set("pageSize", "100");
      const res = await fetch(`/api/admin/topup-requests?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Could not load top-up requests" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function processRequest(id: string, action: "APPROVE" | "REJECT") {
    try {
      setBusyId(id);
      const res = await fetch("/api/admin/topup-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          action,
          reviewNote: (reviewNotes[id] || "").trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      addToast({
        type: "success",
        title: action === "APPROVE" ? "Request approved" : "Request rejected",
        description: action === "APPROVE" ? "Balance credited to customer." : "Request marked as rejected.",
      });
      await load();
    } catch (error: any) {
      addToast({ type: "error", title: "Error", description: error.message || "Action failed" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Topbar title="Top-up Requests" description="Approve or reject manual deposit requests" />

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={status === "PENDING" ? "default" : "outline"} onClick={() => setStatus("PENDING")}>Pending</Button>
            <Button size="sm" variant={status === "APPROVED" ? "default" : "outline"} onClick={() => setStatus("APPROVED")}>Approved</Button>
            <Button size="sm" variant={status === "REJECTED" ? "default" : "outline"} onClick={() => setStatus("REJECTED")}>Rejected</Button>
            <Button size="sm" variant={status === "ALL" ? "default" : "outline"} onClick={() => setStatus("ALL")}>All</Button>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username, email, sender, bank"
              className="ml-auto max-w-sm"
            />
            <Button size="sm" variant="outline" onClick={load}>Search</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1119] p-4">
          {loading ? (
            <div className="text-sm text-zinc-400">Loading requests...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-zinc-400">No requests found.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {row.customer.username} <span className="text-zinc-500">({row.customer.email})</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Request #{row.id.slice(-8)} | {new Date(row.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-300">${Number(row.amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-zinc-400">{row.status}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                    <div><span className="text-zinc-500">Sender Name:</span> {row.senderName}</div>
                    <div><span className="text-zinc-500">Bank Name:</span> {row.senderBankName}</div>
                    <div><span className="text-zinc-500">Current Balance:</span> ${Number(row.customer.balance || 0).toFixed(2)}</div>
                    <div><span className="text-zinc-500">Note:</span> {row.note || "-"}</div>
                  </div>

                  {row.reviewNote ? (
                    <div className="mt-2 text-xs text-violet-300">Review Note: {row.reviewNote}</div>
                  ) : null}

                  {row.status === "PENDING" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        value={reviewNotes[row.id] || ""}
                        onChange={(e) => setReviewNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder="Optional admin note"
                        className="max-w-md"
                      />
                      <Button size="sm" disabled={busyId === row.id} onClick={() => processRequest(row.id, "APPROVE")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => processRequest(row.id, "REJECT")}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-zinc-500">
                      Processed at{" "}
                      {new Date((row.approvedAt || row.rejectedAt || row.createdAt) as string).toLocaleString("tr-TR")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
