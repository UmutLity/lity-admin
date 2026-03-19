import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/admin/weekly-report - Weekly transparency report (public, no auth)
export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Total changelogs published this week (publishedAt >= 7 days ago means within last 7 days)
    const updatesThisWeek = await prisma.changelog.count({
      where: {
        isDraft: false,
        publishedAt: { gte: sevenDaysAgo },
      },
    });

    // Products improved (products linked to changelogs this week)
    const changelogsThisWeek = await prisma.changelog.findMany({
      where: {
        isDraft: false,
        publishedAt: { gte: sevenDaysAgo },
      },
      select: { id: true },
    });
    const changelogIds = changelogsThisWeek.map((c) => c.id);
    const productLinks = changelogIds.length
      ? await prisma.changelogProduct.findMany({
          where: { changelogId: { in: changelogIds } },
          select: { productId: true },
        })
      : [];
    const productsImproved = new Set(productLinks.map((p) => p.productId)).size;

    // Status distribution of all products
    const statusGroups = await prisma.product.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const statusDistribution = statusGroups.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalProducts = await prisma.product.count();

    // Uptime % (products with UNDETECTED status / total * 100)
    const undetectedCount = await prisma.product.count({
      where: { status: "UNDETECTED" },
    });
    const uptimePercent = totalProducts > 0 ? (undetectedCount / totalProducts) * 100 : 100;

    // Stability index (products that didn't change status in 7 days / total * 100)
    const productsWithRecentChange = await prisma.product.count({
      where: { lastStatusChangeAt: { gte: sevenDaysAgo } },
    });
    const stableProducts = totalProducts - productsWithRecentChange;
    const stabilityIndex = totalProducts > 0 ? (stableProducts / totalProducts) * 100 : 100;

    // Days since last DETECTED event (from StatusHistory)
    const lastDetectedEvent = await prisma.statusHistory.findFirst({
      where: { toStatus: "DETECTED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const daysSinceLastDetection = lastDetectedEvent
      ? Math.floor(
          (now.getTime() - lastDetectedEvent.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;

    // Growth metrics: pageViews this week vs last week
    const [pageViewsThisWeek, pageViewsLastWeek] = await Promise.all([
      prisma.pageView.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.pageView.count({
        where: {
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);
    const growthPercent =
      pageViewsLastWeek > 0
        ? ((pageViewsThisWeek - pageViewsLastWeek) / pageViewsLastWeek) * 100
        : pageViewsThisWeek > 0
          ? 100
          : 0;

    return NextResponse.json({
      success: true,
      data: {
        updatesThisWeek,
        productsImproved,
        uptimePercent: Math.round(uptimePercent * 10) / 10,
        stabilityIndex: Math.round(stabilityIndex * 10) / 10,
        daysSinceLastDetection,
        statusDistribution,
        growth: {
          pageViewsThisWeek,
          pageViewsLastWeek,
          growthPercent: Math.round(growthPercent * 10) / 10,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
