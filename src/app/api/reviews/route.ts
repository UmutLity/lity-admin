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
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const ratingRaw = Number.parseInt(searchParams.get("rating") || "", 10);
    const productId = (searchParams.get("productId") || "").trim();

    const rows = await listVisibleReviews(500);
    const filtered = rows
      .filter((r) => {
        if (q && !(`${r.authorName} ${r.content} ${r.productName || ""}`.toLowerCase().includes(q))) return false;
        if (Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 && r.rating !== ratingRaw) return false;
        if (productId && r.productId !== productId) return false;
        return true;
      })
      .slice(0, limit);

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
