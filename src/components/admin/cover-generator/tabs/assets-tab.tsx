"use client";

import { RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverGeneratorState } from "../types";

interface AssetsTabProps {
  assets: CoverGeneratorState["assets"];
  onAssetFieldChange: <K extends keyof CoverGeneratorState["assets"]>(
    field: K,
    value: CoverGeneratorState["assets"][K]
  ) => void;
  onUploadAsset: (type: "characterImageUrl" | "backgroundImageUrl" | "customLogoUrl", file: File | null) => void;
  onRemoveAsset: (type: "characterImageUrl" | "backgroundImageUrl" | "customLogoUrl") => void;
  onCharacterPositionChange: (field: "characterScale" | "characterOffsetX" | "characterOffsetY" | "characterOpacity", value: number) => void;
  onResetPosition: () => void;
}

interface FileDropFieldProps {
  title: string;
  subtitle: string;
  currentUrl: string | null;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}

function FileDropField({ title, subtitle, currentUrl, onFileChange, onRemove }: FileDropFieldProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{title}</div>
      <p className="mb-3 text-[11px] text-zinc-500">{subtitle}</p>
      {currentUrl ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-white/[0.09]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt={title} className="h-24 w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/[0.1] bg-[#111218] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/[0.24]">
              Replace
              <input type="file" accept="image/*" className="hidden" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
            </label>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-lg border border-violet-300/40 bg-violet-500/12 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/18"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.16] bg-[#101116] px-4 py-7 text-center transition hover:border-violet-300/36 hover:bg-violet-500/[0.06]">
          <UploadCloud className="mb-2 h-6 w-6 text-zinc-400 group-hover:text-violet-200" />
          <span className="text-sm font-semibold text-zinc-100">Upload image</span>
          <span className="mt-1 text-[11px] text-zinc-500">Click to select</span>
          <input type="file" accept="image/*" className="hidden" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
        </label>
      )}
    </div>
  );
}

export function AssetsTab({
  assets,
  onAssetFieldChange,
  onUploadAsset,
  onRemoveAsset,
  onCharacterPositionChange,
  onResetPosition,
}: AssetsTabProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Character Render</p>
        <FileDropField
          title="Character Render"
          subtitle="Transparent PNG recommended."
          currentUrl={assets.characterImageUrl}
          onFileChange={(file) => onUploadAsset("characterImageUrl", file)}
          onRemove={() => onRemoveAsset("characterImageUrl")}
        />
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Side</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onAssetFieldChange("characterSide", "left")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  assets.characterSide === "left"
                    ? "border-violet-300/40 bg-violet-500/12 text-violet-100"
                    : "border-white/[0.09] bg-[#111218] text-zinc-300"
                )}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => onAssetFieldChange("characterSide", "right")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                  assets.characterSide === "right"
                    ? "border-violet-300/40 bg-violet-500/12 text-violet-100"
                    : "border-white/[0.09] bg-[#111218] text-zinc-300"
                )}
              >
                Right
              </button>
            </div>
          </div>

          {[
            { key: "characterScale", label: "Scale", min: 0.5, max: 3, step: 0.01, display: `${assets.characterScale.toFixed(2)}x` },
            { key: "characterOffsetX", label: "Offset X", min: -500, max: 500, step: 1, display: `${Math.round(assets.characterOffsetX)}px` },
            { key: "characterOffsetY", label: "Offset Y", min: -500, max: 500, step: 1, display: `${Math.round(assets.characterOffsetY)}px` },
            { key: "characterOpacity", label: "Opacity", min: 0, max: 1, step: 0.01, display: `${Math.round(assets.characterOpacity * 100)}%` },
          ].map((slider) => (
            <div key={slider.key}>
              <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                <span>{slider.label}</span>
                <span>{slider.display}</span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={assets[slider.key as keyof CoverGeneratorState["assets"]] as number}
                onChange={(event) =>
                  onCharacterPositionChange(
                    slider.key as "characterScale" | "characterOffsetX" | "characterOffsetY" | "characterOpacity",
                    Number(event.target.value)
                  )
                }
                className="w-full accent-violet-500"
              />
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onAssetFieldChange("glow", !assets.glow)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-semibold",
                assets.glow ? "border-violet-300/40 bg-violet-500/12 text-violet-100" : "border-white/[0.09] bg-[#111218] text-zinc-300"
              )}
            >
              Glow
            </button>
            <button
              type="button"
              onClick={() => onAssetFieldChange("shadow", !assets.shadow)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-semibold",
                assets.shadow ? "border-violet-300/40 bg-violet-500/12 text-violet-100" : "border-white/[0.09] bg-[#111218] text-zinc-300"
              )}
            >
              Shadow
            </button>
            <button
              type="button"
              onClick={() => onAssetFieldChange("mirror", !assets.mirror)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-semibold",
                assets.mirror ? "border-violet-300/40 bg-violet-500/12 text-violet-100" : "border-white/[0.09] bg-[#111218] text-zinc-300"
              )}
            >
              Mirror
            </button>
          </div>

          <button
            type="button"
            onClick={onResetPosition}
            className="inline-flex w-full items-center justify-center rounded-lg border border-white/[0.1] bg-[#111218] py-2 text-xs font-semibold text-zinc-300 hover:border-white/[0.2]"
          >
            <RefreshCcw className="mr-1 h-3.5 w-3.5" />
            Reset Position
          </button>
        </div>
      </section>

      <FileDropField
        title="Background Image"
        subtitle="Wide landscape image suggested."
        currentUrl={assets.backgroundImageUrl}
        onFileChange={(file) => onUploadAsset("backgroundImageUrl", file)}
        onRemove={() => onRemoveAsset("backgroundImageUrl")}
      />

      <FileDropField
        title="Custom Logo"
        subtitle="Optional custom brand/logo for preview."
        currentUrl={assets.customLogoUrl}
        onFileChange={(file) => onUploadAsset("customLogoUrl", file)}
        onRemove={() => onRemoveAsset("customLogoUrl")}
      />
    </div>
  );
}
