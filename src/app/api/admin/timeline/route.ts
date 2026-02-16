import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/timeline - Fetch audit logs formatted as timeline entries
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Group by date
    const dates: Record<string, Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string | null;
      diff: string | null;
      userId: string;
      userName: string;
      createdAt: Date;
      ip: string | null;
    }>> = {};

    for (const log of logs) {
      const dateKey = log.createdAt.toISOString().split("T")[0];
      if (!dates[dateKey]) dates[dateKey] = [];

      dates[dateKey].push({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        diff: log.diff,
        userId: log.userId,
        userName: log.user?.name ?? "Unknown",
        createdAt: log.createdAt,
        ip: log.ip,
      });
    }

    return NextResponse.json({
      success: true,
      data: { dates },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Timeline GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
