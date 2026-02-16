import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/settings
export async function GET() {
  try {
    await requireAdmin();
    const settings = await prisma.siteSetting.findMany({ orderBy: { group: "asc" } });
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/settings
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const ip = getClientIp(req);

    if (!body.settings || !Array.isArray(body.settings)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    for (const { key, value } of body.settings) {
      const existing = await prisma.siteSetting.findUnique({ where: { key } });
      if (existing) {
        before[key] = existing.value;
        after[key] = value;
        await prisma.siteSetting.update({ where: { key }, data: { value } });
      } else {
        // Create new setting if it doesn't exist
        after[key] = value;
        await prisma.siteSetting.create({
          data: { key, value, type: "string", group: "custom", label: key },
        });
      }
    }

    await createAuditLog({
      userId: (session.user as any).id,
      action: "SETTINGS_UPDATE",
      entity: "SiteSetting",
      before,
      after,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
