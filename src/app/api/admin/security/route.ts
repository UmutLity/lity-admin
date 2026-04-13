import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
      suspiciousIpGroups,
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
      prisma.loginAttempt.groupBy({
        by: ["ip"],
        where: { createdAt: { gte: last24h }, success: false },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _count: { ip: "desc" } },
        take: 50,
      }),
    ]);

    const suspiciousBase = suspiciousIpGroups.filter((row) => row._count._all >= 3);
    const suspiciousIps = suspiciousBase.map((row) => row.ip);
    const suspiciousAttempts = suspiciousIps.length
      ? await prisma.loginAttempt.findMany({
          where: { createdAt: { gte: last24h }, ip: { in: suspiciousIps } },
          select: { ip: true, email: true, success: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : [];

    const attemptsByIp = new Map<string, Array<{ email: string; success: boolean; createdAt: Date }>>();
    for (const row of suspiciousAttempts) {
      const list = attemptsByIp.get(row.ip) || [];
      list.push({ email: row.email, success: row.success, createdAt: row.createdAt });
      attemptsByIp.set(row.ip, list);
    }

    const suspiciousSummary = suspiciousBase.map((row) => {
      const list = attemptsByIp.get(row.ip) || [];
      const uniqueEmails = new Set(list.map((x) => x.email.toLowerCase())).size;
      const lastSuccess = list.find((x) => x.success);
      const failures = row._count._all;
      const risk = failures >= 12 || uniqueEmails >= 6 ? "HIGH" : failures >= 6 ? "MEDIUM" : "LOW";
      return {
        ip: row.ip,
        failedCount: failures,
        uniqueEmails,
        lastAttemptAt: row._max.createdAt,
        lastSuccessAt: lastSuccess?.createdAt || null,
        risk,
      };
    });

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
        suspiciousIps: suspiciousSummary,
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
