export type CoverGeneratorTab = "template" | "content" | "assets" | "style" | "export";

export type CoverTemplateId = "bold-shield" | "minimal-clean" | "cyber-matrix" | "neon-glow" | "hero-character";
export type PostType = "Setup Guide" | "Update" | "News" | "Announcement" | "Review" | "Tutorial";
export type BackgroundPattern = "Dots" | "Grid" | "Hexagon" | "Diagonal" | "Circuit" | "Plain";
export type CharacterSide = "left" | "right";
export type TitleSizeMode = "auto" | "custom";
export type ExportFormat = "png" | "jpg";

export interface TemplatePreset {
  id: CoverTemplateId;
  name: string;
  description: string;
}

export interface QuickPreset {
  id: string;
  productName: string;
  game: string;
  subtitle: string;
  tags: string[];
  statusBadge: string;
  templateId?: CoverTemplateId;
}

export interface CoverContentState {
  productName: string;
  game: string;
  statusBadge: string;
  year: string;
  subtitle: string;
  tagInput: string;
  tags: string[];
  titleSizeMode: TitleSizeMode;
  customTitleSize: number;
}

export interface CoverAssetState {
  characterImageUrl: string | null;
  backgroundImageUrl: string | null;
  customLogoUrl: string | null;
  characterSide: CharacterSide;
  characterScale: number;
  characterOffsetX: number;
  characterOffsetY: number;
  characterOpacity: number;
  glow: boolean;
  shadow: boolean;
  mirror: boolean;
}

export interface CoverStyleState {
  accentColor: string;
  customHex: string;
  backgroundPattern: BackgroundPattern;
  showCornerDecorations: boolean;
  showScanLines: boolean;
}

export interface CoverExportState {
  width: number;
  height: number;
  format: ExportFormat;
  zoom: number;
}

export interface CoverGeneratorState {
  activeTab: CoverGeneratorTab;
  templateId: CoverTemplateId;
  postType: PostType;
  content: CoverContentState;
  assets: CoverAssetState;
  style: CoverStyleState;
  export: CoverExportState;
}
