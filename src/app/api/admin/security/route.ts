import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// GET /api/admin/security - Security dashboard overview
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.view");
    if (!hasPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalAttempts24h,
      failedAttempts24h,
      successAttempts24h,
      activeLocks,
      unresolvedAlerts,
      recentAttempts,
      recentAlerts,
    ] = await Promise.all([
      prisma.loginAttempt.count({ where: { createdAt: { gte: last24h } } }),
      prisma.loginAttempt.count({ where: { createdAt: { gte: last24h }, success: false } }),
      prisma.loginAttempt.count({ where: { createdAt: { gte: last24h }, success: true } }),
      prisma.accountLock.findMany({
        where: { lockedUntil: { gt: now } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.securityAlert.count({ where: { resolvedAt: null } }),
      prisma.loginAttempt.findMany({
        where: { createdAt: { gte: last24h } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.securityAlert.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalAttempts24h,
          failedAttempts24h,
          successAttempts24h,
          activeLocks: activeLocks.length,
          unresolvedAlerts,
        },
        locks: activeLocks,
        attempts: recentAttempts,
        alerts: recentAlerts,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/admin/security error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
