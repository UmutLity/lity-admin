import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

function normalizeRating(value: any): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return null;
}

async function requireActiveCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const payload = verifyCustomerToken(token);
  if (!payload) return { error: NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 }) };

  const customer = await prisma.customer.findUnique({
    where: { id: payload.id },
    select: { id: true, username: true, avatar: true, isActive: true, role: true },
  });
  if (!customer || !customer.isActive || customer.role === "BANNED") {
    return { error: NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 }) };
  }
  return { customer };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveCustomer(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const productId = (searchParams.get("productId") || "").trim();

    const where: any = {
      customerId: auth.customer.id,
      source: "CUSTOMER",
    };
    if (productId) where.productId = productId;

    const rows = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET /api/auth/customer/reviews error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireActiveCustomer(req);
    if ("error" in auth) return auth.error;
    const body = await req.json();

    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const rating = normalizeRating(body?.rating);

    if (!productId) return NextResponse.json({ success: false, error: "productId is required" }, { status: 400 });
    if (content.length < 5) return NextResponse.json({ success: false, error: "Review is too short" }, { status: 400 });

    const now = new Date();
    const [product, hasLicense, existing] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } }),
      prisma.license.count({
        where: {
          customerId: auth.customer.id,
          productId,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.review.findFirst({
        where: { customerId: auth.customer.id, productId },
        select: { id: true },
      }),
    ]);

    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    if (hasLicense === 0) return NextResponse.json({ success: false, error: "You can only review products you own." }, { status: 403 });
    if (existing) return NextResponse.json({ success: false, error: "You already reviewed this product." }, { status: 409 });

    const review = await prisma.review.create({
      data: {
        source: "CUSTOMER",
        sourceMessageId: `customer-${auth.customer.id}-${productId}`,
        customerId: auth.customer.id,
        productId,
        authorName: auth.customer.username,
        authorAvatarUrl: auth.customer.avatar || null,
        content,
        rating,
        isVerifiedPurchase: true,
        isVisible: true,
      },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error: any) {
    if (String(error?.code || "") === "P2002") {
      return NextResponse.json({ success: false, error: "You already reviewed this product." }, { status: 409 });
    }
    console.error("POST /api/auth/customer/reviews error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
