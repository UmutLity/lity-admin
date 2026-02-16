import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productStatusSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { detectRapidStatusChanges } from "@/lib/security";
import { getClientIp } from "@/lib/ip-utils";

// PATCH /api/admin/products/[id]/status - Quick status change
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();
    const ip = getClientIp(req);
    const userId = (session.user as any).id;

    const validation = productStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if status changes should affect last update
    const statusSetting = await prisma.siteSetting.findUnique({
      where: { key: "status_changes_affect_last_update" },
    });
    const statusAffectsUpdate = statusSetting?.value === "true";

    const updateData: any = {
      status: validation.data.status,
      statusNote: validation.data.statusNote,
      lastStatusChangeAt: new Date(),
    };

    if (statusAffectsUpdate) {
      updateData.lastUpdateAt = new Date();
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    });

    await createAuditLog({
      userId,
      action: "STATUS_CHANGE",
      entity: "Product",
      entityId: product.id,
      before: { status: existing.status, statusNote: existing.statusNote },
      after: { status: product.status, statusNote: product.statusNote },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Detect rapid status changes
    detectRapidStatusChanges().catch(() => {});

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PATCH /api/admin/products/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
