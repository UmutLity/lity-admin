import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type ReviewRow = {
  id: string;
  source: string;
  sourceMessageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  rating: number | null;
  createdAt: Date;
};

// GET /api/reviews - Public visible reviews
export async function GET(req: NextRequest) {
  try {
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 20;

    const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","createdAt"
       FROM "Review"
       WHERE "isVisible" = true
       ORDER BY "createdAt" DESC
       LIMIT $1`,
      limit
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    const msg = String((error as any)?.message || "").toLowerCase();
    if (msg.includes("review") && (msg.includes("does not exist") || msg.includes("relation"))) {
      return NextResponse.json(
        { success: false, error: "Review table is missing. Run Prisma migration first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
