import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/security/alerts - List alerts
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.view");
    if (!hasPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const unresolvedOnly = searchParams.get("unresolved") === "true";

    const alerts = await prisma.securityAlert.findMany({
      where: unresolvedOnly ? { resolvedAt: null } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: alerts });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/security/alerts - Resolve an alert
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.manage");
    if (!hasPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { alertId } = await req.json();
    if (!alertId) {
      return NextResponse.json({ success: false, error: "alertId required" }, { status: 400 });
    }

    const alert = await prisma.securityAlert.update({
      where: { id: alertId },
      data: { resolvedAt: new Date() },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "UPDATE",
      entity: "Security",
      entityId: alertId,
      after: { resolved: true, type: alert.type },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: alert });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
