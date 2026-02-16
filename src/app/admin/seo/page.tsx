"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Globe,
  Eye,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

interface SeoPage {
  path: string;
  views: number;
  title: string;
}

interface TrafficSources {
  direct: number;
  referral: number;
}

interface Suggestion {
  message: string;
  severity: "info" | "warning" | "error";
}

interface SeoData {
  pages: SeoPage[];
  trafficSources: TrafficSources;
  healthScore: number;
  suggestions: Suggestion[];
}

function getHealthColor(score: number): string {
  if (score < 40) return "#ef4444";
  if (score >= 40 && score <= 70) return "#f59e0b";
  return "#10b981";
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: "info" | "warning" | "error" }> = {
  info: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    icon: "info",
  },
  warning: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
    icon: "warning",
  },
  error: {
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    icon: "error",
  },
};

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-5 animate-pulse">
      <div className="h-4 rounded bg-[#1e293b] w-1/3 mb-4" />
      <div className="h-20 rounded bg-[#1e293b] w-full" />
      <div className="h-4 rounded bg-[#1e293b] w-2/3 mt-3" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] overflow-hidden animate-pulse">
      <div className="p-4 border-b border-[#1e293b]">
        <div className="h-4 rounded bg-[#1e293b] w-32" />
      </div>
      <div className="divide-y divide-[#1e293b]">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 flex gap-4">
            <div className="h-4 rounded bg-[#1e293b] w-6" />
            <div className="h-4 rounded bg-[#1e293b] flex-1" />
            <div className="h-4 rounded bg-[#1e293b] w-12" />
            <div className="h-4 rounded bg-[#1e293b] w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonScore() {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-8 flex flex-col items-center justify-center animate-pulse">
      <div className="w-40 h-40 rounded-full bg-[#1e293b]" />
      <div className="h-4 rounded bg-[#1e293b] w-24 mt-4" />
    </div>
  );
}

export default function SeoPage() {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSeo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seo", { credentials: "include" });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch SEO data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeo();
  }, []);

  const pages = data?.pages ?? [];
  const trafficSources = data?.trafficSources ?? { direct: 0, referral: 0 };
  const healthScore = data?.healthScore ?? 0;
  const suggestions = data?.suggestions ?? [];

  const totalTraffic = trafficSources.direct + trafficSources.referral;
  const directPct = totalTraffic > 0 ? (trafficSources.direct / totalTraffic) * 100 : 0;
  const referralPct = totalTraffic > 0 ? (trafficSources.referral / totalTraffic) * 100 : 0;

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  const getSuggestionIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-400" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-violet-400" />
          SEO Intelligence
        </h1>
        <p className="text-slate-400 mt-1">
          Monitor search health, traffic sources, and page performance
        </p>
      </div>

      {/* SEO Health Score + Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Health Score */}
        <div className="lg:col-span-1">
          {loading ? (
            <SkeletonScore />
          ) : (
            <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-8 flex flex-col items-center justify-center">
              <h3 className="text-sm font-medium text-slate-400 mb-4">SEO Health Score</h3>
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={getHealthColor(healthScore)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{Math.round(healthScore)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Traffic Sources */}
        <div className="lg:col-span-2">
          {loading ? (
            <SkeletonCard />
          ) : (
            <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-slate-200">
                <Globe className="h-5 w-5 text-violet-400" />
                Traffic Sources
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">Direct</span>
                    <span className="font-medium">{directPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#1e293b] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${directPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">Referral</span>
                    <span className="font-medium">{referralPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#1e293b] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{ width: `${referralPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Most Visited Pages */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
          <TrendingUp className="h-5 w-5 text-violet-400" />
          Most Visited Pages
        </h2>
        {loading ? (
          <SkeletonTable />
        ) : (
          <div className="rounded-xl border border-[#1e293b] bg-[#111827] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e293b] bg-[#0f172a]/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400 w-12">#</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Page Path</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400 w-24">Views</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.slice(0, 20).map((page, i) => (
                    <tr
                      key={page.path + i}
                      className={`border-b border-[#1e293b] ${
                        i % 2 === 0 ? "bg-[#111827]" : "bg-[#0f172a]/30"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-3 px-4 text-sm font-mono text-slate-200 truncate max-w-[200px]">
                        {page.path}
                      </td>
                      <td className="py-3 px-4 text-sm flex items-center gap-1">
                        <Eye className="h-4 w-4 text-slate-500" />
                        {page.views.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300 truncate max-w-[240px]" title={page.title}>
                        {page.title || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages.length === 0 && !loading && (
              <div className="py-12 text-center text-slate-500">No page data yet</div>
            )}
          </div>
        )}
      </section>

      {/* Suggestions */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
          <ExternalLink className="h-5 w-5 text-violet-400" />
          Suggestions
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-slate-400">No suggestions. SEO looks healthy.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((s, i) => {
              const style = SEVERITY_STYLES[s.severity] ?? SEVERITY_STYLES.info;
              return (
                <div
                  key={i}
                  className={`rounded-xl border bg-[#111827] p-4 ${style.bg} ${style.border}`}
                >
                  <div className="flex items-start gap-3">
                    {getSuggestionIcon(s.severity)}
                    <p className="text-sm text-slate-200 flex-1">{s.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
