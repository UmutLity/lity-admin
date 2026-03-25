import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type ReviewRow = {
  id: string;
  source: string;
  sourceMessageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  rating: number | null;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// PUT /api/admin/reviews/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const existing = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review" WHERE "id" = $1 LIMIT 1`,
      params.id
    );

    if (!existing[0]) {
      return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
    }

    const body = await req.json();
    const current = existing[0];
    const authorName = body?.authorName !== undefined ? String(body.authorName).trim() : current.authorName;
    const content = body?.content !== undefined ? String(body.content).trim() : current.content;
    const source = body?.source !== undefined ? String(body.source).trim() : current.source;
    const authorAvatarUrl =
      body?.authorAvatarUrl !== undefined
        ? (body.authorAvatarUrl ? String(body.authorAvatarUrl).trim() : null)
        : current.authorAvatarUrl;
    const ratingRaw = body?.rating !== undefined ? Number(body.rating) : current.rating;
    const rating = Number.isInteger(ratingRaw) && Number(ratingRaw) >= 1 && Number(ratingRaw) <= 5 ? Number(ratingRaw) : null;
    const isVisible = body?.isVisible !== undefined ? !!body.isVisible : current.isVisible;

    if (!authorName || !content) {
      return NextResponse.json({ success: false, error: "authorName and content are required" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "Review"
       SET "authorName"=$2, "authorAvatarUrl"=$3, "content"=$4, "rating"=$5, "isVisible"=$6, "source"=$7, "updatedAt"=NOW()
       WHERE "id"=$1`,
      params.id,
      authorName,
      authorAvatarUrl,
      content,
      rating,
      isVisible,
      source
    );

    const updated = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review" WHERE "id" = $1 LIMIT 1`,
      params.id
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/reviews/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    await prisma.$executeRawUnsafe(`DELETE FROM "Review" WHERE "id" = $1`, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

