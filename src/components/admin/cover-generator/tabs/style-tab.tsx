"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ACCENT_PRESETS, BACKGROUND_PATTERNS } from "../presets";
import { cn } from "@/lib/utils";
import type { CoverGeneratorState } from "../types";

interface StyleTabProps {
  style: CoverGeneratorState["style"];
  onStyleFieldChange: <K extends keyof CoverGeneratorState["style"]>(
    field: K,
    value: CoverGeneratorState["style"][K]
  ) => void;
  onAccentChange: (color: string) => void;
  onApplyCustomHex: () => void;
  onPatternChange: (pattern: CoverGeneratorState["style"]["backgroundPattern"]) => void;
}

export function StyleTab({ style, onStyleFieldChange, onAccentChange, onApplyCustomHex, onPatternChange }: StyleTabProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Accent Color</p>
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onAccentChange(color)}
              className={cn(
                "h-12 rounded-lg border transition",
                style.accentColor.toUpperCase() === color.toUpperCase() ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)]" : "border-white/[0.12]"
              )}
              style={{ background: `linear-gradient(145deg, ${color}, rgba(14,14,19,0.72))` }}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={style.customHex}
            onChange={(event) => onStyleFieldChange("customHex", event.target.value)}
            placeholder="#8B1A2B"
            className="h-10 border-white/[0.09] bg-black/35 font-mono text-sm"
          />
          <button
            type="button"
            onClick={onApplyCustomHex}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-red-400/45 bg-red-500/15 px-4 text-sm font-semibold text-red-100 hover:bg-red-500/22"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Background Pattern</p>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUND_PATTERNS.map((pattern) => (
            <button
              key={pattern}
              type="button"
              onClick={() => onPatternChange(pattern)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                style.backgroundPattern === pattern
                  ? "border-red-400/45 bg-red-500/12 text-red-100"
                  : "border-white/[0.08] bg-[#111218] text-zinc-300 hover:border-white/[0.2]"
              )}
            >
              {pattern}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Visual Effects</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Corner decorations</span>
            <Switch checked={style.showCornerDecorations} onCheckedChange={(checked) => onStyleFieldChange("showCornerDecorations", checked)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Scan lines overlay</span>
            <Switch checked={style.showScanLines} onCheckedChange={(checked) => onStyleFieldChange("showScanLines", checked)} />
          </label>
        </div>
      </section>
    </div>
  );
}
