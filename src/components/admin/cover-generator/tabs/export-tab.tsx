"use client";

import { Copy, Download, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverGeneratorState, ExportFormat } from "../types";

interface ExportTabProps {
  exportState: CoverGeneratorState["export"];
  onExportSizeChange: (width: number, height: number) => void;
  onFormatChange: (format: ExportFormat) => void;
  onDownload: () => void;
  onCopyImage: () => void;
  onReset: () => void;
}

export function ExportTab({ exportState, onExportSizeChange, onFormatChange, onDownload, onCopyImage, onReset }: ExportTabProps) {
  const sizeLabel = `${exportState.width}x${exportState.height}`;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Canvas Size</p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onExportSizeChange(1920, 1080)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
              exportState.width === 1920 ? "border-violet-300/45 bg-violet-500/12 text-violet-100" : "border-white/[0.09] bg-[#111218] text-zinc-300"
            )}
          >
            <span>Blog Cover · 1920x1080</span>
            <span className="text-[11px] text-zinc-500">16:9</span>
          </button>
          <button
            type="button"
            onClick={() => onExportSizeChange(1200, 630)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
              exportState.width === 1200 ? "border-violet-300/45 bg-violet-500/12 text-violet-100" : "border-white/[0.09] bg-[#111218] text-zinc-300"
            )}
          >
            <span>Social / OG · 1200x630</span>
            <span className="text-[11px] text-zinc-500">OG</span>
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">File Format</p>
        <div className="grid grid-cols-2 gap-2">
          {(["png", "jpg"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => onFormatChange(format)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold uppercase transition",
                exportState.format === format
                  ? "border-violet-300/45 bg-violet-500/12 text-violet-100"
                  : "border-white/[0.09] bg-[#111218] text-zinc-300"
              )}
            >
              {format}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">PNG = lossless · JPG = smaller file size.</p>
      </section>

      <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-violet-300/45 bg-violet-500/20 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/28"
        >
          <Download className="mr-2 h-4 w-4" />
          Download {exportState.format.toUpperCase()} · {sizeLabel}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCopyImage}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.09] bg-[#111218] text-xs font-semibold text-zinc-200 hover:border-white/[0.2]"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy Image
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.09] bg-[#111218] text-xs font-semibold text-zinc-300 hover:border-white/[0.2]"
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </section>
    </div>
  );
}
