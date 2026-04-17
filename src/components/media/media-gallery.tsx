"use client";

import { useMemo, useState } from "react";
import { parseVideoUrl } from "@/lib/media-embed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Film, Play, Eye } from "lucide-react";

export type PublicVideo = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnail: string | null;
  viewCount: number;
  createdAt: string;
  owner: {
    id: string;
    name: string;
  };
};

export function MediaGallery({ videos }: { videos: PublicVideo[] }) {
  const [active, setActive] = useState<PublicVideo | null>(null);
  const [viewedIds, setViewedIds] = useState<Record<string, true>>({});

  const activeParsed = useMemo(() => (active ? parseVideoUrl(active.videoUrl) : null), [active]);

  async function onOpen(video: PublicVideo) {
    setActive(video);
    if (viewedIds[video.id]) return;
    setViewedIds((prev) => ({ ...prev, [video.id]: true }));
    fetch(`/api/videos/${video.id}/view`, { method: "POST" }).catch(() => {});
  }

  return (
    <>
      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#1a1b1f] p-12 text-center">
          <Film className="mx-auto h-9 w-9 text-zinc-500" />
          <p className="mt-3 text-sm text-zinc-400">No media videos yet.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => {
            const parsed = parseVideoUrl(video.videoUrl);
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onOpen(video)}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#25272d,#1a1b1f)] text-left transition hover:-translate-y-0.5 hover:border-violet-300/35 hover:shadow-[0_20px_42px_rgba(0,0,0,.36)]"
              >
                <div className="relative h-48 overflow-hidden border-b border-white/10 bg-[#15161a]">
                  {video.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-8 w-8 text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/35 bg-violet-400/15 text-violet-100">
                      <Play className="ml-0.5 h-6 w-6" />
                    </span>
                  </div>
                  <span className="absolute left-3 top-3 rounded-full border border-violet-300/30 bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">
                    {parsed?.provider || "video"}
                  </span>
                </div>
                <div className="space-y-2 p-4">
                  <p className="line-clamp-1 text-base font-semibold text-white">{video.title}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>by {video.owner?.name || "Media"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {video.viewCount}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-5xl border-white/10 bg-[#1a1b1f] text-white">
          <DialogHeader>
            <DialogTitle className="line-clamp-1">{active?.title || "Video"}</DialogTitle>
            <p className="text-sm text-zinc-400">Uploaded by {active?.owner?.name || "Media"}</p>
          </DialogHeader>

          {activeParsed ? (
            <div className="overflow-hidden rounded-xl border border-violet-300/25 bg-black">
              <iframe
                src={activeParsed.embedUrl}
                title={active?.title || "Media video"}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-[420px] w-full md:h-[520px]"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-[#15151d] p-8 text-sm text-zinc-400">
              This video URL is not supported.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
