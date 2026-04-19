"use client";

import { ImagePlus, Palette, Settings2, Sparkles, Upload, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverGeneratorTab } from "./types";

const TAB_ITEMS: Array<{ id: CoverGeneratorTab; label: string; icon: LucideIcon }> = [
  { id: "template", label: "Template", icon: Sparkles },
  { id: "content", label: "Content", icon: Settings2 },
  { id: "assets", label: "Assets", icon: Upload },
  { id: "style", label: "Style", icon: Palette },
  { id: "export", label: "Export", icon: ImagePlus },
];

interface CoverGeneratorTabsProps {
  activeTab: CoverGeneratorTab;
  onChange: (tab: CoverGeneratorTab) => void;
}

export function CoverGeneratorTabs({ activeTab, onChange }: CoverGeneratorTabsProps) {
  return (
    <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
      {TAB_ITEMS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition",
              isActive
                ? "border border-violet-300/40 bg-violet-500/18 text-violet-100"
                : "border border-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
