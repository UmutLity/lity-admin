import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Both passwords are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.id } });
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, customer.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash and update — also clear mustChangePassword flag
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.customer.update({
      where: { id: payload.id },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Password change error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
