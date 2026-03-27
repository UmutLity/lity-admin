import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteFile, uploadFile } from "@/lib/upload";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

function isManagedUpload(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/uploads/");
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

    const current = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: { avatar: true },
    });

    const uploaded = await uploadFile(file);

    const updated = await prisma.customer.update({
      where: { id: payload.id },
      data: { avatar: uploaded.url },
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

    const current = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: { avatar: true },
    });

    const updated = await prisma.customer.update({
      where: { id: payload.id },
      data: { avatar: null },
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
