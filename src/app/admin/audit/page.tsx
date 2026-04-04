"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight, Download, Eye, Search, Shield, X } from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  diff: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "PUBLISH",
  "LOGIN_SUCCESS",
  "LOGIN_FAIL",
  "STATUS_CHANGE",
  "SETTINGS_UPDATE",
  "WEBHOOK_TEST",
  "WEBHOOK_SEND",
  "2FA_ENABLE",
  "2FA_DISABLE",
  "LOCK",
  "UNLOCK",
  "MEDIA_UPLOAD",
  "MEDIA_DELETE",
  "ROLE_CHANGE",
];

const ENTITIES = ["Product", "Changelog", "SiteSetting", "User", "Media", "Role", "Security", "Webhook"];

const actionTone = (action: string) => {
  const key = String(action || "").toUpperCase();
  if (key.includes("DELETE") || key.includes("FAIL") || key === "LOCK") return "border-rose-400/20 bg-rose-500/10 text-rose-300";
  if (key.includes("CREATE") || key.includes("ENABLE") || key.includes("SUCCESS") || key === "UNLOCK") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  if (key.includes("UPDATE") || key.includes("CHANGE")) return "border-sky-400/20 bg-sky-500/10 text-sky-300";
  if (key.includes("PUBLISH") || key.includes("ROLE")) return "border-violet-400/20 bg-violet-500/10 text-violet-300";
  return "border-amber-400/20 bg-amber-500/10 text-amber-300";
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR");
}

function parseJsonBlock(raw: string | null) {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AuditPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");
  const pageSize = 30;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity", filterEntity);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Failed to load audit logs");
      setLogs(Array.isArray(data.data) ? data.data : []);
      setTotal(Number(data?.meta?.total || 0));
    } catch (error) {
      console.error(error);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterAction, filterEntity, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const visibleLogs = useMemo(() => {
    if (!query.trim()) return logs;
    const needle = query.trim().toLowerCase();
    return logs.filter((item) => {
      const haystack = `${item.action} ${item.entity} ${item.user?.name || ""} ${item.user?.email || ""} ${item.ip || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [logs, query]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const successCount = logs.filter((item) => {
    const action = String(item.action || "").toUpperCase();
    return action.includes("SUCCESS") || action.includes("CREATE") || action.includes("ENABLE");
  }).length;
  const riskyCount = logs.filter((item) => {
    const action = String(item.action || "").toUpperCase();
    return action.includes("DELETE") || action.includes("FAIL") || action === "LOCK";
  }).length;

  function resetFilters() {
    setFilterAction("");
    setFilterEntity("");
    setDateFrom("");
    setDateTo("");
    setQuery("");
    setPage(1);
  }

  function exportCsv() {
    const params = new URLSearchParams({ format: "csv" });
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entity", filterEntity);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/admin/audit?${params.toString()}`, "_blank");
    addToast({ type: "success", title: "CSV export started" });
  }

  return (
    <div className="space-y-4">
      <Topbar title="Audit Log" description="Track admin actions, security events, and important changes.">
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </Topbar>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Total Logs</p>
          <p className="mt-2 text-3xl font-semibold text-white">{total}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,15,22,0.92),rgba(11,12,18,0.98))] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Current Page</p>
          <p className="mt-2 text-3xl font-semibold text-white">{logs.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Success Events</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{successCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Risk Events</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300">{riskyCount}</p>
        </div>
      </div>

      <div className="premium-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,auto)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by action, user, entity, or IP..."
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-3 text-sm text-zinc-200 outline-none transition focus:border-[#b9accf]/35"
            />
          </div>
          <select
            value={filterAction}
            onChange={(event) => {
              setFilterAction(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
          >
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            value={filterEntity}
            onChange={(event) => {
              setFilterEntity(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
          >
            <option value="">All entities</option>
            {ENTITIES.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none"
          />
          <Button variant="ghost" onClick={resetFilters} className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]">
            <X className="h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="premium-card overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : visibleLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">No audit logs match the current filters.</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {visibleLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedLog(log)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                    selectedLog?.id === log.id ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${actionTone(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm font-semibold text-white">{log.entity}</span>
                      {log.entityId ? <span className="text-xs text-zinc-500">#{log.entityId.slice(-8)}</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-200">{log.user?.name || "System"} <span className="text-zinc-500">- {log.user?.email || "no-email"}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDateTime(log.createdAt)} {log.ip ? `• ${log.ip}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Eye className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
              <p className="text-sm text-zinc-500">
                Page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="premium-card min-h-[520px] p-4">
          {selectedLog ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Selected Event</p>
                  <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                    <Shield className="h-4 w-4 text-[#c7bdd8]" />
                    {selectedLog.action}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg border border-white/[0.08] p-2 text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">User</p>
                  <p className="mt-2 text-sm font-medium text-white">{selectedLog.user?.name || "System"}</p>
                  <p className="text-xs text-zinc-500">{selectedLog.user?.email || "-"}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Entity</p>
                  <p className="mt-2 text-sm font-medium text-white">{selectedLog.entity}</p>
                  <p className="text-xs text-zinc-500">{selectedLog.entityId || "No entity id"}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Time</p>
                  <p className="mt-2 text-sm font-medium text-white">{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Source</p>
                  <p className="mt-2 text-sm font-medium text-white">{selectedLog.ip || "Unknown IP"}</p>
                  <p className="truncate text-xs text-zinc-500">{selectedLog.userAgent || "-"}</p>
                </div>
              </div>

              {selectedLog.diff ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Diff Summary</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">{selectedLog.diff}</pre>
                </div>
              ) : null}

              {selectedLog.before ? (
                <div className="rounded-xl border border-rose-400/12 bg-rose-500/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Before</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">{parseJsonBlock(selectedLog.before)}</pre>
                </div>
              ) : null}

              {selectedLog.after ? (
                <div className="rounded-xl border border-emerald-400/12 bg-emerald-500/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">After</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">{parseJsonBlock(selectedLog.after)}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center text-center text-zinc-500">
              <Shield className="mb-3 h-10 w-10 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-300">Select an audit log</p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">Open any event from the list to inspect the user, source, and change payload.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
