import type { BackgroundPattern, PostType, QuickPreset, TemplatePreset } from "./types";

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: "bold-shield", name: "Bold Shield", description: "Massive title, shield crest, cinematic accent lines." },
  { id: "minimal-clean", name: "Minimal Clean", description: "Clean centered layout with subtle surface texture." },
  { id: "cyber-matrix", name: "Cyber Matrix", description: "Terminal-inspired frame with code-like visual rhythm." },
  { id: "neon-glow", name: "Neon Glow", description: "Dual-color bloom and stronger edge lighting." },
  { id: "hero-character", name: "Hero Character", description: "Character-first composition with spotlight framing." },
];

export const POST_TYPES: PostType[] = ["Setup Guide", "Update", "News", "Announcement", "Review", "Tutorial"];

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "lity-newera",
    productName: "Lity NewEra",
    game: "VALORANT",
    subtitle: "Installation · Configuration · Troubleshooting",
    tags: ["NEW", "v2.3", "UPDATED"],
    statusBadge: "UNDETECTED",
    templateId: "hero-character",
  },
  {
    id: "lity-vip",
    productName: "Lity VIP",
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
    id: "lity-private",
    productName: "Lity Private",
    game: "VALORANT",
    subtitle: "Release notes for private channel users",
    tags: ["PRIVATE", "BUILD", "STABLE"],
    statusBadge: "UNDETECTED",
    templateId: "minimal-clean",
  },
];

export const ACCENT_PRESETS = [
  "#8B7CFF",
  "#A78BFA",
  "#7C6BFF",
  "#C4B5FD",
  "#A5B4FC",
  "#8EC5FF",
  "#B8A4FF",
  "#9D86FF",
];

export const BACKGROUND_PATTERNS: BackgroundPattern[] = ["Dots", "Grid", "Hexagon", "Diagonal", "Circuit", "Plain"];
