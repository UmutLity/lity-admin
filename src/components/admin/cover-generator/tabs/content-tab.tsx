"use client";

import { Plus, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CoverGeneratorState } from "../types";

interface ContentTabProps {
  content: CoverGeneratorState["content"];
  onContentFieldChange: <K extends keyof CoverGeneratorState["content"]>(
    field: K,
    value: CoverGeneratorState["content"][K]
  ) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

export function ContentTab({ content, onContentFieldChange, onAddTag, onRemoveTag }: ContentTabProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Product Name</p>
        <Input
          value={content.productName}
          onChange={(event) => onContentFieldChange("productName", event.target.value)}
          placeholder="Byteon NewEra"
          className="h-10 border-white/[0.09] bg-black/35"
        />
        <p className="mt-2 text-[11px] text-zinc-500">Auto-shrinks on long product names.</p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Meta</p>
        <div className="space-y-2">
          <Input value={content.game} onChange={(event) => onContentFieldChange("game", event.target.value)} placeholder="VALORANT" className="h-10 border-white/[0.09] bg-black/35" />
          <Input
            value={content.statusBadge}
            onChange={(event) => onContentFieldChange("statusBadge", event.target.value)}
            placeholder="UNDETECTED"
            className="h-10 border-white/[0.09] bg-black/35"
          />
          <Input value={content.year} onChange={(event) => onContentFieldChange("year", event.target.value)} placeholder="2026" className="h-10 border-white/[0.09] bg-black/35" />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Subtitle</p>
        <Input
          value={content.subtitle}
          onChange={(event) => onContentFieldChange("subtitle", event.target.value)}
          placeholder="Installation · Configuration · Troubleshooting"
          className="h-10 border-white/[0.09] bg-black/35"
        />
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Tag Chips</p>
        <div className="flex gap-2">
          <Input
            value={content.tagInput}
            onChange={(event) => onContentFieldChange("tagInput", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddTag();
              }
            }}
            placeholder="Type tag + Enter"
            className="h-10 border-white/[0.09] bg-black/35"
          />
          <button
            type="button"
            onClick={onAddTag}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-400/45 bg-red-500/15 text-red-100 transition hover:bg-red-500/22"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {content.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="rounded-md border border-red-400/35 bg-red-500/14 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-100"
            >
              {tag} ×
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Title Size Override</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onContentFieldChange("titleSizeMode", "auto")}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              content.titleSizeMode === "auto"
                ? "border-red-400/45 bg-red-500/15 text-red-100"
                : "border-white/[0.09] bg-[#111218] text-zinc-300 hover:border-white/[0.2]"
            )}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => onContentFieldChange("titleSizeMode", "custom")}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              content.titleSizeMode === "custom"
                ? "border-red-400/45 bg-red-500/15 text-red-100"
                : "border-white/[0.09] bg-[#111218] text-zinc-300 hover:border-white/[0.2]"
            )}
          >
            Custom
          </button>
        </div>
        {content.titleSizeMode === "custom" ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1"><Type className="h-3 w-3" />Size</span>
              <span>{Math.round(content.customTitleSize)} px</span>
            </div>
            <input
              type="range"
              min={68}
              max={160}
              step={1}
              value={content.customTitleSize}
              onChange={(event) => onContentFieldChange("customTitleSize", Number(event.target.value))}
              className="w-full accent-red-500"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
