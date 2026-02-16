"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/admin/topbar";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Package, FileText, Image as ImageIcon, Activity,
  TrendingUp, TrendingDown, Shield, Users, ArrowUpRight,
  Clock, Zap,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalChangelogs: number;
  totalMedia: number;
  totalCustomers: number;
  statusCounts: Record<string, number>;
  recentProducts: any[];
  recentChangelogs: any[];
}

function KpiCard({
  title, value, subtitle, icon: Icon, trend, trendValue, color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    purple: "from-purple-500/20 to-violet-500/10 text-purple-400 border-purple-500/10",
    emerald: "from-emerald-500/20 to-green-500/10 text-emerald-400 border-emerald-500/10",
    blue: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/10",
    amber: "from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/10",
    rose: "from-rose-500/20 to-pink-500/10 text-rose-400 border-rose-500/10",
  };

  const iconBg: Record<string, string> = {
    purple: "bg-purple-500/15 text-purple-400",
    emerald: "bg-emerald-500/15 text-emerald-400",
    blue: "bg-blue-500/15 text-blue-400",
    amber: "bg-amber-500/15 text-amber-400",
    rose: "bg-rose-500/15 text-rose-400",
  };

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1.5 text-white tracking-tight">{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {trend && trendValue && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-semibold",
                trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500"
              )}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {trendValue}
              </span>
            )}
            {subtitle && <span className="text-[11px] text-zinc-600">{subtitle}</span>}
          </div>
        </div>
        <div className={cn("flex items-center justify-center w-11 h-11 rounded-xl", iconBg[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [productsRes, changelogsRes, mediaRes, customersRes] = await Promise.all([
          fetch("/api/admin/products", { credentials: "include" }),
          fetch("/api/admin/changelog", { credentials: "include" }),
          fetch("/api/admin/media", { credentials: "include" }),
          fetch("/api/admin/customers", { credentials: "include" }),
        ]);

        const products = (await productsRes.json()).data || [];
        const changelogs = (await changelogsRes.json()).data || [];
        const media = (await mediaRes.json()).data || [];
        const customers = (await customersRes.json()).data || [];

        const statusCounts: Record<string, number> = {};
        products.forEach((p: any) => {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });

        setStats({
          totalProducts: products.length,
          activeProducts: products.filter((p: any) => p.isActive).length,
          totalChangelogs: changelogs.length,
          totalMedia: media.length,
          totalCustomers: customers.length,
          statusCounts,
          recentProducts: products.slice(0, 6),
          recentChangelogs: changelogs.slice(0, 5),
        });
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div>
        <Topbar title="Dashboard" description="Overview of your platform" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="kpi-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="skeleton h-3 w-20 mb-3" />
                  <div className="skeleton h-7 w-16 mb-2" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton w-11 h-11 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="premium-card p-6">
              <div className="skeleton h-5 w-32 mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((j) => <div key={j} className="skeleton h-12 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Dashboard" description="Overview of your platform" />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Total Products"
          value={stats?.totalProducts || 0}
          subtitle="all time"
          icon={Package}
          color="purple"
        />
        <KpiCard
          title="Active Products"
          value={stats?.activeProducts || 0}
          subtitle="currently live"
          icon={TrendingUp}
          trend="up"
          trendValue={`${stats?.totalProducts ? Math.round(((stats?.activeProducts || 0) / stats.totalProducts) * 100) : 0}%`}
          color="emerald"
        />
        <KpiCard
          title="Changelogs"
          value={stats?.totalChangelogs || 0}
          subtitle="published updates"
          icon={FileText}
          color="blue"
        />
        <KpiCard
          title="Customers"
          value={stats?.totalCustomers || 0}
          subtitle="registered"
          icon={Users}
          color="amber"
        />
        <KpiCard
          title="Media Files"
          value={stats?.totalMedia || 0}
          subtitle="uploaded"
          icon={ImageIcon}
          color="rose"
        />
      </div>

      {/* Status Overview + Recent Products */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Status Overview */}
        <div className="lg:col-span-2 premium-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/15">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Status Overview</h3>
                <p className="text-[11px] text-zinc-500">Product status distribution</p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-1">
            {Object.entries(stats?.statusCounts || {}).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.02] transition-colors"
              >
                <StatusBadge status={status as any} glow />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tabular-nums">{count}</span>
                  <span className="text-[11px] text-zinc-600">
                    {stats?.totalProducts ? `${Math.round((count / stats.totalProducts) * 100)}%` : ""}
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(stats?.statusCounts || {}).length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-600">No products yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Products */}
        <div className="lg:col-span-3 premium-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15">
                <Package className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Products</h3>
                <p className="text-[11px] text-zinc-500">Latest added products</p>
              </div>
            </div>
            <Link
              href="/admin/products"
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {stats?.recentProducts.map((product, i) => (
              <Link
                key={product.id}
                href={`/admin/products/${product.id}/edit`}
                className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-all duration-150 group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] text-zinc-500 group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-all flex-shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{product.name}</p>
                    <p className="text-[11px] text-zinc-600 truncate">{product.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <StatusBadge status={product.status} />
                  <ArrowUpRight className="h-3.5 w-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {(stats?.recentProducts.length || 0) === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-600">No products yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Changelogs */}
      {(stats?.recentChangelogs?.length || 0) > 0 && (
        <div className="mt-6 premium-card overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15">
                <Clock className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Updates</h3>
                <p className="text-[11px] text-zinc-500">Latest changelog entries</p>
              </div>
            </div>
            <Link
              href="/admin/changelog"
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {stats?.recentChangelogs.map((cl: any, i: number) => {
              const typeColors: Record<string, string> = {
                UPDATE: "bg-purple-500/15 text-purple-400",
                FIX: "bg-emerald-500/15 text-emerald-400",
                WARNING: "bg-amber-500/15 text-amber-400",
                INFO: "bg-blue-500/15 text-blue-400",
              };
              return (
                <Link
                  key={cl.id}
                  href={`/admin/changelog/${cl.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold flex-shrink-0",
                      typeColors[cl.type] || typeColors.UPDATE
                    )}>
                      {cl.type?.charAt(0) || "U"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{cl.title}</p>
                      <p className="text-[11px] text-zinc-600">
                        {cl.status === "PUBLISHED" ? "Published" : "Draft"}
                        {cl.publishedAt && ` • ${new Date(cl.publishedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
