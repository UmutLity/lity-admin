import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizeAvatarUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) {
    return raw;
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error("Avatar URL must start with http:// or https://");
  }
  return raw;
}

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

async function customerUsernameExists(username: string) {
  try {
    return await prisma.customer.findUnique({ where: { username } });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Customer" WHERE "username" = ${username} LIMIT 1`
    );
    return rows[0] || null;
  }
}

async function selectCustomerResponse(id: string) {
  try {
    return await prisma.customer.findUnique({
      where: { id },
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
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>(
      Prisma.sql`
        SELECT
          "id",
          "email",
          "username",
          "avatar",
          "role",
          "createdAt"
        FROM "Customer"
        WHERE "id" = ${id}
        LIMIT 1
      `
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      balance: 0,
      totalSpent: 0,
      mustChangePassword: false,
    };
  }
}

async function updateCustomerProfile(id: string, username: string, avatar: string | null) {
  try {
    await prisma.customer.update({
      where: { id },
      data: { username, avatar },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Customer" SET "username" = ${username}, "avatar" = ${avatar}, "updatedAt" = ${new Date()} WHERE "id" = ${id}`
    );
  }

  return selectCustomerResponse(id);
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
    const avatar = normalizeAvatarUrl(body?.avatarUrl);

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        {
          success: false,
          error: "Username must be 3-30 chars and only include letters, numbers, underscore, dot, dash",
        },
        { status: 400 }
      );
    }

    const existing = await customerUsernameExists(username);
    if (existing && existing.id !== payload.id) {
      return NextResponse.json({ success: false, error: "Username is already taken" }, { status: 409 });
    }

    const updated = await updateCustomerProfile(payload.id, username, avatar);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.message?.includes("Avatar URL")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Customer profile update error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
