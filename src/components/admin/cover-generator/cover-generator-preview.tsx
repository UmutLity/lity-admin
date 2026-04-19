"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { CoverGeneratorState, CoverTemplateId } from "./types";

interface PreviewProps {
  state: CoverGeneratorState;
}

export interface CoverPreviewHandle {
  download: () => Promise<void>;
  copyToClipboard: () => Promise<void>;
}

const templateStrength: Record<CoverTemplateId, { vignette: number; glow: number; titleYOffset: number }> = {
  "bold-shield": { vignette: 0.24, glow: 0.42, titleYOffset: 0 },
  "minimal-clean": { vignette: 0.18, glow: 0.2, titleYOffset: -4 },
  "cyber-matrix": { vignette: 0.26, glow: 0.32, titleYOffset: 2 },
  "neon-glow": { vignette: 0.24, glow: 0.48, titleYOffset: 0 },
  "hero-character": { vignette: 0.28, glow: 0.5, titleYOffset: 0 },
};

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function hexWithOpacity(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, pattern: CoverGeneratorState["style"]["backgroundPattern"], color: string) {
  const tint = hexWithOpacity(color, 0.1);
  ctx.save();
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  ctx.lineWidth = 1;

  if (pattern === "Dots") {
    for (let y = 0; y < height; y += 28) {
      for (let x = 0; x < width; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (pattern === "Grid") {
    for (let x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  if (pattern === "Hexagon") {
    const size = 24;
    const h = Math.sin(Math.PI / 3) * size;
    for (let y = -h; y < height + h; y += h * 2) {
      for (let x = -size; x < width + size; x += size * 3) {
        const offset = (Math.round(y / (h * 2)) % 2) * (size * 1.5);
        const startX = x + offset;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + size, y);
        ctx.lineTo(startX + size * 1.5, y + h);
        ctx.lineTo(startX + size, y + h * 2);
        ctx.lineTo(startX, y + h * 2);
        ctx.lineTo(startX - size * 0.5, y + h);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  if (pattern === "Diagonal") {
    for (let i = -height; i < width + height; i += 26) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - height, height);
      ctx.stroke();
    }
  }

  if (pattern === "Circuit") {
    for (let y = 48; y < height; y += 80) {
      const startX = 90 + ((y / 80) % 2) * 46;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + 220, y);
      ctx.lineTo(startX + 220, y + 24);
      ctx.lineTo(startX + 360, y + 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(startX + 220, y + 24, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export const CoverGeneratorPreview = forwardRef<CoverPreviewHandle, PreviewProps>(function CoverGeneratorPreview({ state }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const sizeLabel = `${state.export.width}x${state.export.height}`;
  const metaTitle = useMemo(() => state.templateId.replace("-", " "), [state.templateId]);

  useImperativeHandle(ref, () => ({
    async download() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const mime = state.export.format === "jpg" ? "image/jpeg" : "image/png";
      const ext = state.export.format === "jpg" ? "jpg" : "png";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.95));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cover-${state.content.productName.replace(/\s+/g, "-").toLowerCase() || "export"}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    },
    async copyToClipboard() {
      const canvas = canvasRef.current;
      if (!canvas || !navigator.clipboard || typeof ClipboardItem === "undefined") return;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = state.export.width;
      const height = state.export.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;
      const config = templateStrength[state.templateId];

      ctx.clearRect(0, 0, width, height);

      const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
      backgroundGradient.addColorStop(0, "#07090f");
      backgroundGradient.addColorStop(0.45, "#121018");
      backgroundGradient.addColorStop(1, hexWithOpacity(state.style.accentColor, 0.46));
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      if (state.assets.backgroundImageUrl) {
        try {
          const image = await loadImage(state.assets.backgroundImageUrl);
          if (cancelled) return;
          ctx.globalAlpha = 0.35;
          ctx.drawImage(image, 0, 0, width, height);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(7,8,12,0.48)";
          ctx.fillRect(0, 0, width, height);
        } catch {
          // Ignore image failures, keep generated background.
        }
      }

      if (state.style.backgroundPattern !== "Plain") {
        drawPattern(ctx, width, height, state.style.backgroundPattern, state.style.accentColor);
      }

      const titleLeft = width * 0.08;
      const titleTop = height * 0.52 + config.titleYOffset;
      const maxTitleWidth = width * 0.52;
      const tagY = titleTop - 110;

      // Brand
      if (state.assets.customLogoUrl) {
        try {
          const logoImage = await loadImage(state.assets.customLogoUrl);
          if (cancelled) return;
          const logoHeight = 58;
          const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
          ctx.drawImage(logoImage, titleLeft, 46, logoWidth, logoHeight);
        } catch {
          ctx.fillStyle = "#f6f7fb";
          ctx.font = "700 34px Inter";
          ctx.fillText("LITY SOFTWARE", titleLeft, 94);
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "700 34px Inter";
        ctx.fillText("LITY SOFTWARE", titleLeft, 92);
      }

      // Top badges
      ctx.save();
      ctx.font = "700 24px Inter";
      const statusText = state.content.statusBadge.toUpperCase();
      const gameText = state.content.game.toUpperCase();
      const statusWidth = ctx.measureText(statusText).width + 48;
      const gameWidth = ctx.measureText(gameText).width + 44;
      const badgesY = 58;
      const totalWidth = statusWidth + gameWidth + 12;
      const badgesStart = width - totalWidth - 56;

      ctx.fillStyle = hexWithOpacity(state.style.accentColor, 0.22);
      ctx.strokeStyle = hexWithOpacity(state.style.accentColor, 0.62);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(badgesStart, badgesY, statusWidth, 44, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(233,227,255,0.96)";
      ctx.fillText(statusText, badgesStart + 24, badgesY + 29);

      ctx.fillStyle = "rgba(17,20,30,0.88)";
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.roundRect(badgesStart + statusWidth + 12, badgesY, gameWidth, 44, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(245,247,255,0.92)";
      ctx.fillText(gameText, badgesStart + statusWidth + 34, badgesY + 29);
      ctx.restore();

      // Post type chip
      ctx.save();
      ctx.fillStyle = hexWithOpacity(state.style.accentColor, 0.16);
      ctx.strokeStyle = hexWithOpacity(state.style.accentColor, 0.65);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(titleLeft, tagY, 370, 46, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(230,222,255,0.95)";
      ctx.font = "700 18px Inter";
      ctx.fillText(state.postType.toUpperCase(), titleLeft + 18, tagY + 30);
      ctx.restore();

      // Main title
      const title = state.content.productName.toUpperCase();
      const customSize = state.content.titleSizeMode === "custom";
      let fontSize = customSize ? state.content.customTitleSize : 142;
      ctx.font = `900 ${fontSize}px Inter`;
      while (!customSize && ctx.measureText(title).width > maxTitleWidth && fontSize > 66) {
        fontSize -= 2;
        ctx.font = `900 ${fontSize}px Inter`;
      }
      ctx.shadowColor = hexWithOpacity(state.style.accentColor, config.glow);
      ctx.shadowBlur = state.templateId === "minimal-clean" ? 10 : 28;
      ctx.fillStyle = "#f8f8ff";
      ctx.fillText(title, titleLeft, titleTop);
      ctx.shadowBlur = 0;

      ctx.fillStyle = hexWithOpacity(state.style.accentColor, 0.9);
      ctx.fillRect(titleLeft, titleTop + 28, Math.min(220, maxTitleWidth * 0.45), 6);

      ctx.fillStyle = "rgba(228,230,240,0.82)";
      ctx.font = "600 44px Inter";
      ctx.fillText(state.content.subtitle || "Subtitle", titleLeft, titleTop + 78);

      // Tag chips
      let tagStartX = titleLeft;
      const tagStartY = titleTop + 122;
      ctx.font = "700 18px Inter";
      for (const tag of state.content.tags.slice(0, 4)) {
        const text = tag.toUpperCase();
        const chipWidth = ctx.measureText(text).width + 30;
        ctx.fillStyle = "rgba(18,20,31,0.82)";
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(tagStartX, tagStartY, chipWidth, 34, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(248,249,255,0.9)";
        ctx.fillText(text, tagStartX + 15, tagStartY + 22);
        tagStartX += chipWidth + 12;
      }

      // Character render
      if (state.assets.characterImageUrl) {
        try {
          const characterImage = await loadImage(state.assets.characterImageUrl);
          if (cancelled) return;
          const characterBaseHeight = height * 0.86;
          const characterHeight = characterBaseHeight * state.assets.characterScale;
          const characterWidth = (characterImage.width / characterImage.height) * characterHeight;
          const baseX = state.assets.characterSide === "right" ? width * 0.66 : width * 0.08;
          const x = baseX + state.assets.characterOffsetX;
          const y = height * 0.15 + state.assets.characterOffsetY;

          ctx.save();
          ctx.globalAlpha = state.assets.characterOpacity;
          if (state.assets.shadow) {
            ctx.shadowColor = "rgba(0,0,0,0.58)";
            ctx.shadowBlur = 32;
            ctx.shadowOffsetY = 16;
          }
          if (state.assets.glow) {
            ctx.shadowColor = hexWithOpacity(state.style.accentColor, 0.46);
            ctx.shadowBlur = 48;
          }
          if (state.assets.mirror) {
            ctx.translate(x + characterWidth / 2, 0);
            ctx.scale(-1, 1);
            ctx.translate(-(x + characterWidth / 2), 0);
          }
          ctx.drawImage(characterImage, x, y, characterWidth, characterHeight);
          ctx.restore();
        } catch {
          // Ignore failed image draw.
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        ctx.roundRect(width * 0.64, height * 0.14, width * 0.26, height * 0.72, 28);
        ctx.fill();
      }

      // Corner decorations.
      if (state.style.showCornerDecorations) {
        const cornerColor = hexWithOpacity(state.style.accentColor, 0.9);
        ctx.strokeStyle = cornerColor;
        ctx.lineWidth = 3;
        const inset = 28;
        const len = 34;
        // TL
        ctx.beginPath();
        ctx.moveTo(inset, inset + len);
        ctx.lineTo(inset, inset);
        ctx.lineTo(inset + len, inset);
        ctx.stroke();
        // TR
        ctx.beginPath();
        ctx.moveTo(width - inset - len, inset);
        ctx.lineTo(width - inset, inset);
        ctx.lineTo(width - inset, inset + len);
        ctx.stroke();
        // BL
        ctx.beginPath();
        ctx.moveTo(inset + len, height - inset);
        ctx.lineTo(inset, height - inset);
        ctx.lineTo(inset, height - inset - len);
        ctx.stroke();
      }

      if (state.style.showScanLines) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        for (let y = 0; y < height; y += 4) {
          ctx.fillStyle = "rgba(255,255,255,0.09)";
          ctx.fillRect(0, y, width, 1);
        }
        ctx.restore();
      }

      // Vignette
      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.18, width * 0.5, height * 0.5, width * 0.86);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, `rgba(0,0,0,${config.vignette})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // Footer
      ctx.fillStyle = "rgba(220,226,240,0.66)";
      ctx.font = "600 17px Inter";
      ctx.fillText("litysoftware.com", titleLeft, height - 28);
      ctx.textAlign = "right";
      ctx.fillText(`LITY SOFTWARE • ${state.content.year}`, width - 52, height - 28);
      ctx.textAlign = "left";
      setReady(true);
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(22,23,27,0.92),rgba(16,17,20,0.96))] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.34)]">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Live Preview</p>
          <p className="text-[10px] text-zinc-500">{sizeLabel} • exports as {sizeLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="text-zinc-500">{state.export.zoom}%</span>
          <span className="rounded-md border border-violet-300/28 bg-violet-500/10 px-2 py-0.5 text-violet-200">{metaTitle}</span>
        </div>
      </header>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0d12]">
        <canvas
          ref={canvasRef}
          className="h-auto w-full"
          style={{ aspectRatio: `${state.export.width} / ${state.export.height}`, opacity: ready ? 1 : 0.5 }}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500">Tip: switch templates, assets and styles freely - preview remains export-accurate.</p>
    </section>
  );
});
