import type { BackgroundPattern, PostType, QuickPreset, TemplatePreset } from "./types";

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: "bold-shield", name: "Bold Shield", description: "Massive title, shield crest, cinematic red accents." },
  { id: "minimal-clean", name: "Minimal Clean", description: "Clean centered layout with subtle surface texture." },
  { id: "cyber-matrix", name: "Cyber Matrix", description: "Terminal-inspired frame with code-like visual rhythm." },
  { id: "neon-glow", name: "Neon Glow", description: "Dual-color bloom and stronger edge lighting." },
  { id: "hero-character", name: "Hero Character", description: "Character-first composition with spotlight framing." },
];

export const POST_TYPES: PostType[] = ["Setup Guide", "Update", "News", "Announcement", "Review", "Tutorial"];

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "byteon-newera",
    productName: "Byteon NewEra",
    game: "VALORANT",
    subtitle: "Installation · Configuration · Troubleshooting",
    tags: ["NEW", "v2.3", "UPDATED"],
    statusBadge: "UNDETECTED",
    templateId: "hero-character",
  },
  {
    id: "byteon-vip",
    productName: "Byteon VIP",
    game: "VALORANT",
    subtitle: "Premium feature branch and private updates",
    tags: ["VIP", "PRO", "MEMBERS"],
    statusBadge: "UNDETECTED",
    templateId: "bold-shield",
  },
  {
    id: "vanguard-bypass",
    productName: "Vanguard Bypass",
    game: "VALORANT",
    subtitle: "Daily patch notes and maintenance notices",
    tags: ["PATCH", "LIVE", "HOT"],
    statusBadge: "UPDATING",
    templateId: "cyber-matrix",
  },
  {
    id: "byteon-private",
    productName: "Byteon Private",
    game: "VALORANT",
    subtitle: "Release notes for private channel users",
    tags: ["PRIVATE", "BUILD", "STABLE"],
    statusBadge: "UNDETECTED",
    templateId: "minimal-clean",
  },
];

export const ACCENT_PRESETS = [
  "#8B1A2B",
  "#7B1024",
  "#B42318",
  "#5D1631",
  "#1098AD",
  "#E11D48",
  "#334155",
  "#CA8A04",
];

export const BACKGROUND_PATTERNS: BackgroundPattern[] = ["Dots", "Grid", "Hexagon", "Diagonal", "Circuit", "Plain"];
