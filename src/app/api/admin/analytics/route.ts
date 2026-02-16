import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/analytics
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30");

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // ── Traffic KPIs ──────────────────────────────────────
    const [totalViews, totalSessions, todayViews, yesterdayViews, todaySessions, yesterdaySessions] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: startDate } } }),
      prisma.analyticsSession.count({ where: { createdAt: { gte: startDate } } }),
      prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.pageView.count({ where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } } }),
      prisma.analyticsSession.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.analyticsSession.count({ where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } } }),
    ]);

    // Unique visitors (unique ipHash)
    const uniqueVisitors = await prisma.pageView.groupBy({
      by: ["ipHash"],
      where: { createdAt: { gte: startDate } },
    });

    // Bounce rate (sessions with 1 pageview)
    const allSessionIds = await prisma.analyticsSession.findMany({
      where: { createdAt: { gte: startDate } },
      select: { id: true },
    });
    let bounceCount = 0;
    if (allSessionIds.length > 0) {
      const sessionViewCounts = await prisma.pageView.groupBy({
        by: ["sessionId"],
        where: { sessionId: { not: null }, createdAt: { gte: startDate } },
        _count: { id: true },
      });
      bounceCount = sessionViewCounts.filter((s) => s._count.id === 1).length;
    }
    const bounceRate = allSessionIds.length > 0 ? (bounceCount / allSessionIds.length) * 100 : 0;

    // Average session duration
    const sessionsWithDuration = await prisma.analyticsSession.findMany({
      where: { createdAt: { gte: startDate } },
      select: { firstSeenAt: true, lastSeenAt: true },
    });
    const totalDuration = sessionsWithDuration.reduce((sum, s) => {
      return sum + (s.lastSeenAt.getTime() - s.firstSeenAt.getTime());
    }, 0);
    const avgSessionDuration = sessionsWithDuration.length > 0 ? totalDuration / sessionsWithDuration.length / 1000 : 0;

    // ── Daily views (last N days) ─────────────────────────
    const dailyViews: { date: string; views: number; sessions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [dayViews, daySessions] = await Promise.all([
        prisma.pageView.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
        prisma.analyticsSession.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
      ]);

      dailyViews.push({
        date: dayStart.toISOString().split("T")[0],
        views: dayViews,
        sessions: daySessions,
      });
    }

    // ── Top pages ─────────────────────────────────────────
    const topPages = await prisma.pageView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // ── Top referrers ─────────────────────────────────────
    const topReferrers = await prisma.analyticsSession.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: startDate }, referrer: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // ── Device distribution ────────────────────────────────
    const deviceDist = await prisma.analyticsSession.groupBy({
      by: ["deviceType"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });

    // ── Top entry pages ───────────────────────────────────
    const topEntryPages = await prisma.analyticsSession.groupBy({
      by: ["entryPath"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // ── Top exit pages ────────────────────────────────────
    const topExitPages = await prisma.analyticsSession.groupBy({
      by: ["exitPath"],
      where: { createdAt: { gte: startDate }, exitPath: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // ── Product stats ─────────────────────────────────────
    const [totalProducts, activeProducts] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    const statusDist = await prisma.product.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    // ── Changelog stats ───────────────────────────────────
    const [totalChangelogs, recentChangelogs] = await Promise.all([
      prisma.changelog.count({ where: { isDraft: false } }),
      prisma.changelog.count({ where: { isDraft: false, createdAt: { gte: startDate } } }),
    ]);

    // ── Customer stats ────────────────────────────────────
    const [totalCustomers, newCustomers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: startDate } } }),
    ]);

    // ── Funnel data ───────────────────────────────────────
    const funnelHomepage = await prisma.pageView.count({
      where: { path: "/", createdAt: { gte: startDate } },
    });
    const funnelProductView = await prisma.analyticsEvent.count({
      where: { name: "VIEW_PRODUCT", createdAt: { gte: startDate } },
    });
    const funnelCheckout = await prisma.analyticsEvent.count({
      where: { name: "CHECKOUT_CLICK", createdAt: { gte: startDate } },
    });
    const funnelAddToCart = await prisma.analyticsEvent.count({
      where: { name: "ADD_TO_CART", createdAt: { gte: startDate } },
    });

    // ── Events summary ────────────────────────────────────
    const eventsSummary = await prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    return NextResponse.json({
      success: true,
      data: {
        traffic: {
          totalViews,
          totalSessions,
          uniqueVisitors: uniqueVisitors.length,
          todayViews,
          yesterdayViews,
          todaySessions,
          yesterdaySessions,
          bounceRate: Math.round(bounceRate * 10) / 10,
          avgSessionDuration: Math.round(avgSessionDuration),
          dailyViews,
          topPages: topPages.map((p) => ({ path: p.path, count: p._count.id })),
          topReferrers: topReferrers.map((r) => ({ referrer: r.referrer, count: r._count.id })),
          topEntryPages: topEntryPages.map((p) => ({ path: p.entryPath, count: p._count.id })),
          topExitPages: topExitPages.map((p) => ({ path: p.exitPath, count: p._count.id })),
          deviceDistribution: deviceDist.map((d) => ({ device: d.deviceType, count: d._count.id })),
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          statusDistribution: statusDist.map((s) => ({ status: s.status, count: s._count.id })),
        },
        changelogs: {
          total: totalChangelogs,
          recent: recentChangelogs,
        },
        customers: {
          total: totalCustomers,
          newInPeriod: newCustomers,
        },
        funnel: {
          homepage: funnelHomepage,
          productView: funnelProductView,
          addToCart: funnelAddToCart,
          checkout: funnelCheckout,
        },
        events: eventsSummary.map((e) => ({ name: e.name, count: e._count.id })),
      },
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
