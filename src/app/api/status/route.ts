import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/status - Public status page data
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        status: true,
        statusNote: true,
        lastStatusChangeAt: true,
        lastUpdateAt: true,
        lastUpdateChangelogId: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Calculate uptime percentage (percentage of time in UNDETECTED in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const productsWithUptime = products.map((product) => {
      const history = product.statusHistory.filter((h) => new Date(h.createdAt) >= thirtyDaysAgo);
      // Simple: if currently UNDETECTED and mostly UNDETECTED, high uptime
      let uptimePercent = product.status === "UNDETECTED" ? 99.9 : product.status === "UPDATING" ? 85.0 : product.status === "MAINTENANCE" ? 70.0 : 0;

      // Adjust based on history
      if (history.length > 0) {
        const detectedEvents = history.filter((h) => h.toStatus === "DETECTED").length;
        uptimePercent = Math.max(0, uptimePercent - detectedEvents * 5);
      }

      return { ...product, uptimePercent: Math.round(uptimePercent * 10) / 10 };
    });

    return NextResponse.json({ success: true, data: productsWithUptime });
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
