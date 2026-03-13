import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createCustomerToken } from "@/lib/customer-auth";
import { checkRateLimit, recordStrike, isIpBanned } from "@/lib/rate-limit";

// Generic error to prevent user enumeration
const GENERIC_ERROR = "Invalid email or password";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "127.0.0.1";

    // Check if IP is banned
    if (isIpBanned(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Rate limit
    const rl = checkRateLimit(ip, "login");
    if (!rl.success) {
      recordStrike(ip);
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter || 60) } }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    // Find customer — use same error for not found & wrong password (prevent enumeration)
    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      // Perform dummy hash to prevent timing attacks
      await bcrypt.compare(password, "$2a$12$000000000000000000000000000000000000000000000000000000");
      recordStrike(ip);
      return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 401 });
    }

    // Check if account is suspended / banned / inactive
    if (customer.role === "BANNED" || !customer.isActive) {
      // Same generic error to prevent enumeration of banned accounts
      return NextResponse.json(
        { success: false, error: "Your account has been suspended. Contact support." },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, customer.password);
    if (!isValid) {
      recordStrike(ip);
      return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 401 });
    }

    // Update last login
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      username: customer.username,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        mustChangePassword: customer.mustChangePassword || false,
        user: {
          id: customer.id,
          email: customer.email,
          username: customer.username,
          avatar: customer.avatar,
          role: customer.role,
          createdAt: customer.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error("Customer login error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
