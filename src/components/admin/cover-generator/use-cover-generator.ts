"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUICK_PRESETS } from "./presets";
import type {
  BackgroundPattern,
  CharacterSide,
  CoverGeneratorState,
  CoverGeneratorTab,
  CoverTemplateId,
  ExportFormat,
  PostType,
  QuickPreset,
  TitleSizeMode,
} from "./types";

const INITIAL_STATE: CoverGeneratorState = {
  activeTab: "template",
  templateId: "hero-character",
  postType: "Setup Guide",
  content: {
    productName: "Byteon NewEra",
    game: "VALORANT",
    statusBadge: "UNDETECTED",
    year: String(new Date().getFullYear()),
    subtitle: "Installation · Configuration · Troubleshooting",
    tagInput: "",
    tags: ["PRO"],
    titleSizeMode: "auto",
    customTitleSize: 112,
  },
  assets: {
    characterImageUrl: null,
    backgroundImageUrl: null,
    customLogoUrl: null,
    characterSide: "right",
    characterScale: 1.8,
    characterOffsetX: 196,
    characterOffsetY: 4,
    characterOpacity: 1,
    glow: true,
    shadow: true,
    mirror: false,
  },
  style: {
    accentColor: "#8B1A2B",
    customHex: "#8B1A2B",
    backgroundPattern: "Grid",
    showCornerDecorations: true,
    showScanLines: true,
  },
  export: {
    width: 1920,
    height: 1080,
    format: "png",
    zoom: 56,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useCoverGeneratorState() {
  const [state, setState] = useState<CoverGeneratorState>(INITIAL_STATE);
  const createdObjectUrls = useRef<string[]>([]);

  const setActiveTab = useCallback((tab: CoverGeneratorTab) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const setTemplate = useCallback((templateId: CoverTemplateId) => {
    setState((prev) => ({ ...prev, templateId }));
  }, []);

  const setPostType = useCallback((postType: PostType) => {
    setState((prev) => ({ ...prev, postType }));
  }, []);

  const setContentField = useCallback(
    <K extends keyof CoverGeneratorState["content"]>(field: K, value: CoverGeneratorState["content"][K]) => {
      setState((prev) => ({ ...prev, content: { ...prev.content, [field]: value } }));
    },
    []
  );

  const setAssetsField = useCallback(
    <K extends keyof CoverGeneratorState["assets"]>(field: K, value: CoverGeneratorState["assets"][K]) => {
      setState((prev) => ({ ...prev, assets: { ...prev.assets, [field]: value } }));
    },
    []
  );

  const setStyleField = useCallback(
    <K extends keyof CoverGeneratorState["style"]>(field: K, value: CoverGeneratorState["style"][K]) => {
      setState((prev) => ({ ...prev, style: { ...prev.style, [field]: value } }));
    },
    []
  );

  const setExportFormat = useCallback((format: ExportFormat) => {
    setState((prev) => ({ ...prev, export: { ...prev.export, format } }));
  }, []);

  const setExportSize = useCallback((width: number, height: number) => {
    setState((prev) => ({ ...prev, export: { ...prev.export, width, height } }));
  }, []);

  const updateCharacterPosition = useCallback(
    (field: "characterScale" | "characterOffsetX" | "characterOffsetY" | "characterOpacity", value: number) => {
      setState((prev) => ({
        ...prev,
        assets: {
          ...prev.assets,
          [field]:
            field === "characterScale"
              ? clamp(value, 0.5, 3)
              : field === "characterOpacity"
                ? clamp(value, 0, 1)
                : clamp(value, -600, 600),
        },
      }));
    },
    []
  );

  const resetPosition = useCallback(() => {
    setState((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        characterSide: "right",
        characterScale: INITIAL_STATE.assets.characterScale,
        characterOffsetX: INITIAL_STATE.assets.characterOffsetX,
        characterOffsetY: INITIAL_STATE.assets.characterOffsetY,
        characterOpacity: INITIAL_STATE.assets.characterOpacity,
        glow: true,
        shadow: true,
        mirror: false,
      },
    }));
  }, []);

  const addTag = useCallback(() => {
    setState((prev) => {
      const nextTag = prev.content.tagInput.trim().toUpperCase();
      if (!nextTag || prev.content.tags.length >= 4 || prev.content.tags.includes(nextTag)) return prev;
      return {
        ...prev,
        content: {
          ...prev.content,
          tags: [...prev.content.tags, nextTag],
          tagInput: "",
        },
      };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setState((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        tags: prev.content.tags.filter((value) => value !== tag),
      },
    }));
  }, []);

  const applyQuickPreset = useCallback((preset: QuickPreset) => {
    setState((prev) => ({
      ...prev,
      templateId: preset.templateId ?? prev.templateId,
      content: {
        ...prev.content,
        productName: preset.productName,
        game: preset.game,
        subtitle: preset.subtitle,
        tags: preset.tags.slice(0, 4),
        statusBadge: preset.statusBadge,
      },
    }));
  }, []);

  const registerObjectUrl = useCallback((url: string) => {
    createdObjectUrls.current.push(url);
  }, []);

  const setUploadedAsset = useCallback(
    (type: "characterImageUrl" | "backgroundImageUrl" | "customLogoUrl", file: File | null) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      registerObjectUrl(url);
      setAssetsField(type, url);
    },
    [registerObjectUrl, setAssetsField]
  );

  const removeAsset = useCallback(
    (type: "characterImageUrl" | "backgroundImageUrl" | "customLogoUrl") => {
      const current = state.assets[type];
      if (current && current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
        createdObjectUrls.current = createdObjectUrls.current.filter((entry) => entry !== current);
      }
      setAssetsField(type, null);
    },
    [setAssetsField, state.assets]
  );

  const resetAll = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setAccentColor = useCallback((color: string) => {
    setState((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        accentColor: color,
        customHex: color,
      },
    }));
  }, []);

  const applyCustomHex = useCallback(() => {
    setState((prev) => {
      const candidate = prev.style.customHex.trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(candidate)) return prev;
      return {
        ...prev,
        style: {
          ...prev.style,
          accentColor: candidate.toUpperCase(),
          customHex: candidate.toUpperCase(),
        },
      };
    });
  }, []);

  const setPattern = useCallback((pattern: BackgroundPattern) => {
    setStyleField("backgroundPattern", pattern);
  }, [setStyleField]);

  const setCharacterSide = useCallback((side: CharacterSide) => {
    setAssetsField("characterSide", side);
  }, [setAssetsField]);

  useEffect(() => {
    return () => {
      for (const objectUrl of createdObjectUrls.current) {
        URL.revokeObjectURL(objectUrl);
      }
      createdObjectUrls.current = [];
    };
  }, []);

  const quickPresets = useMemo(() => QUICK_PRESETS, []);

  return {
    state,
    quickPresets,
    actions: {
      setActiveTab,
      setTemplate,
      setPostType,
      setContentField,
      setAssetsField,
      setStyleField,
      setExportFormat,
      setExportSize,
      updateCharacterPosition,
      resetPosition,
      addTag,
      removeTag,
      applyQuickPreset,
      setUploadedAsset,
      removeAsset,
      resetAll,
      setAccentColor,
      applyCustomHex,
      setPattern,
      setCharacterSide,
    },
  };
}
