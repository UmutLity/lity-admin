export type SupportedVideoProvider = "youtube" | "vimeo" | "streamable";

export interface ParsedVideoUrl {
  provider: SupportedVideoProvider;
  providerId: string;
  embedUrl: string;
  thumbnail: string | null;
}

function parseYouTubeId(raw: string): string | null {
  const input = raw.trim();
  const watch = input.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watch?.[1]) return watch[1];
  const short = input.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (short?.[1]) return short[1];
  const embed = input.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embed?.[1]) return embed[1];
  return null;
}

function parseVimeoId(raw: string): string | null {
  const input = raw.trim();
  const direct = input.match(/vimeo\.com\/(\d{6,})/);
  if (direct?.[1]) return direct[1];
  const player = input.match(/player\.vimeo\.com\/video\/(\d{6,})/);
  if (player?.[1]) return player[1];
  return null;
}

function parseStreamableId(raw: string): string | null {
  const input = raw.trim();
  const m = input.match(/streamable\.com\/([a-zA-Z0-9]+)/);
  if (m?.[1]) return m[1];
  return null;
}

export function parseVideoUrl(rawUrl: string): ParsedVideoUrl | null {
  const input = rawUrl.trim();
  if (!input) return null;

  const youtubeId = parseYouTubeId(input);
  if (youtubeId) {
    return {
      provider: "youtube",
      providerId: youtubeId,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  const vimeoId = parseVimeoId(input);
  if (vimeoId) {
    return {
      provider: "vimeo",
      providerId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnail: `https://vumbnail.com/${vimeoId}.jpg`,
    };
  }

  const streamableId = parseStreamableId(input);
  if (streamableId) {
    return {
      provider: "streamable",
      providerId: streamableId,
      embedUrl: `https://streamable.com/e/${streamableId}`,
      thumbnail: `https://placehold.co/960x540/151521/a78bfa?text=Streamable`,
    };
  }

  return null;
}

