import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

function normalizeRating(value: any): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const rating = normalizeRating(body?.rating);
    if (content.length < 5) return NextResponse.json({ success: false, error: "Review is too short" }, { status: 400 });

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true, customerId: true, source: true },
    });
    if (!review) return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
    if (review.customerId !== payload.id || review.source !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Not allowed" }, { status: 403 });
    }

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { content, rating, isVisible: false, meta: JSON.stringify({ moderationStatus: "PENDING" }) },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/auth/customer/reviews/[id] error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
