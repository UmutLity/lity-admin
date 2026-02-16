import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";
import crypto from "crypto";

// Simple TOTP verification
function verifyTOTP(secret: string, code: string): boolean {
  const time = Math.floor(Date.now() / 30000);
  // Check current window and ±1
  for (let i = -1; i <= 1; i++) {
    const generated = generateTOTP(secret, time + i);
    if (generated === code) return true;
  }
  return false;
}

function generateTOTP(secret: string, counter: number): string {
  // Decode base32 secret
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits: number[] = [];
  for (const c of secret.toUpperCase()) {
    const val = base32Chars.indexOf(c);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) bits.push((val >> i) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  const keyBuffer = Buffer.from(bytes);

  // Counter to 8 bytes
  const counterBuffer = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  // HMAC-SHA1
  const hmac = crypto.createHmac("sha1", keyBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const otp = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1000000;

  return otp.toString().padStart(6, "0");
}

function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(code.slice(0, 4) + "-" + code.slice(4));
  }
  return codes;
}

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { code, secret } = body;

    if (!code || !secret) {
      return NextResponse.json({ success: false, error: "Code and secret are required" }, { status: 400 });
    }

    // Verify TOTP code
    const isValid = verifyTOTP(secret, code);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Invalid verification code. Please try again." }, { status: 400 });
    }

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(10);

    // Save to DB (encrypt secret for storage)
    const encKey = process.env.ENCRYPTION_KEY || "default-key-change-me-in-production";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(encKey).digest(), iv);
    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");
    const encryptedSecret = iv.toString("hex") + ":" + encrypted;

    // Hash recovery codes for storage
    const hashedCodes = recoveryCodes.map(c =>
      crypto.createHash("sha256").update(c).digest("hex")
    );

    await prisma.customer.update({
      where: { id: payload.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
        recoveryCodes: JSON.stringify(hashedCodes),
      },
    });

    return NextResponse.json({
      success: true,
      data: { recoveryCodes },
    });
  } catch (error: any) {
    console.error("2FA verify error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
