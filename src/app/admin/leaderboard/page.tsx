"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Crown, Medal, Search, Sparkles, Trophy } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TierRow = {
  label: string;
  minSpent: number;
  color: string;
  count: number;
};

type LeaderboardRow = {
  rank: number;
  id: string;
  username: string;
  email: string;
  createdAt: string;
  totalSpent: number;
  orderCount: number;
  tier: {
    label: string;
    minSpent: number;
    color: string;
  };
};

type LeaderboardPayload = {
  summary: {
    totalRankedUsers: number;
    totalRevenue: number;
    averageSpent: number;
    topSpenderAmount: number;
  };
  tiers: TierRow[];
  leaderboard: LeaderboardRow[];
};

const tierThemes: Record<string, string> = {
  Bronze: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  Silver: "border-slate-400/30 bg-slate-300/10 text-slate-100",
  Gold: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  Platinum: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  Diamond: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  Master: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  Grandmaster: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  Legend: "border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-100",
  Mythic: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  Unranked: "border-zinc-700 bg-zinc-900/70 text-zinc-400",
};

const emptyData: LeaderboardPayload = {
  summary: {
    totalRankedUsers: 0,
    totalRevenue: 0,
    averageSpent: 0,
    topSpenderAmount: 0,
  },
  tiers: [],
  leaderboard: [],
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function medalForRank(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-300" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-200" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-500" />;
  return <span className="text-sm text-zinc-500">{rank}</span>;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardPayload>(emptyData);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/leaderboard", { credentials: "include" });
        const json = await res.json();
        if (json?.success) {
          setData(json.data || emptyData);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredRows = useMemo(() => {
    return data.leaderboard.filter((row) => {
      const matchesTier = selectedTier === "ALL" || row.tier.label === selectedTier;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        row.username.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.tier.label.toLowerCase().includes(q);
      return matchesTier && matchesQuery;
    });
  }, [data.leaderboard, query, selectedTier]);

  return (
    <div className="space-y-6">
      <Topbar
        title="Top Spenders Leaderboard"
        description="Track highest-value customers and their spending tiers from the admin panel."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ranked Users" value={String(data.summary.totalRankedUsers)} helper="Customers with successful spend" icon={<Trophy className="h-4 w-4" />} />
        <StatCard title="Tracked Revenue" value={formatMoney(data.summary.totalRevenue)} helper="Non-cancelled order volume" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard title="Average Spend" value={formatMoney(data.summary.averageSpent)} helper="Average per ranked customer" icon={<Medal className="h-4 w-4" />} />
        <StatCard title="Top Spender" value={formatMoney(data.summary.topSpenderAmount)} helper="Current first place total" icon={<Crown className="h-4 w-4" />} />
      </div>

      <Card className="border-white/[0.08] bg-[#11131a] shadow-none">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">Leaderboard</p>
              <p className="mt-1 text-sm text-zinc-400">
                Top spenders, tier distribution, and quick customer lookup.
              </p>
            </div>

            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users..."
                className="h-11 rounded-2xl border-white/[0.08] bg-white/[0.04] pl-10 text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedTier("ALL")}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-medium transition",
                selectedTier === "ALL"
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              All
            </button>
            {data.tiers.map((tier) => (
              <button
                key={tier.label}
                type="button"
                onClick={() => setSelectedTier(tier.label)}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm font-medium transition",
                  tierThemes[tier.label] || tierThemes.Unranked,
                  selectedTier === tier.label ? "ring-1 ring-white/20" : "opacity-85 hover:opacity-100"
                )}
              >
                {tier.label} <span className="ml-1 text-xs opacity-70">${tier.minSpent}+</span>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/[0.06]">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[72px_minmax(220px,1.3fr)_minmax(160px,0.9fr)_140px_140px] gap-4 border-b border-white/[0.06] bg-white/[0.03] px-5 py-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <div>#</div>
                  <div>User</div>
                  <div>Rank</div>
                  <div>Orders</div>
                  <div className="text-right">Total Spent</div>
                </div>

                {loading ? (
                  <div className="p-10 text-center text-sm text-zinc-500">Loading leaderboard...</div>
                ) : filteredRows.length === 0 ? (
                  <div className="p-10 text-center text-sm text-zinc-500">No users matched this filter.</div>
                ) : (
                  filteredRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[72px_minmax(220px,1.3fr)_minmax(160px,0.9fr)_140px_140px] gap-4 border-b border-white/[0.05] px-5 py-4 text-sm last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.04]">
                          {medalForRank(row.rank)}
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] font-semibold text-zinc-200">
                          {row.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{row.username}</p>
                          <p className="truncate text-xs text-zinc-500">{row.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", tierThemes[row.tier.label] || tierThemes.Unranked)}>
                          {row.tier.label}
                        </span>
                      </div>

                      <div className="flex items-center text-zinc-300">{row.orderCount}</div>

                      <div className="flex items-center justify-end font-semibold text-white">{formatMoney(row.totalSpent)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-white/[0.08] bg-[#11131a] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-2 text-sm text-zinc-400">{helper}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-zinc-200">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
