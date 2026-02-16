import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/notifications
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const type = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = {
      OR: [{ userId }, { userId: null }], // user-specific + global
    };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { name: true } } },
      }),
      prisma.adminNotification.count({
        where: { OR: [{ userId }, { userId: null }], isRead: false },
      }),
    ]);

    return NextResponse.json({ success: true, data: notifications, unreadCount });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/notifications - Mark as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const body = await req.json();
    const { id, markAll } = body;

    if (markAll) {
      await prisma.adminNotification.updateMany({
        where: { OR: [{ userId }, { userId: null }], isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      await prisma.adminNotification.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
