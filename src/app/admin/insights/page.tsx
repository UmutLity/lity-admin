"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WARNING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
};

const TYPE_COLORS: Record<string, string> = {
  TRAFFIC_SPIKE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  TRAFFIC_DROP: "bg-red-500/20 text-red-400 border-red-500/30",
  STATUS_INSTABILITY: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  LONG_UPDATING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  WEBHOOK_FAILURE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SECURITY_ANOMALY: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Insight {
  id: string;
  type: string;
  severity: string;
  message: string;
  relatedEntity?: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface WeeklySummary {
  TRAFFIC_SPIKE?: number;
  TRAFFIC_DROP?: number;
  STATUS_INSTABILITY?: number;
  LONG_UPDATING?: number;
  WEBHOOK_FAILURE?: number;
  SECURITY_ANOMALY?: number;
}

interface InsightsData {
  insights: Insight[];
  weeklySummary?: WeeklySummary;
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl border border-[#1e293b] bg-[#111827] p-5 animate-pulse"
      style={{ minHeight: 140 }}
    >
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-20 rounded-full bg-[#1e293b]" />
        <div className="h-6 w-16 rounded-full bg-[#1e293b]" />
      </div>
      <div className="h-4 rounded bg-[#1e293b] w-3/4 mb-2" />
      <div className="h-4 rounded bg-[#1e293b] w-1/2 mb-2" />
      <div className="h-3 rounded bg-[#1e293b] w-1/3" />
    </div>
  );
}

function SkeletonSummaryCard() {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-4 animate-pulse">
      <div className="h-4 rounded bg-[#1e293b] w-24 mb-3" />
      <div className="h-8 rounded bg-[#1e293b] w-12" />
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchInsights = async () => {
    try {
      const res = await fetch("/api/admin/insights", { credentials: "include" });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/insights", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      if (res.ok) {
        await fetchInsights();
      }
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setScanning(false);
    }
  };

  const resolveInsight = async (insightId: string) => {
    setResolvingId(insightId);
    try {
      const res = await fetch("/api/admin/insights", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId }),
      });
      if (res.ok) {
        await fetchInsights();
      }
    } catch (err) {
      console.error("Resolve failed:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const insights = data?.insights ?? [];
  const activeInsights = insights.filter((i) => !i.resolvedAt);
  const historicalInsights = insights.filter((i) => i.resolvedAt);
  const weeklySummary = data?.weeklySummary ?? {};
  const typeOrder = [
    "TRAFFIC_SPIKE",
    "TRAFFIC_DROP",
    "STATUS_INSTABILITY",
    "LONG_UPDATING",
    "WEBHOOK_FAILURE",
    "SECURITY_ANOMALY",
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "TRAFFIC_SPIKE":
        return <TrendingUp className="h-4 w-4" />;
      case "TRAFFIC_DROP":
        return <TrendingDown className="h-4 w-4" />;
      case "SECURITY_ANOMALY":
        return <Shield className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-400" />
            AI Insights & Anomaly Detection
          </h1>
          <p className="text-slate-400 mt-1">
            Monitor traffic anomalies, status instability, webhook failures and security events
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Run Detection Scan"}
        </button>
      </div>

      {/* Weekly Summary */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
          <Activity className="h-5 w-5 text-violet-400" />
          Weekly Summary
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonSummaryCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {typeOrder.map((type) => {
              const count = weeklySummary[type as keyof WeeklySummary] ?? 0;
              const colorClass = TYPE_COLORS[type] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
              return (
                <div
                  key={type}
                  className="rounded-xl border border-[#1e293b] bg-[#111827] p-4"
                >
                  <p className="text-xs text-slate-400 mb-1 truncate" title={type}>
                    {type.replace(/_/g, " ")}
                  </p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Insights */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Active Insights ({activeInsights.length})
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : activeInsights.length === 0 ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-slate-400">No active insights. System looks healthy.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-[#1e293b] bg-[#111827] p-5 flex flex-col"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${TYPE_COLORS[insight.type] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                  >
                    {getTypeIcon(insight.type)}
                    {insight.type.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${SEVERITY_COLORS[insight.severity] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                  >
                    {insight.severity}
                  </span>
                </div>
                <p className="text-slate-200 text-sm mb-2 flex-1">{insight.message}</p>
                {insight.relatedEntity && (
                  <p className="text-xs text-slate-500 mb-2">
                    Entity: <span className="font-mono text-slate-400">{insight.relatedEntity}</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mb-3">
                  {new Date(insight.createdAt).toLocaleString()}
                </p>
                <button
                  onClick={() => resolveInsight(insight.id)}
                  disabled={resolvingId === insight.id}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  {resolvingId === insight.id ? "Resolving..." : "Resolve"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historical (Resolved) Insights */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          Historical Insights ({historicalInsights.length})
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : historicalInsights.length === 0 ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-8 text-center">
            <p className="text-slate-400">No resolved insights yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historicalInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-[#1e293b] bg-[#111827] p-5 opacity-80"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${TYPE_COLORS[insight.type] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                  >
                    {getTypeIcon(insight.type)}
                    {insight.type.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${SEVERITY_COLORS[insight.severity] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                  >
                    {insight.severity}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="h-3 w-3" /> Resolved
                  </span>
                </div>
                <p className="text-slate-200 text-sm mb-2">{insight.message}</p>
                {insight.relatedEntity && (
                  <p className="text-xs text-slate-500 mb-2">
                    Entity: <span className="font-mono text-slate-400">{insight.relatedEntity}</span>
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Resolved: {insight.resolvedAt && new Date(insight.resolvedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
