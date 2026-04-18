"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { RefreshCw, RotateCcw, Webhook } from "lucide-react";

type Delivery = {
  id: string;
  provider: string;
  event: string;
  entityId: string;
  success: boolean;
  responseCode?: number | null;
  responseBody?: string | null;
  attempts: number;
  createdAt: string;
  changelog?: {
    id: string;
    title: string;
    publishedAt: string | null;
  } | null;
};

export default function WebhookCenterPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"FAILED" | "SUCCESS" | "ALL">("FAILED");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const failedCount = useMemo(() => rows.filter((row) => !row.success).length, [rows]);

  const loadRows = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/webhooks?status=${status}&limit=100`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not load webhooks");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      addToast({ type: "error", title: "Webhook list failed", description: error?.message || "Server error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [status]);

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      const res = await fetch(`/api/admin/webhooks/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Retry failed");
      }
      addToast({ type: "success", title: "Webhook retried", description: data?.message || "Retry sent." });
      await loadRows();
    } catch (error: any) {
      addToast({ type: "error", title: "Retry failed", description: error?.message || "Server error" });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div>
      <Topbar title="Webhook Center" description="Monitor failed webhook deliveries and retry failed events.">
        <Button variant="outline" onClick={loadRows} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </Topbar>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-zinc-500">Scope</p><p className="mt-1 text-xl font-semibold text-white">{status}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-zinc-500">Loaded</p><p className="mt-1 text-xl font-semibold text-white">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-zinc-500">Failed</p><p className="mt-1 text-xl font-semibold text-rose-300">{failedCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-zinc-500">Provider</p><p className="mt-1 text-xl font-semibold text-white">Discord</p></CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-2 p-4">
          {(["FAILED", "SUCCESS", "ALL"] as const).map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(value)}
            >
              {value}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Deliveries</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />)}</div>
          ) : !rows.length ? (
            <p className="py-10 text-center text-sm text-zinc-500">No webhook records in this filter.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.success ? "success" : "destructive"}>{row.success ? "SUCCESS" : "FAILED"}</Badge>
                      <Badge variant="outline">{row.event}</Badge>
                      <span className="text-xs text-zinc-500">{new Date(row.createdAt).toLocaleString("en-US")}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-zinc-100">{row.changelog?.title || row.entityId}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{row.responseBody || "No response body recorded."}</p>
                  </div>
                  {!row.success ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={retryingId === row.id}
                      onClick={() => handleRetry(row.id)}
                    >
                      <RotateCcw className="h-4 w-4" /> Retry
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

