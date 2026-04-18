import { AlertTriangle } from "lucide-react";
import { ReactNode } from "react";

export function AlertRow({
  title,
  message,
  time,
  action,
}: {
  title: string;
  message: string;
  time: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-red-100">{title}</p>
        <p className="truncate text-xs text-red-200/80">{message}</p>
      </div>
      <span className="shrink-0 text-[11px] text-red-200/65">{time}</span>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

