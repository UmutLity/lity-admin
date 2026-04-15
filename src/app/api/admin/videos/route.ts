import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { parseVideoUrl } from "@/lib/media-embed";

export const dynamic = "force-dynamic";

function normalizeTitle(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptional(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function GET() {
  try {
    await requireRole(["FOUNDER", "ADMIN", "MEDIA"]);
    const videos = await prisma.video.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: videos });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/videos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "MEDIA"]);
    const body = await req.json();

    const title = normalizeTitle(body?.title);
    const videoUrlRaw = normalizeTitle(body?.videoUrl);
    const parsed = parseVideoUrl(videoUrlRaw);
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!parsed) return NextResponse.json({ error: "Only YouTube, Streamable or Vimeo links are supported." }, { status: 400 });

    const video = await prisma.video.create({
      data: {
        title,
        videoUrl: videoUrlRaw,
        thumbnail: normalizeOptional(body?.thumbnail) || parsed.thumbnail,
        ownerId: (session.user as any).id,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Video",
      entityId: video.id,
      after: {
        title: video.title,
        videoUrl: video.videoUrl,
        provider: parsed.provider,
      },
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: video }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/videos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

