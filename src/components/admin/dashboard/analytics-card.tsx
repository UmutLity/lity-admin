"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CompactStat } from "./compact-stat";

type TabKey = "today" | "week" | "month";

interface FinancialSlice {
  salesCount: number;
  revenue: number;
  deposits: number;
  boxRevenue: number;
  users: number;
}

export function AnalyticsCard({
  today,
  week,
  month,
}: {
  today: FinancialSlice;
  week: FinancialSlice;
  month: FinancialSlice;
}) {
  const [tab, setTab] = useState<TabKey>("today");

  const active = useMemo(() => {
    if (tab === "today") return today;
    if (tab === "week") return week;
    return month;
  }, [tab, today, week, month]);

  return (
    <div className="admin-card rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">Financial Overview</h3>
          <p className="mt-1 text-xs text-zinc-500">Compact revenue and payment analytics</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {(["today", "week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium capitalize",
                tab === item ? "bg-white/[0.1] text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CompactStat label="Revenue" value={`$${active.revenue.toFixed(2)}`} tone="green" />
        <CompactStat label="Deposits" value={`$${active.deposits.toFixed(2)}`} tone="yellow" />
        <CompactStat label="Product Sales" value={active.salesCount} />
        <CompactStat label="Mystery Box" value={`$${active.boxRevenue.toFixed(2)}`} tone="purple" />
        <CompactStat label="New Users" value={active.users} />
      </div>
    </div>
  );
}

