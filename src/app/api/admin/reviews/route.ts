import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createManualReview, listAllReviews } from "@/lib/reviews-store";

// GET /api/admin/reviews
export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR", "VIEWER"]);
    const rows = await listAllReviews();

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
    const productId = body?.productId ? String(body.productId).trim() : null;
    const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
    const isVerifiedPurchase = !!body?.isVerifiedPurchase;
    const authorAvatarUrl = body?.authorAvatarUrl ? String(body.authorAvatarUrl).trim() : null;
    const ratingRaw = Number(body?.rating);
    const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
    const isVisible = body?.isVisible !== false;

    if (!authorName || !content) {
      return NextResponse.json({ success: false, error: "authorName and content are required" }, { status: 400 });
    }

    const created = await createManualReview({
      authorName,
      authorAvatarUrl,
      content,
      rating,
      isVisible,
      source,
      productId,
      customerEmail,
      isVerifiedPurchase,
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
