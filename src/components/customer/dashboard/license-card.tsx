"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { CustomerLicense } from "@/types/customer-dashboard";
import { cn } from "@/lib/utils";

type LicenseCardProps = {
  license: CustomerLicense;
  className?: string;
};

function expiryLabel(expiresAt: string | null) {
  if (!expiresAt) return "No expiry";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toLocaleDateString();
}

function statusBadge(status: CustomerLicense["status"]) {
  if (status === "ACTIVE") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "EXPIRED") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-red-500/25 bg-red-500/10 text-red-300";
}

export function LicenseCard({ license, className }: LicenseCardProps) {
  const [copied, setCopied] = useState(false);

  const maskedKey = useMemo(() => {
    if (license.licenseKey.length <= 10) return license.licenseKey;
    return `${license.licenseKey.slice(0, 6)}...${license.licenseKey.slice(-4)}`;
  }, [license.licenseKey]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(license.licenseKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-3",
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-zinc-100">{license.productName}</h4>
          <p className="mt-1 text-xs text-zinc-500">Expires: {expiryLabel(license.expiresAt)}</p>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusBadge(license.status))}>
          {license.status}
        </span>
      </div>

      <div className="mb-3 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-2 text-xs text-zinc-400">{maskedKey}</div>

      <div className="flex items-center gap-2">
        <a
          href={license.downloadUrl || "#"}
          target={license.downloadUrl ? "_blank" : undefined}
          rel={license.downloadUrl ? "noreferrer" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium",
            license.downloadUrl
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
              : "cursor-not-allowed border-white/[0.08] bg-white/[0.03] text-zinc-500"
          )}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-300/30 bg-violet-500/10 px-2.5 text-xs font-medium text-violet-100 hover:bg-violet-500/15"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>
    </article>
  );
}

