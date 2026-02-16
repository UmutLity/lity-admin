import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

// GET /api/auth/customer/cart - Get cart items
export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const items = await prisma.cartItem.findMany({
      where: { customerId: payload.id },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true, status: true, category: true,
            buyUrl: true, shortDescription: true, isFeatured: true,
            prices: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate total
    let total = 0;
    const cartItems = items.map((item) => {
      const priceObj = item.product.prices.find((p) => p.plan === item.plan);
      const price = priceObj?.price || 0;
      total += price;
      return { ...item, price };
    });

    return NextResponse.json({ success: true, data: { items: cartItems, total } });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// POST /api/auth/customer/cart - Add item to cart
export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { productId, plan } = body;

    if (!productId || !plan) {
      return NextResponse.json({ success: false, error: "Product ID and plan required" }, { status: 400 });
    }

    // Check product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    // Check price exists for plan
    const priceExists = await prisma.productPrice.findUnique({
      where: { productId_plan: { productId, plan } },
    });
    if (!priceExists) return NextResponse.json({ success: false, error: "Plan not available" }, { status: 400 });

    // Upsert cart item
    const item = await prisma.cartItem.upsert({
      where: { customerId_productId_plan: { customerId: payload.id, productId, plan } },
      update: {}, // Already exists, no update needed
      create: { customerId: payload.id, productId, plan },
      include: { product: { select: { name: true } } },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/auth/customer/cart - Remove item from cart
export async function DELETE(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ success: false, error: "Item ID required" }, { status: 400 });
    }

    // Make sure the item belongs to this customer
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, customerId: payload.id },
    });

    if (!item) return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });

    await prisma.cartItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
