"use client";

import { useState, useEffect, useCallback } from "react";
import { Gauge, Clock, AlertTriangle, Activity, RefreshCw, Zap } from "lucide-react";

interface SlowEndpoint {
  path: string;
  avgDuration: number;
  count: number;
  lastSeen: string;
}

interface RecentMetric {
  id: string;
  type: string;
  path: string | null;
  duration: number;
  createdAt: string;
}

interface PerformanceData {
  avgResponseTime: number;
  slowEndpoints: SlowEndpoint[];
  errorRate: number;
  totalMetrics: number;
  recentMetrics: RecentMetric[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function avgResponseColor(ms: number) {
  if (ms < 200) return "text-emerald-400";
  if (ms <= 500) return "text-amber-400";
  return "text-red-400";
}

function errorRateColor(pct: number) {
  if (pct < 1) return "text-emerald-400";
  if (pct <= 5) return "text-amber-400";
  return "text-red-400";
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/performance", { credentials: "include" });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] bg-[#0a0a1a] text-white rounded-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded bg-[#1e293b] animate-pulse" />
          <div className="h-8 w-48 rounded bg-[#1e293b] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-[#1e293b] rounded w-1/2 mb-3" />
              <div className="h-8 bg-[#1e293b] rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 animate-pulse">
          <div className="h-4 bg-[#1e293b] rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[#1e293b] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[40vh] bg-[#0a0a1a] text-white flex items-center justify-center rounded-xl border border-[#1e293b]">
        <p className="text-gray-400">Failed to load performance data</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gauge className="h-6 w-6 text-violet-400" />
          Performance Monitor
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[#1e293b] bg-[#111827]"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111827] border border-[#1e293b] text-white hover:bg-[#1e293b] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Average Response Time</span>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className={`text-2xl font-bold ${avgResponseColor(data.avgResponseTime)}`}>
            {data.avgResponseTime.toFixed(1)} ms
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Slow Endpoints (&gt;500ms)</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-white">
            {data.slowEndpoints.length}
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Error Rate</span>
            <Activity className="h-4 w-4 text-gray-500" />
          </div>
          <div className={`text-2xl font-bold ${errorRateColor(data.errorRate)}`}>
            {data.errorRate.toFixed(2)}%
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Total Metrics</span>
            <Zap className="h-4 w-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {data.totalMetrics.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slow Endpoints Table */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1e293b]">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Slow Endpoints
            </h2>
          </div>
          <div className="overflow-x-auto">
            {data.slowEndpoints.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No slow endpoints</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e293b]">
                    <th className="text-left p-3 text-gray-400 font-medium">Path</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Avg (ms)</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Count</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slowEndpoints.map((ep, i) => (
                    <tr key={i} className="border-b border-[#1e293b]/50 last:border-0">
                      <td className="p-3 text-white font-mono truncate max-w-[200px]" title={ep.path}>
                        {ep.path}
                      </td>
                      <td className="p-3 text-right text-red-400 font-mono">
                        {ep.avgDuration.toFixed(0)}
                      </td>
                      <td className="p-3 text-right text-gray-300">{ep.count}</td>
                      <td className="p-3 text-right text-gray-400 text-xs">
                        {formatDate(ep.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Metrics Table */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1e293b]">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-400" />
              Recent Metrics (last 50)
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            {data.recentMetrics.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No metrics recorded</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#111827]">
                  <tr className="border-b border-[#1e293b]">
                    <th className="text-left p-3 text-gray-400 font-medium">Type</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Path</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Duration</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentMetrics.map((m) => (
                    <tr key={m.id} className="border-b border-[#1e293b]/50 last:border-0">
                      <td className="p-3">
                        <span className="text-violet-400 font-mono text-xs">{m.type}</span>
                      </td>
                      <td className="p-3 text-gray-300 font-mono truncate max-w-[150px]" title={m.path || "-"}>
                        {m.path || "-"}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-300">
                        {m.duration.toFixed(0)} ms
                      </td>
                      <td className="p-3 text-right text-gray-400 text-xs">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
