import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

function parseReviewMeta(meta: string | null | undefined) {
  if (!meta) return { moderationStatus: "APPROVED", rejectionReason: null };
  try {
    const parsed = JSON.parse(meta);
    return {
      moderationStatus:
        parsed?.moderationStatus === "PENDING" || parsed?.moderationStatus === "REJECTED" || parsed?.moderationStatus === "APPROVED"
          ? parsed.moderationStatus
          : "APPROVED",
      rejectionReason: typeof parsed?.rejectionReason === "string" && parsed.rejectionReason.trim() ? parsed.rejectionReason.trim() : null,
    };
  } catch {
    return { moderationStatus: "APPROVED", rejectionReason: null };
  }
}

async function getAuthedCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const payload = verifyCustomerToken(token);
  if (!payload) return { error: "Invalid token", status: 401 as const };

  const customer = await prisma.customer.findUnique({
    where: { id: payload.id },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });
  if (!customer) return { error: "Customer not found", status: 404 as const };
  if (!customer.isActive || customer.role === "BANNED") return { error: "Your account is not eligible.", status: 403 as const };
  return { customer };
}

async function getOwnedRoleProducts(customerId: string) {
  const rows = await prisma.license.findMany({
    where: {
      customerId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      product: { accessRoleKey: { not: null } },
    },
    select: {
      productId: true,
      product: { select: { id: true, name: true, slug: true, accessRoleKey: true } },
    },
    distinct: ["productId"],
  });
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const reviews = await prisma.review.findMany({
      where: { customerId: auth.customer.id },
      include: {
        product: { select: { id: true, name: true, slug: true, accessRoleKey: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const owned = await getOwnedRoleProducts(auth.customer.id);
    const ownedProducts = owned.map((x) => ({
      id: x.product.id,
      name: x.product.name,
      slug: x.product.slug,
      roleKey: x.product.accessRoleKey,
    }));

    return NextResponse.json({
      success: true,
      data: {
        ownedProducts,
        reviews: reviews.map((r) => {
          const meta = parseReviewMeta(r.meta);
          return {
            id: r.id,
            productId: r.productId,
            product: r.product,
            content: r.content,
            rating: r.rating,
            isVisible: r.isVisible,
            moderationStatus: meta.moderationStatus,
            rejectionReason: meta.rejectionReason,
            isVerifiedPurchase: r.isVerifiedPurchase,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        }),
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/reviews error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const productId = String(body.productId || "").trim();
    const content = String(body.content || "").trim();
    const rating = Number(body.rating);

    if (!productId) return NextResponse.json({ success: false, error: "productId is required" }, { status: 400 });
    if (content.length < 10 || content.length > 1000) {
      return NextResponse.json({ success: false, error: "Review must be 10-1000 characters." }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const owned = await getOwnedRoleProducts(auth.customer.id);
    const ownedProduct = owned.find((x) => x.productId === productId);
    if (!ownedProduct) {
      return NextResponse.json({ success: false, error: "You can only review products you own with active role access." }, { status: 403 });
    }

    const source = "CUSTOMER_PORTAL";
    const sourceMessageId = `${auth.customer.id}:${productId}`;

    const existing = await prisma.review.findUnique({
      where: {
        customerId_productId: {
          customerId: auth.customer.id,
          productId,
        },
      },
    });

    const saved = existing
      ? await prisma.review.update({
          where: { id: existing.id },
          data: {
            content,
            rating,
            isVisible: false,
            source,
            sourceMessageId,
            authorName: auth.customer.username,
            meta: JSON.stringify({ moderationStatus: "PENDING" }),
          },
          include: { product: { select: { id: true, name: true, slug: true, accessRoleKey: true } } },
        })
      : await prisma.review.create({
          data: {
            source,
            sourceMessageId,
            productId,
            customerId: auth.customer.id,
            authorName: auth.customer.username,
            content,
            rating,
            isVisible: false,
            isVerifiedPurchase: true,
            meta: JSON.stringify({ moderationStatus: "PENDING" }),
          },
          include: { product: { select: { id: true, name: true, slug: true, accessRoleKey: true } } },
        });

    return NextResponse.json({
      success: true,
      data: {
        id: saved.id,
        productId: saved.productId,
        product: saved.product,
        content: saved.content,
        rating: saved.rating,
        isVisible: saved.isVisible,
        moderationStatus: "PENDING",
        rejectionReason: null,
        isVerifiedPurchase: saved.isVerifiedPurchase,
        updatedAt: saved.updatedAt,
      },
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/auth/customer/reviews error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
