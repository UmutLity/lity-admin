"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, Users, Eye, MousePointerClick, TrendingUp, TrendingDown,
  Clock, Monitor, Smartphone, Tablet, ArrowRight, Download, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  UNDETECTED: "#22c55e",
  DETECTED: "#ef4444",
  UPDATING: "#f59e0b",
  MAINTENANCE: "#3b82f6",
  DISCONTINUED: "#6b7280",
};

const DEVICE_ICONS: Record<string, any> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [days]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [["Date", "Views", "Sessions"]];
    data.traffic.dailyViews.forEach((d: any) => rows.push([d.date, d.views, d.sessions]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Analytics
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

  if (!data) return <div className="text-center py-12 text-muted-foreground">Failed to load analytics</div>;

  const t = data.traffic;
  const viewsTrend = t.yesterdayViews > 0 ? ((t.todayViews - t.yesterdayViews) / t.yesterdayViews * 100).toFixed(1) : "0";
  const sessionsTrend = t.yesterdaySessions > 0 ? ((t.todaySessions - t.yesterdaySessions) / t.yesterdaySessions * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Traffic, behavior & product intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-card border rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={fetchData} className="p-2 rounded-lg bg-card border hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-card border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Traffic KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Today Views</span>
            <Eye className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold">{t.todayViews.toLocaleString()}</div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${Number(viewsTrend) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {Number(viewsTrend) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {viewsTrend}% vs yesterday
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Today Sessions</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold">{t.todaySessions.toLocaleString()}</div>
          <div className={`text-xs mt-1 flex items-center gap-1 ${Number(sessionsTrend) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {Number(sessionsTrend) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {sessionsTrend}% vs yesterday
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Unique Visitors</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold">{t.uniqueVisitors.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Last {days} days</p>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Bounce Rate</span>
            <MousePointerClick className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold">{t.bounceRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">Avg duration: {t.avgSessionDuration}s</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Traffic Chart */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Traffic</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={t.dailyViews}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                <Area type="monotone" dataKey="views" stroke="#7c3aed" fill="url(#viewsGrad)" strokeWidth={2} name="Views" />
                <Area type="monotone" dataKey="sessions" stroke="#22c55e" fill="url(#sessGrad)" strokeWidth={2} name="Sessions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Status Pie */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Product Status</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.products.statusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {data.products.statusDistribution.map((entry: any, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || "#666"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {data.products.statusDistribution.map((s: any) => (
              <span key={s.status} className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.status] || "#666" }} />
                {s.status} ({s.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Conversion Funnel</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { label: "Homepage", value: data.funnel.homepage, color: "bg-blue-500" },
            { label: "View Product", value: data.funnel.productView, color: "bg-purple-500" },
            { label: "Add to Cart", value: data.funnel.addToCart, color: "bg-amber-500" },
            { label: "Checkout", value: data.funnel.checkout, color: "bg-emerald-500" },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="text-center">
                <div className={`${step.color} text-white rounded-lg px-4 py-3 text-lg font-bold min-w-[80px]`}>
                  {step.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{step.label}</p>
                {i > 0 && arr[i - 1].value > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {((step.value / arr[i - 1].value) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      {/* Device Distribution + Top Pages + Top Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device Distribution */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Devices</h3>
          <div className="space-y-3">
            {t.deviceDistribution.map((d: any) => {
              const Icon = DEVICE_ICONS[d.device] || Monitor;
              const total = t.deviceDistribution.reduce((s: number, x: any) => s + x.count, 0);
              const pct = total > 0 ? (d.count / total * 100).toFixed(1) : "0";
              return (
                <div key={d.device} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{d.device}</span>
                      <span className="text-muted-foreground">{d.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {t.deviceDistribution.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Top Pages</h3>
          <div className="space-y-2">
            {t.topPages.slice(0, 8).map((p: any, i: number) => (
              <div key={p.path} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 text-muted-foreground">
                  <span className="text-foreground font-mono text-xs">{i + 1}.</span> {p.path}
                </span>
                <span className="ml-2 font-medium">{p.count}</span>
              </div>
            ))}
            {t.topPages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Top Referrers</h3>
          <div className="space-y-2">
            {t.topReferrers.slice(0, 8).map((r: any, i: number) => (
              <div key={r.referrer} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 text-muted-foreground">
                  <span className="text-foreground font-mono text-xs">{i + 1}.</span> {r.referrer || "Direct"}
                </span>
                <span className="ml-2 font-medium">{r.count}</span>
              </div>
            ))}
            {t.topReferrers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Product & Changelog Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm text-muted-foreground mb-1">Total Products</h3>
          <div className="text-2xl font-bold">{data.products.total}</div>
          <p className="text-xs text-muted-foreground">{data.products.active} active</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm text-muted-foreground mb-1">Changelogs</h3>
          <div className="text-2xl font-bold">{data.changelogs.total}</div>
          <p className="text-xs text-muted-foreground">{data.changelogs.recent} in last {days} days</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm text-muted-foreground mb-1">Customers</h3>
          <div className="text-2xl font-bold">{data.customers.total}</div>
          <p className="text-xs text-emerald-400">+{data.customers.newInPeriod} new</p>
        </div>
      </div>
    </div>
  );
}
