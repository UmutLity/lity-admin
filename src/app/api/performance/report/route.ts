import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/performance/report - Accept Web Vitals data from client (PUBLIC)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { metrics } = body;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { success: false, error: "metrics array is required" },
        { status: 400 }
      );
    }

    for (const m of metrics) {
      const { name, value, path } = m;
      if (name == null || typeof value !== "number") continue;

      await prisma.performanceMetric.create({
        data: {
          type: "PAGE_LOAD",
          path: path || null,
          duration: value,
          meta: JSON.stringify({ name }),
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error("Performance report error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
