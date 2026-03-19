import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    await prisma.customer.update({
      where: { id: payload.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("2FA disable error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
