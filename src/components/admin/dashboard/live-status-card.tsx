import type { ComponentType } from "react";
import { Activity, Database, RefreshCcw, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthState = "healthy" | "degraded" | "down" | "unknown";

export interface LiveStatusSnapshot {
  api: HealthState;
  database: HealthState;
  webhook: HealthState;
  databaseLatencyMs: number;
  webhookSuccessRate: number;
  failedWebhooks: number;
  checkedAt: string;
}

interface LiveStatusCardProps {
  loading?: boolean;
  snapshot: LiveStatusSnapshot;
}

const statusTone: Record<HealthState, string> = {
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  down: "border-red-500/30 bg-red-500/10 text-red-200",
  unknown: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const dotTone: Record<HealthState, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-red-400",
  unknown: "bg-zinc-400",
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return "just now";
  const diffMs = Math.max(0, now - ts);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  return `${hour}h ago`;
}

function ServiceRow({
  icon: Icon,
  label,
  state,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  state: HealthState;
  detail: string;
}) {
  return (
    <div className="flex h-12 items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
          <p className="text-xs text-zinc-300">{detail}</p>
        </div>
      </div>
      <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", statusTone[state])}>
        <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", dotTone[state])} />
        {state}
      </Badge>
    </div>
  );
}

export function LiveStatusCard({ loading, snapshot }: LiveStatusCardProps) {
  return (
    <div className="admin-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-zinc-100">Live Status</p>
          <p className="text-xs text-zinc-500">API, database and webhook health</p>
        </div>
        <Badge className="rounded-full border border-violet-500/30 bg-violet-500/10 text-[10px] uppercase tracking-wide text-violet-200">
          <RefreshCcw className="mr-1 h-3 w-3" />
          {loading ? "Checking..." : timeAgo(snapshot.checkedAt)}
        </Badge>
      </div>

      <div className="grid gap-2">
        {loading ? (
          <>
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            <div className="h-12 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          </>
        ) : (
          <>
            <ServiceRow
              icon={Activity}
              label="API"
              state={snapshot.api}
              detail={snapshot.api === "healthy" ? "Admin endpoints responding" : "Endpoint response degraded"}
            />
            <ServiceRow
              icon={Database}
              label="Database"
              state={snapshot.database}
              detail={snapshot.databaseLatencyMs > 0 ? `${snapshot.databaseLatencyMs}ms query latency` : "No latency sample"}
            />
            <ServiceRow
              icon={Webhook}
              label="Webhook"
              state={snapshot.webhook}
              detail={`${snapshot.webhookSuccessRate}% success - ${snapshot.failedWebhooks} failed`}
            />
          </>
        )}
      </div>
    </div>
  );
}

