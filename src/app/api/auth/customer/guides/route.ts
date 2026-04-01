import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: { id: true, isActive: true, role: true },
    });
    if (!customer || !customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 });
    }

    const now = new Date();
    const ownedProductRows = await prisma.license.findMany({
      where: {
        customerId: customer.id,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { productId: true },
      distinct: ["productId"],
    });
    const productIds = ownedProductRows.map((row) => row.productId);

    if (!productIds.length) return NextResponse.json({ success: true, data: [] });

    const guides = await prisma.guide.findMany({
      where: {
        productId: { in: productIds },
        isDraft: false,
        publishedAt: { not: null },
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: guides });
  } catch (error) {
    console.error("GET /api/auth/customer/guides error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
