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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "MEDIA"]);
    const body = await req.json();

    const existing = await prisma.video.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const title = normalizeTitle(body?.title);
    const videoUrlRaw = normalizeTitle(body?.videoUrl);
    const parsed = parseVideoUrl(videoUrlRaw);
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!parsed) return NextResponse.json({ error: "Only YouTube, Streamable or Vimeo links are supported." }, { status: 400 });

    const updated = await prisma.video.update({
      where: { id: params.id },
      data: {
        title,
        videoUrl: videoUrlRaw,
        thumbnail: normalizeOptional(body?.thumbnail) || parsed.thumbnail,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "Video",
      entityId: updated.id,
      before: {
        title: existing.title,
        videoUrl: existing.videoUrl,
        thumbnail: existing.thumbnail,
      },
      after: {
        title: updated.title,
        videoUrl: updated.videoUrl,
        thumbnail: updated.thumbnail,
      },
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/videos/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "MEDIA"]);
    const existing = await prisma.video.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await prisma.video.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Video",
      entityId: params.id,
      before: {
        title: existing.title,
        videoUrl: existing.videoUrl,
      },
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DELETE /api/admin/videos/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

