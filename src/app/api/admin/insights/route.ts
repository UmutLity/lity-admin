import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/insights - Fetch all insight events with optional filters
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const severity = searchParams.get("severity");
    const resolved = searchParams.get("resolved");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved === "true") where.resolvedAt = { not: null };
    if (resolved === "false") where.resolvedAt = null;

    const insights = await prisma.insightEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: insights });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Insights GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/insights - Run anomaly detection scan
export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const created: string[] = [];

    // 1. Traffic spike: today's pageviews > 200% of avg(last 7 days)
    const todayPageviews = await prisma.pageView.count({
      where: { createdAt: { gte: todayStart } },
    });
    const last7DaysPageviews = await prisma.pageView.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    const avg7Days = last7DaysPageviews / 7;
    if (avg7Days > 0 && todayPageviews > avg7Days * 2) {
      const existing = await prisma.insightEvent.findFirst({
        where: {
          type: "TRAFFIC_SPIKE",
          createdAt: { gte: todayStart },
          resolvedAt: null,
        },
      });
      if (!existing) {
        await prisma.insightEvent.create({
          data: {
            type: "TRAFFIC_SPIKE",
            severity: "WARNING",
            message: `Traffic spike detected: ${todayPageviews} pageviews today vs avg ${avg7Days.toFixed(0)} (last 7 days)`,
            meta: JSON.stringify({ todayPageviews, avg7Days }),
          },
        });
        created.push("TRAFFIC_SPIKE");
      }
    }

    // 2. Traffic drop: today's pageviews < 50% of avg(last 7 days)
    if (avg7Days > 0 && todayPageviews < avg7Days * 0.5) {
      const existing = await prisma.insightEvent.findFirst({
        where: {
          type: "TRAFFIC_DROP",
          createdAt: { gte: todayStart },
          resolvedAt: null,
        },
      });
      if (!existing) {
        await prisma.insightEvent.create({
          data: {
            type: "TRAFFIC_DROP",
            severity: "WARNING",
            message: `Traffic drop detected: ${todayPageviews} pageviews today vs avg ${avg7Days.toFixed(0)} (last 7 days)`,
            meta: JSON.stringify({ todayPageviews, avg7Days }),
          },
        });
        created.push("TRAFFIC_DROP");
      }
    }

    // 3. Status instability: any product with >3 status changes in last 7 days
    const statusChanges = await prisma.statusHistory.groupBy({
      by: ["productId"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    });
    for (const sc of statusChanges) {
      if (sc._count.id > 3) {
        const product = await prisma.product.findUnique({
          where: { id: sc.productId },
          select: { name: true },
        });
        const existing = await prisma.insightEvent.findFirst({
          where: {
            type: "STATUS_INSTABILITY",
            relatedEntity: sc.productId,
            createdAt: { gte: sevenDaysAgo },
            resolvedAt: null,
          },
        });
        if (!existing) {
          await prisma.insightEvent.create({
            data: {
              type: "STATUS_INSTABILITY",
              severity: "INFO",
              message: `Product "${product?.name || sc.productId}" had ${sc._count.id} status changes in the last 7 days`,
              relatedEntity: sc.productId,
              meta: JSON.stringify({ changeCount: sc._count.id }),
            },
          });
          created.push("STATUS_INSTABILITY");
        }
      }
    }

    // 4. Long updating: any product in UPDATING status for >3 days
    const updatingProducts = await prisma.product.findMany({
      where: {
        status: "UPDATING",
        lastStatusChangeAt: { lte: threeDaysAgo },
      },
    });
    for (const p of updatingProducts) {
      const existing = await prisma.insightEvent.findFirst({
        where: {
          type: "LONG_UPDATING",
          relatedEntity: p.id,
          createdAt: { gte: threeDaysAgo },
          resolvedAt: null,
        },
      });
      if (!existing) {
        await prisma.insightEvent.create({
          data: {
            type: "LONG_UPDATING",
            severity: "WARNING",
            message: `Product "${p.name}" has been in UPDATING status for over 3 days`,
            relatedEntity: p.id,
            meta: JSON.stringify({
              lastStatusChangeAt: p.lastStatusChangeAt?.toISOString(),
            }),
          },
        });
        created.push("LONG_UPDATING");
      }
    }

    // 5. Webhook failures: >5 failed webhook deliveries in last 24h
    const failedWebhooks = await prisma.webhookDelivery.count({
      where: {
        success: false,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });
    if (failedWebhooks > 5) {
      const existing = await prisma.insightEvent.findFirst({
        where: {
          type: "WEBHOOK_FAILURE",
          createdAt: { gte: twentyFourHoursAgo },
          resolvedAt: null,
        },
      });
      if (!existing) {
        await prisma.insightEvent.create({
          data: {
            type: "WEBHOOK_FAILURE",
            severity: "CRITICAL",
            message: `${failedWebhooks} failed webhook deliveries in the last 24 hours`,
            meta: JSON.stringify({ failedCount: failedWebhooks }),
          },
        });
        created.push("WEBHOOK_FAILURE");
      }
    }

    // 6. Security anomaly: >10 failed login attempts in last 24h
    const failedLogins = await prisma.loginAttempt.count({
      where: {
        success: false,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });
    if (failedLogins > 10) {
      const existing = await prisma.insightEvent.findFirst({
        where: {
          type: "SECURITY_ANOMALY",
          createdAt: { gte: twentyFourHoursAgo },
          resolvedAt: null,
        },
      });
      if (!existing) {
        await prisma.insightEvent.create({
          data: {
            type: "SECURITY_ANOMALY",
            severity: "CRITICAL",
            message: `${failedLogins} failed login attempts in the last 24 hours`,
            meta: JSON.stringify({ failedCount: failedLogins }),
          },
        });
        created.push("SECURITY_ANOMALY");
      }
    }

    return NextResponse.json({ success: true, data: { created } }, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Insights scan error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/insights - Resolve an insight
export async function PATCH(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const insight = await prisma.insightEvent.findUnique({ where: { id } });
    if (!insight) {
      return NextResponse.json({ success: false, error: "Insight not found" }, { status: 404 });
    }

    const updated = await prisma.insightEvent.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Insights PATCH error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
