"use client";

import { useState } from "react";
import { ReferralOverview } from "@/types/customer-dashboard";

type Props = {
  referral: ReferralOverview | null;
};

export function ReferralCard({ referral }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referral?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(referral.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(36,37,41,0.86),rgba(21,22,25,0.95))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Invite & Earn</h2>
          <p className="mt-1 text-xs text-zinc-500">Share your link and earn balance rewards for new users.</p>
        </div>
        <span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
          Earned ${Number(referral?.totalRewards || 0).toFixed(2)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300">
          {referral?.inviteLink || "Referral link is being prepared..."}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <p className="text-zinc-500">Referrals</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{referral?.totalReferrals ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <p className="text-zinc-500">Active Buyers</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{referral?.successfulReferrals ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 col-span-2 md:col-span-1">
          <p className="text-zinc-500">Invite Code</p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{referral?.inviteCode || "-"}</p>
        </div>
      </div>
    </section>
  );
}

