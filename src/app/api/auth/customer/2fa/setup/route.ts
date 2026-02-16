import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const customer = await prisma.customer.findUnique({ where: { id: payload.id } });
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });

    // Generate a random secret (base32 encoded)
    const randomBytes = crypto.randomBytes(20);
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < 32; i++) {
      secret += base32Chars[randomBytes[i % randomBytes.length] % 32];
    }

    // Generate otpauth URI for QR code
    const issuer = "LitySoftware";
    const account = customer.email;
    const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

    // Generate QR code URL using a public API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`;

    return NextResponse.json({
      success: true,
      data: {
        secret,
        qrCodeUrl,
        otpauthUri,
      },
    });
  } catch (error: any) {
    console.error("2FA setup error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
