import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/seo - SEO analysis data
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    // Most visited pages (grouped by path, order by count desc, limit 20)
    const pageStats = await prisma.pageView.groupBy({
      by: ["path"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    // For each path, get the most recent pageView that has title
    const pages = await Promise.all(
      pageStats.map(async (p) => {
        const latestWithTitle = await prisma.pageView.findFirst({
          where: { path: p.path, title: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { title: true },
        });
        const generated =
          p.path === "/"
            ? "Home"
            : p.path
                .replace(/^\//, "")
                .replace(/-/g, " ")
                .replace(/\//g, " > ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
        const title = latestWithTitle?.title ?? generated;
        return {
          path: p.path,
          views: p._count.id,
          title,
        };
      })
    );

    // Traffic source breakdown: direct (empty referrer) vs referral/organic (has referrer)
    const [directCount, referralCount] = await Promise.all([
      prisma.pageView.count({ where: { referrer: null } }),
      prisma.pageView.count({ where: { referrer: { not: null } } }),
    ]);

    const trafficSources = {
      direct: directCount,
      referral: referralCount,
      organic: referralCount, // Simplified: treat referral = organic for this breakdown
    };

    // SEO health score (pages with >100 views get +points, etc.)
    let healthScore = 50; // Base score
    const totalViews = pages.reduce((sum, p) => sum + p.views, 0);
    if (totalViews > 1000) healthScore += 15;
    else if (totalViews > 500) healthScore += 10;
    else if (totalViews > 100) healthScore += 5;

    const highTrafficPages = pages.filter((p) => p.views > 100).length;
    if (highTrafficPages >= 5) healthScore += 10;
    else if (highTrafficPages >= 2) healthScore += 5;

    const pagesWithTitles = pages.filter((p) => p.title && p.title !== p.path).length;
    if (pagesWithTitles === pages.length && pages.length > 0) healthScore += 10;
    else if (pagesWithTitles > pages.length / 2) healthScore += 5;

    if (trafficSources.referral + trafficSources.organic > 0) healthScore += 5;

    healthScore = Math.min(100, healthScore);

    // Suggestions
    const suggestions: { message: string; severity: string }[] = [];
    if (pages.some((p) => !p.title || p.title === p.path))
      suggestions.push({
        message: "Some pages lack descriptive titles. Add unique page titles for better SEO.",
        severity: "warning",
      });
    if (trafficSources.direct > (trafficSources.referral + trafficSources.organic) * 2)
      suggestions.push({
        message: "Most traffic is direct. Consider improving organic/referral channels.",
        severity: "info",
      });
    if (healthScore < 60)
      suggestions.push({
        message: "SEO health is below average. Focus on high-traffic page optimization.",
        severity: "warning",
      });
    if (healthScore >= 80)
      suggestions.push({
        message: "SEO health is good. Keep monitoring and optimizing.",
        severity: "info",
      });

    return NextResponse.json({
      success: true,
      data: {
        pages,
        trafficSources,
        healthScore,
        suggestions,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("SEO route error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
