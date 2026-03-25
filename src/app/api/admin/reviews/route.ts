import crypto from "crypto";
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

// GET /api/admin/reviews
export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR", "VIEWER"]);

    const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review"
       ORDER BY "createdAt" DESC`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/reviews
export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const authorName = String(body?.authorName || "").trim();
    const content = String(body?.content || "").trim();
    const source = String(body?.source || "MANUAL").trim() || "MANUAL";
    const authorAvatarUrl = body?.authorAvatarUrl ? String(body.authorAvatarUrl).trim() : null;
    const ratingRaw = Number(body?.rating);
    const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
    const isVisible = body?.isVisible !== false;

    if (!authorName || !content) {
      return NextResponse.json({ success: false, error: "authorName and content are required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const sourceMessageId = `manual-${id}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Review"
      ("id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","meta","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
      id,
      source,
      sourceMessageId,
      authorName,
      authorAvatarUrl,
      content,
      rating,
      isVisible,
      JSON.stringify({ manual: true })
    );

    const created = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review" WHERE "id" = $1 LIMIT 1`,
      id
    );

    return NextResponse.json({ success: true, data: created[0] });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

