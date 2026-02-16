import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, RefreshCw, Wrench, XCircle } from "lucide-react";

type ProductStatus = "UNDETECTED" | "DETECTED" | "UPDATING" | "MAINTENANCE" | "DISCONTINUED";

const statusConfig: Record<ProductStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowClass: string;
  icon: React.ReactNode;
  pulse?: boolean;
}> = {
  UNDETECTED: {
    label: "Undetected",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    glowClass: "glow-emerald",
    icon: <Shield className="h-3 w-3" />,
  },
  DETECTED: {
    label: "Detected",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    glowClass: "glow-red",
    icon: <ShieldAlert className="h-3 w-3" />,
    pulse: true,
  },
  UPDATING: {
    label: "Updating",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    glowClass: "glow-amber",
    icon: <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />,
  },
  MAINTENANCE: {
    label: "Maintenance",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    glowClass: "glow-blue",
    icon: <Wrench className="h-3 w-3" />,
  },
  DISCONTINUED: {
    label: "Discontinued",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/20",
    glowClass: "",
    icon: <XCircle className="h-3 w-3" />,
  },
};

interface StatusBadgeProps {
  status: ProductStatus;
  showIcon?: boolean;
  glow?: boolean;
  className?: string;
}

export function StatusBadge({ status, showIcon = true, glow = false, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.UNDETECTED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200",
        config.color,
        config.bgColor,
        config.borderColor,
        glow && config.glowClass,
        config.pulse && "animate-pulse",
        className
      )}
    >
      {showIcon && (
        <span className="flex items-center">
          {config.icon}
        </span>
      )}
      {config.label}
    </span>
  );
}
