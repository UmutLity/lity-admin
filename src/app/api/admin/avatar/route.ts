import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { deleteFile, uploadFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

function isManagedUpload(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/uploads/") || url.includes("res.cloudinary.com/");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Avatar file is required" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, id: true, name: true, email: true, role: true },
    });

    if (!current) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const uploaded = await uploadFile(file);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar: uploaded.url },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    if (current.avatar && isManagedUpload(current.avatar) && current.avatar !== uploaded.url) {
      await deleteFile(current.avatar);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Admin avatar upload error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const avatarUrl = String(body?.avatarUrl || "").trim();
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
      return NextResponse.json({ success: false, error: "Avatar URL must start with http:// or https://" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl || null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Admin avatar URL update error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    if (current?.avatar && isManagedUpload(current.avatar)) {
      await deleteFile(current.avatar);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Admin avatar remove error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Server error" }, { status: 500 });
  }
}
