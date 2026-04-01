import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { parseOrderTimeline } from "@/lib/orders";

export const dynamic = "force-dynamic";

function isSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("P2021") || message.includes("P2022");
}

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const orders = await prisma.order.findMany({
      where: { customerId: payload.id },
      include: {
        deliveredBy: { select: { name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }).catch(async (error) => {
      if (!isSchemaMismatch(error)) throw error;
      const legacyOrders = await prisma.order.findMany({
        where: { customerId: payload.id },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          totalAmount: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              plan: true,
              amount: true,
              product: {
                select: { id: true, name: true, slug: true, status: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return legacyOrders.map((order) => ({
        ...order,
        subtotalAmount: order.totalAmount,
        discountAmount: 0,
        couponCode: null,
        customerNote: null,
        deliveryContent: null,
        deliveredAt: null,
        deliveredBy: null,
        timeline: null,
      }));
    });

    return NextResponse.json({
      success: true,
      data: orders.map((order) => ({
        ...order,
        deliveryAvailable: String(order.status) === "DELIVERED" && !!order.deliveryContent,
        timeline: parseOrderTimeline(order.timeline),
        deliveredByName: order.deliveredBy?.name || null,
      })),
    });
  } catch (error) {
    console.error("GET /api/auth/customer/orders error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
