"use client";

import { useState, useEffect } from "react";
import { Gauge, TrendingUp, TrendingDown, Users, Package, Activity, Shield, Bell, Download } from "lucide-react";

interface ExecutiveData {
  traffic: {
    last7: number;
    prev7: number;
    last30: number;
    growthPct: number;
  };
  products: {
    total: number;
    active: number;
    topByViews: { name: string; views: number }[];
    riskList: { name: string; reason: string; severity: string }[];
    stabilityIndex: number;
  };
  system: {
    status: string;
    dbOk: boolean;
    webhookFailures: number;
  };
  notifications: {
    criticalCount: number;
    warningCount: number;
  };
}

export default function ExecutivePage() {
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, systemRes, notifRes, productsRes] = await Promise.all([
          fetch("/api/admin/analytics?days=30"),
          fetch("/api/admin/system"),
          fetch("/api/admin/notifications?limit=100"),
          fetch("/api/admin/products"),
        ]);

        const analytics = await analyticsRes.json();
        const system = await systemRes.json();
        const notifs = await notifRes.json();

        // Compute 7-day vs prev 7-day
        const daily = analytics.data?.traffic?.dailyViews || [];
        const last7 = daily.slice(-7).reduce((s: number, d: any) => s + d.sessions, 0);
        const prev7 = daily.slice(-14, -7).reduce((s: number, d: any) => s + d.sessions, 0);
        const growthPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;

        // Risk list from products
        const products = analytics.data?.products?.statusDistribution || [];
        const riskList: { name: string; reason: string; severity: string }[] = [];

        // Count critical/warning notifications
        const allNotifs = notifs.data || [];
        const criticalCount = allNotifs.filter((n: any) => n.severity === "CRITICAL" && !n.isRead).length;
        const warningCount = allNotifs.filter((n: any) => n.severity === "WARNING" && !n.isRead).length;

        // Top products by page views (from events)
        const topEvents = analytics.data?.events || [];
        const productViewEvents = topEvents.filter((e: any) => e.name === "VIEW_PRODUCT");

        // Stability index (fewer status changes = more stable)
        const statusChanges = await fetch("/api/admin/audit?action=STATUS_CHANGE&limit=100").then(r => r.json()).catch(() => ({ data: [] }));
        const changeCount = Array.isArray(statusChanges.data) ? statusChanges.data.length : 0;
        const stabilityIndex = Math.max(0, 100 - changeCount * 2);

        setData({
          traffic: {
            last7,
            prev7,
            last30: analytics.data?.traffic?.totalSessions || 0,
            growthPct: Math.round(growthPct * 10) / 10,
          },
          products: {
            total: analytics.data?.products?.total || 0,
            active: analytics.data?.products?.active || 0,
            topByViews: [],
            riskList,
            stabilityIndex: Math.min(100, stabilityIndex),
          },
          system: {
            status: system.data?.database?.status === "connected" ? "healthy" : "degraded",
            dbOk: system.data?.database?.status === "connected",
            webhookFailures: system.data?.webhooks?.failedCount || 0,
          },
          notifications: { criticalCount, warningCount },
        });
      } catch (err) {
        console.error("Executive fetch error:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Traffic Last 7 Days", data.traffic.last7],
      ["Traffic Previous 7 Days", data.traffic.prev7],
      ["Growth %", data.traffic.growthPct],
      ["Total Visitors (30d)", data.traffic.last30],
      ["Total Products", data.products.total],
      ["Active Products", data.products.active],
      ["Stability Index", data.products.stabilityIndex],
      ["System Status", data.system.status],
      ["Webhook Failures", data.system.webhookFailures],
      ["Critical Notifications", data.notifications.criticalCount],
      ["Warning Notifications", data.notifications.warningCount],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive-snapshot-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" /> Executive Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-8 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">Failed to load data</div>;

  const systemColor = data.system.status === "healthy" ? "text-emerald-400" : data.system.status === "degraded" ? "text-amber-400" : "text-red-400";
  const systemBg = data.system.status === "healthy" ? "bg-emerald-500/10" : data.system.status === "degraded" ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" /> Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">High-level overview for decision makers</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-card border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <Download className="h-4 w-4" /> Export Snapshot
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Traffic Growth */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Traffic Growth (7d)</span>
            {data.traffic.growthPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div className="text-3xl font-bold">
            {data.traffic.growthPct >= 0 ? "+" : ""}{data.traffic.growthPct}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.traffic.last7} vs {data.traffic.prev7} sessions
          </p>
        </div>

        {/* Total Visitors */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Visitors (30d)</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold">{data.traffic.last30.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Total sessions in 30 days</p>
        </div>

        {/* Products */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Products</span>
            <Package className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold">{data.products.active}/{data.products.total}</div>
          <p className="text-xs text-muted-foreground mt-1">Active / Total</p>
        </div>

        {/* Stability Index */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Stability Index</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold">{data.products.stabilityIndex}%</div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all"
              style={{ width: `${data.products.stabilityIndex}%` }}
            />
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* System Health */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Overall Status</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${systemBg} ${systemColor}`}>
                {data.system.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <span className={`text-xs ${data.system.dbOk ? "text-emerald-400" : "text-red-400"}`}>
                {data.system.dbOk ? "Connected" : "Error"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Webhook Failures</span>
              <span className={`text-xs ${data.system.webhookFailures > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {data.system.webhookFailures}
              </span>
            </div>
          </div>
        </div>

        {/* Notifications Summary */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Alerts Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm">Critical</span>
              </div>
              <span className="text-lg font-bold text-red-400">{data.notifications.criticalCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm">Warning</span>
              </div>
              <span className="text-lg font-bold text-amber-400">{data.notifications.warningCount}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Quick Links</h3>
          <div className="space-y-2">
            <a href="/admin/analytics" className="block text-sm text-primary hover:underline">View Full Analytics →</a>
            <a href="/admin/products" className="block text-sm text-primary hover:underline">Manage Products →</a>
            <a href="/admin/security" className="block text-sm text-primary hover:underline">Security Center →</a>
            <a href="/admin/notifications" className="block text-sm text-primary hover:underline">All Notifications →</a>
            <a href="/admin/system" className="block text-sm text-primary hover:underline">System Health →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
