import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

function normalizeUsername(username: string): string {
  return username.trim();
}

export async function PATCH(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const usernameRaw = String(body?.username || "");
    const username = normalizeUsername(usernameRaw);

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        {
          success: false,
          error: "Username must be 3-30 chars and only include letters, numbers, underscore, dot, dash",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({ where: { username } });
    if (existing && existing.id !== payload.id) {
      return NextResponse.json({ success: false, error: "Username is already taken" }, { status: 409 });
    }

    const updated = await prisma.customer.update({
      where: { id: payload.id },
      data: { username },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        balance: true,
        totalSpent: true,
        createdAt: true,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Customer profile update error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

