import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  detail,
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "green" | "yellow" | "red" | "purple";
  detail?: string;
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "admin-card admin-card-interactive min-h-[104px] w-full rounded-2xl p-3 text-left",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.08]",
            tone === "green" && "bg-emerald-500/10 text-emerald-300",
            tone === "yellow" && "bg-amber-500/10 text-amber-300",
            tone === "red" && "bg-red-500/10 text-red-300",
            tone === "purple" && "bg-violet-500/10 text-violet-300",
            tone === "default" && "bg-white/[0.04] text-zinc-300"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none text-zinc-100">{value}</p>
      <div className="mt-2 flex min-h-[18px] items-center justify-between gap-2">
        {detail ? <span className="truncate text-[11px] text-zinc-500">{detail}</span> : <span />}
        {trend ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
              tone === "green" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
              tone === "yellow" && "border-amber-500/20 bg-amber-500/10 text-amber-300",
              tone === "red" && "border-red-500/20 bg-red-500/10 text-red-300",
              tone === "purple" && "border-violet-500/20 bg-violet-500/10 text-violet-300",
              tone === "default" && "border-white/[0.08] bg-white/[0.03] text-zinc-300"
            )}
          >
            {trend}
          </span>
        ) : null}
      </div>
    </button>
  );
}
