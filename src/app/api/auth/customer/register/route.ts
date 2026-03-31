import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createCustomerToken } from "@/lib/customer-auth";
import { checkRateLimit, recordStrike, isIpBanned } from "@/lib/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "127.0.0.1";

    if (isIpBanned(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please try again later." },
        { status: 429 }
      );
    }

    const rl = checkRateLimit(ip, "login");
    if (!rl.success) {
      recordStrike(ip);
      return NextResponse.json(
        { success: false, error: "Too many registration attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter || 60) } }
      );
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !username || !password) {
      return NextResponse.json({ success: false, error: "Email, username and password are required." }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ success: false, error: "Username must be 3-30 chars and only contain letters, numbers, _ . -" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.customer.findUnique({ where: { email } }),
      prisma.customer.findUnique({ where: { username } }),
    ]);

    if (existingEmail) {
      return NextResponse.json({ success: false, error: "This email is already registered." }, { status: 409 });
    }

    if (existingUsername) {
      return NextResponse.json({ success: false, error: "This username is already taken." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const customer = await prisma.customer.create({
      data: {
        email,
        username,
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        balance: true,
        totalSpent: true,
        createdAt: true,
      },
    });

    try {
      await prisma.adminNotification.create({
        data: {
          userId: null,
          type: "SYSTEM",
          severity: "INFO",
          title: "New customer registration",
          message: `${customer.username} registered with ${customer.email}.`,
          meta: JSON.stringify({
            customerId: customer.id,
            username: customer.username,
            email: customer.email,
            createdAt: customer.createdAt,
          }),
        },
      });
    } catch (notificationError) {
      console.error("Admin notification create failed on customer registration:", notificationError);
    }

    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      username: customer.username,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        mustChangePassword: false,
        user: customer,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Customer register error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
