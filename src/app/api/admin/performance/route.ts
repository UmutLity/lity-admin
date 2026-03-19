import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/performance - Fetch performance metrics summary
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const metrics = await prisma.performanceMetric.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    // Calculate avg response time
    const durations = metrics.map((m) => m.duration);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Slow endpoints (>500ms)
    const slowThreshold = 500;
    const slowEndpoints = metrics
      .filter((m) => m.duration > slowThreshold)
      .reduce(
        (acc, m) => {
          const path = m.path || "unknown";
          if (!acc[path]) acc[path] = { count: 0, avgDuration: 0, total: 0, lastSeen: m.createdAt };
          acc[path].count++;
          acc[path].total += m.duration;
          acc[path].avgDuration = acc[path].total / acc[path].count;
          if (m.createdAt > acc[path].lastSeen) acc[path].lastSeen = m.createdAt;
          return acc;
        },
        {} as Record<string, { count: number; avgDuration: number; total: number; lastSeen: Date }>
      );

    const slowList = Object.entries(slowEndpoints).map(([path, data]) => ({
      path,
      count: data.count,
      avgDuration: Math.round(data.avgDuration * 100) / 100,
      lastSeen: data.lastSeen,
    }));

    // Recent metrics (last 50)
    const recentMetrics = metrics.slice(0, 50).map((m) => ({
      id: m.id,
      type: m.type,
      path: m.path,
      duration: m.duration,
      createdAt: m.createdAt,
    }));

    // Error rate (if meta contains error info - assuming type or meta indicates errors)
    const errorMetrics = metrics.filter((m) => {
      if (!m.meta) return false;
      try {
        const meta = JSON.parse(m.meta);
        return meta.error === true || meta.statusCode >= 400;
      } catch {
        return false;
      }
    });
    const errorRate =
      metrics.length > 0 ? (errorMetrics.length / metrics.length) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        avgResponseTime: Math.round(avgDuration * 100) / 100,
        totalMetrics: metrics.length,
        slowEndpoints: slowList,
        errorRate: Math.round(errorRate * 100) / 100,
        recentMetrics,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Performance GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/performance - Record a new metric (unprotected - called from client)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, path, duration, meta } = body;

    if (!type || typeof duration !== "number") {
      return NextResponse.json(
        { success: false, error: "type and duration are required" },
        { status: 400 }
      );
    }

    const metric = await prisma.performanceMetric.create({
      data: {
        type,
        path: path || null,
        duration,
        meta: meta ? (typeof meta === "string" ? meta : JSON.stringify(meta)) : null,
      },
    });

    return NextResponse.json({ success: true, data: metric }, { status: 201 });
  } catch (error: unknown) {
    console.error("Performance POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
