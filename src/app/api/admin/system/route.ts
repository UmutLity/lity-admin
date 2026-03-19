import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const last24h = new Date(now.getTime() - 86400000);

    // DB Health
    let dbStatus = "healthy";
    let dbLatency = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch {
      dbStatus = "error";
    }

    // Webhook stats
    const [totalWebhooks, failedWebhooks, recentWebhook] = await Promise.all([
      prisma.webhookDelivery.count(),
      prisma.webhookDelivery.count({ where: { success: false } }),
      prisma.webhookDelivery.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    // Audit log stats
    const auditLast24h = await prisma.auditLog.count({ where: { createdAt: { gte: last24h } } });
    const loginFailsLast24h = await prisma.auditLog.count({
      where: { action: "LOGIN_FAIL", createdAt: { gte: last24h } },
    });

    // Security alerts
    const unresolvedAlerts = await prisma.securityAlert.count({ where: { resolvedAt: null } });
    const activeLocks = await prisma.accountLock.count({ where: { lockedUntil: { gt: now } } });

    // DB sizes
    const totalProducts = await prisma.product.count();
    const totalCustomers = await prisma.customer.count();
    const totalPageViews = await prisma.pageView.count();
    const totalAuditLogs = await prisma.auditLog.count();

    return NextResponse.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
          tables: {
            products: totalProducts,
            customers: totalCustomers,
            pageViews: totalPageViews,
            auditLogs: totalAuditLogs,
          },
        },
        webhooks: {
          total: totalWebhooks,
          failed: failedWebhooks,
          successRate: totalWebhooks > 0 ? Math.round(((totalWebhooks - failedWebhooks) / totalWebhooks) * 100) : 100,
          lastResult: recentWebhook ? {
            success: recentWebhook.success,
            event: recentWebhook.event,
            date: recentWebhook.createdAt,
            responseCode: recentWebhook.responseCode,
          } : null,
        },
        security: {
          unresolvedAlerts,
          activeLocks,
          loginFailsLast24h,
          auditEventsLast24h: auditLast24h,
        },
        uptime: {
          serverStarted: new Date(Date.now() - process.uptime() * 1000).toISOString(),
          uptimeSeconds: Math.round(process.uptime()),
        },
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
