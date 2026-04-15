import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-4 py-14 text-center", className)}>
      <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_14px_30px_rgba(3,6,12,0.2)]">
        <Icon className="h-8 w-8 text-zinc-300" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mb-4 max-w-sm text-sm text-zinc-400">{description}</p>}
      {children}
    </div>
  );
}
