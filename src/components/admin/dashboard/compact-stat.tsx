import { cn } from "@/lib/utils";

export function CompactStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "yellow" | "purple";
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-semibold leading-none text-zinc-100",
          tone === "green" && "text-emerald-300",
          tone === "yellow" && "text-amber-300",
          tone === "purple" && "text-violet-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}

