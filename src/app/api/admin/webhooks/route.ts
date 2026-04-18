import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR", "SUPPORT"]);

    const { searchParams } = new URL(req.url);
    const status = String(searchParams.get("status") || "FAILED").toUpperCase();
    const limitRaw = Number(searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(limitRaw, 200));

    const where =
      status === "ALL"
        ? {}
        : status === "SUCCESS"
          ? { success: true }
          : { success: false };

    const deliveries = await prisma.webhookDelivery.findMany({
      where,
      include: {
        changelog: {
          select: { id: true, title: true, isDraft: true, publishedAt: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, data: deliveries });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/webhooks error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

