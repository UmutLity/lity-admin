import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: { twoFactorEnabled: true },
    });

    // If twoFactorEnabled field doesn't exist yet, default to false
    return NextResponse.json({
      success: true,
      data: { enabled: (customer as any)?.twoFactorEnabled || false },
    });
  } catch {
    return NextResponse.json({ success: true, data: { enabled: false } });
  }
}
