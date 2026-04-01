import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    await prisma.favoriteProduct.deleteMany({
      where: {
        customerId: payload.id,
        productId: params.productId,
      },
    });

    return NextResponse.json({ success: true, data: { productId: params.productId, favorited: false } });
  } catch (error) {
    console.error("DELETE /api/auth/customer/favorites/[productId] error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
