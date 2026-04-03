import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteFile, uploadFile } from "@/lib/upload";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function isManagedUpload(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/uploads/") || url.includes("res.cloudinary.com/");
}

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

async function getCurrentCustomer(id: string) {
  try {
    return await prisma.customer.findUnique({
      where: { id },
      select: { avatar: true },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const rows = await prisma.$queryRaw<Array<{ avatar: string | null }>>(
      Prisma.sql`SELECT "avatar" FROM "Customer" WHERE "id" = ${id} LIMIT 1`
    );
    return rows[0] || { avatar: null };
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

async function updateCustomerAvatar(id: string, avatar: string | null) {
  try {
    await prisma.customer.update({
      where: { id },
      data: { avatar },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Customer" SET "avatar" = ${avatar}, "updatedAt" = ${new Date()} WHERE "id" = ${id}`
    );
  }
  return selectCustomerResponse(id);
}

async function uploadAvatarWithFallback(file: File) {
  try {
    return await uploadFile(file);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (!message.includes("Upload storage is not configured")) throw error;
    if (!file.type.startsWith("image/")) throw error;
    if (file.size > 350 * 1024) {
      throw new Error("Avatar upload storage is not configured. Use an image smaller than 350KB or configure Cloudinary.");
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    return {
      filename: file.name,
      url: `data:${file.type};base64,${base64}`,
      mimeType: file.type,
      size: file.size,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Avatar file is required" }, { status: 400 });
    }

    const current = await getCurrentCustomer(payload.id);

    const uploaded = await uploadAvatarWithFallback(file);

    const updated = await updateCustomerAvatar(payload.id, uploaded.url);

    const previousAvatar = current?.avatar;
    if (previousAvatar && isManagedUpload(previousAvatar) && previousAvatar !== uploaded.url) {
      await deleteFile(previousAvatar);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Customer avatar upload error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const current = await getCurrentCustomer(payload.id);

    const updated = await updateCustomerAvatar(payload.id, null);

    const previousAvatar = current?.avatar;
    if (previousAvatar && isManagedUpload(previousAvatar)) {
      await deleteFile(previousAvatar);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Customer avatar remove error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
