"use client";

import { useMemo, useRef } from "react";
import { ImagePlus } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { useToast } from "@/components/ui/toast";
import { CoverGeneratorTabs } from "./cover-generator-tabs";
import { CoverGeneratorPreview, type CoverPreviewHandle } from "./cover-generator-preview";
import { useCoverGeneratorState } from "./use-cover-generator";
import { TemplateTab } from "./tabs/template-tab";
import { ContentTab } from "./tabs/content-tab";
import { AssetsTab } from "./tabs/assets-tab";
import { StyleTab } from "./tabs/style-tab";
import { ExportTab } from "./tabs/export-tab";

export function CoverGeneratorPage() {
  const { addToast } = useToast();
  const { state, quickPresets, actions } = useCoverGeneratorState();
  const previewRef = useRef<CoverPreviewHandle>(null);

  const activePanel = useMemo(() => {
    switch (state.activeTab) {
      case "template":
        return (
          <TemplateTab
            templateId={state.templateId}
            postType={state.postType}
            quickPresets={quickPresets}
            onTemplateChange={actions.setTemplate}
            onPostTypeChange={actions.setPostType}
            onQuickPresetApply={actions.applyQuickPreset}
          />
        );
      case "content":
        return (
          <ContentTab
            content={state.content}
            onContentFieldChange={actions.setContentField}
            onAddTag={actions.addTag}
            onRemoveTag={actions.removeTag}
          />
        );
      case "assets":
        return (
          <AssetsTab
            assets={state.assets}
            onAssetFieldChange={actions.setAssetsField}
            onUploadAsset={actions.setUploadedAsset}
            onRemoveAsset={actions.removeAsset}
            onCharacterPositionChange={actions.updateCharacterPosition}
            onResetPosition={actions.resetPosition}
          />
        );
      case "style":
        return (
          <StyleTab
            style={state.style}
            onStyleFieldChange={actions.setStyleField}
            onAccentChange={actions.setAccentColor}
            onApplyCustomHex={actions.applyCustomHex}
            onPatternChange={actions.setPattern}
          />
        );
      case "export":
        return (
          <ExportTab
            exportState={state.export}
            onExportSizeChange={actions.setExportSize}
            onFormatChange={actions.setExportFormat}
            onDownload={async () => {
              await previewRef.current?.download();
              addToast({ type: "success", title: "Export ready", description: "Cover downloaded successfully." });
            }}
            onCopyImage={async () => {
              try {
                await previewRef.current?.copyToClipboard();
                addToast({ type: "success", title: "Copied", description: "Image copied to clipboard." });
              } catch {
                addToast({ type: "error", title: "Copy failed", description: "Clipboard permissions blocked the operation." });
              }
            }}
            onReset={actions.resetAll}
          />
        );
      default:
        return null;
    }
  }, [actions, addToast, quickPresets, state]);

  return (
    <div className="space-y-4">
      <Topbar
        title="Cover Generator"
        description="Generate studio-quality blog/post covers with template presets, uploaded assets, style controls, and export actions."
      >
        <span className="inline-flex items-center gap-1 rounded-md border border-red-400/40 bg-red-500/14 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-100">
          <ImagePlus className="h-3 w-3" />
          Pro Tool
        </span>
      </Topbar>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <CoverGeneratorTabs activeTab={state.activeTab} onChange={actions.setActiveTab} />
          <div className="max-h-[calc(100vh-230px)] overflow-auto pr-1">{activePanel}</div>
        </aside>

        <div className="min-w-0">
          <CoverGeneratorPreview ref={previewRef} state={state} />
        </div>
      </div>
    </div>
  );
}
