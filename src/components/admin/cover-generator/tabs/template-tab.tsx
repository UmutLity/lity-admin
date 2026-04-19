"use client";

import { Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { POST_TYPES, TEMPLATE_PRESETS } from "../presets";
import type { CoverTemplateId, PostType, QuickPreset } from "../types";

interface TemplateTabProps {
  templateId: CoverTemplateId;
  postType: PostType;
  quickPresets: QuickPreset[];
  onTemplateChange: (templateId: CoverTemplateId) => void;
  onPostTypeChange: (postType: PostType) => void;
  onQuickPresetApply: (preset: QuickPreset) => void;
}

export function TemplateTab({
  templateId,
  postType,
  quickPresets,
  onTemplateChange,
  onPostTypeChange,
  onQuickPresetApply,
}: TemplateTabProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Template Design</p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_PRESETS.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onTemplateChange(template.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition",
                templateId === template.id
                  ? "border-red-400/45 bg-red-500/12 text-red-100"
                  : "border-white/[0.08] bg-[#111218] text-zinc-200 hover:border-white/[0.2]"
              )}
            >
              <div className="text-sm font-semibold">{template.name}</div>
              <div className="mt-1 text-[11px] leading-4 text-zinc-500">{template.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Post Type</p>
        <div className="grid grid-cols-2 gap-2">
          {POST_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPostTypeChange(item)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                postType === item
                  ? "border-red-400/45 bg-red-500/12 text-red-100"
                  : "border-white/[0.08] bg-[#111218] text-zinc-300 hover:border-white/[0.2]"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Quick Presets</p>
        <div className="space-y-2">
          {quickPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onQuickPresetApply(preset)}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] bg-[#111218] px-3 py-2 text-left transition hover:border-red-400/35 hover:bg-red-500/[0.08]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/15 text-red-100">
                <Shield className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-100">{preset.productName}</span>
                <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">{preset.game}</span>
              </span>
              <Sparkles className="ml-auto h-3.5 w-3.5 text-zinc-500" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
