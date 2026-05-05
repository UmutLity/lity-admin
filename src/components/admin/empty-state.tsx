import type { ReactNode } from "react";
import { AlertTriangle, LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  tone?: "empty" | "error";
}

export function EmptyState({ icon: Icon = Inbox, title, description, children, className, tone = "empty" }: EmptyStateProps) {
  const isError = tone === "error";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-[var(--radius-xl)] border px-5 py-14 text-center",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.012))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        isError ? "border-red-400/18" : "border-white/[0.08]",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isError
            ? "bg-[radial-gradient(circle_at_50%_0%,rgba(248,113,113,0.13),transparent_42%)]"
            : "bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.12),transparent_42%)]"
        )}
      />
      <div
        className={cn(
          "relative mb-4 rounded-2xl border p-4 shadow-[0_14px_30px_rgba(3,6,12,0.24)]",
          isError ? "border-red-400/20 bg-red-500/10" : "border-white/[0.09] bg-white/[0.035]"
        )}
      >
        <Icon className={cn("h-8 w-8", isError ? "text-red-300" : "text-zinc-300")} />
      </div>
      <h3 className="relative mb-1 text-lg font-semibold text-white">{title}</h3>
      {description && <p className="relative mb-4 max-w-sm text-sm leading-6 text-zinc-400">{description}</p>}
      {children && <div className="relative flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState(props: Omit<EmptyStateProps, "tone" | "icon"> & { icon?: LucideIcon }) {
  const { icon, ...rest } = props;
  return <EmptyState icon={icon || AlertTriangle} tone="error" {...rest} />;
}
