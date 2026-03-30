import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

function corsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  const allowed = new Set([
    "https://litysoftware.com",
    "https://www.litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);
  const allowOrigin = allowed.has(origin) ? origin : "https://litysoftware.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders(req) });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401, headers: corsHeaders(req) });

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        customerId: true,
        status: true,
        deliveryContent: true,
        updatedAt: true,
      },
    });

    if (!order || order.customerId !== payload.id) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404, headers: corsHeaders(req) });
    }
    if (String(order.status) !== "DELIVERED" || !order.deliveryContent) {
      return NextResponse.json({ success: false, error: "Delivery content is not available yet." }, { status: 409, headers: corsHeaders(req) });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        deliveryContent: order.deliveryContent,
        updatedAt: order.updatedAt,
      },
    }, { headers: corsHeaders(req) });
  } catch (error) {
    console.error("GET /api/orders/[id]/delivery error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: corsHeaders(req) });
  }
}
