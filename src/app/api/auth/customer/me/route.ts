import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ success: false, error: "Token required" }, { status: 401 });
    }

    const payload = verifyCustomerToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    // Check if banned
    if (customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account has been suspended" }, { status: 403 });
    }

    if (!customer.isActive) {
      return NextResponse.json({ success: false, error: "Your account has been deactivated" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error: any) {
    console.error("Customer me error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
