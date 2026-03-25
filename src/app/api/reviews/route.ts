import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { listVisibleReviews } from "@/lib/reviews-store";

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

    const rows = await listVisibleReviews(limit);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
