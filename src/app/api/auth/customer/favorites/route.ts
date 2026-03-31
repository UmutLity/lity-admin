import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

async function getCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) return null;
  return verifyCustomerToken(token);
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCustomer(req);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.favoriteProduct.findMany({
      where: { customerId: payload.id },
      include: {
        product: {
          include: {
            prices: { orderBy: { plan: "asc" } },
            images: { include: { media: true }, orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        createdAt: row.createdAt,
        product: row.product,
      })),
    });
  } catch (error) {
    console.error("GET /api/auth/customer/favorites error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCustomer(req);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ success: false, error: "Product is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, name: true },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const existing = await prisma.favoriteProduct.findUnique({
      where: {
        customerId_productId: {
          customerId: payload.id,
          productId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, data: { productId, favorited: true, alreadyExists: true } });
    }

    await prisma.favoriteProduct.create({
      data: {
        customerId: payload.id,
        productId,
      },
    });

    return NextResponse.json({ success: true, data: { productId, favorited: true } });
  } catch (error) {
    console.error("POST /api/auth/customer/favorites error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
