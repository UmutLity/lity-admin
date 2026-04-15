import prisma from "@/lib/prisma";
import { MediaGallery, type PublicVideo } from "@/components/media/media-gallery";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const videos = await prisma.video.findMany({
    include: {
      owner: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped: PublicVideo[] = videos.map((video) => ({
    id: video.id,
    title: video.title,
    videoUrl: video.videoUrl,
    thumbnail: video.thumbnail,
    viewCount: video.viewCount,
    createdAt: video.createdAt.toISOString(),
    owner: {
      id: video.owner.id,
      name: video.owner.name,
    },
  }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(184,147,255,0.14),transparent_42%),linear-gradient(180deg,#0a0a0f_0%,#11111a_50%,#09090f_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#161622,#101018)] p-6 shadow-[0_16px_45px_rgba(0,0,0,.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300/85">Media Showcase</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Community Video Hub</h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            Watch the latest videos from our media team. Supports YouTube, Streamable and Vimeo embeds.
          </p>
        </div>

        <MediaGallery videos={mapped} />
      </div>
    </div>
  );
}

