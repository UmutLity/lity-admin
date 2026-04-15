import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productStatusSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { detectRapidStatusChanges } from "@/lib/security";
import { getClientIp } from "@/lib/ip-utils";
import { sendProductStatusNotificationToDiscord } from "@/lib/discord";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

async function findProductSafe(productId: string) {
  try {
    return await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        statusNote: true,
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const fallback = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
    return fallback ? { ...fallback, slug: "", statusNote: null } : null;
  }
}

async function updateProductStatusSafe(productId: string, status: string, statusNote: string | null | undefined, affectLastUpdate: boolean) {
  const nextData: Record<string, any> = {
    status,
    statusNote: statusNote ?? null,
    lastStatusChangeAt: new Date(),
  };

  if (affectLastUpdate) {
    nextData.lastUpdateAt = new Date();
  }

  try {
    return await prisma.product.update({
      where: { id: productId },
      data: nextData,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        statusNote: true,
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const fallback = await prisma.product.update({
      where: { id: productId },
      data: { status },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
    return { ...fallback, slug: "", statusNote: null };
  }
}

// PATCH /api/admin/products/[id]/status - Quick status change
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);
    const body = await req.json();
    const ip = getClientIp(req);
    const userId = (session.user as any).id;

    const validation = productStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const existing = await findProductSafe(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if status changes should affect last update
    const statusSetting = await prisma.siteSetting.findUnique({
      where: { key: "status_changes_affect_last_update" },
    });
    const statusAffectsUpdate = statusSetting?.value === "true";

    const product = await updateProductStatusSafe(
      params.id,
      validation.data.status,
      validation.data.statusNote,
      statusAffectsUpdate
    );

    try {
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
    } catch (auditError) {
      console.warn("Product status audit log skipped:", auditError);
    }

    // Detect rapid status changes
    detectRapidStatusChanges().catch((err) => {
      console.warn("detectRapidStatusChanges failed:", err);
    });

    // Notify Discord webhook (if enabled)
    sendProductStatusNotificationToDiscord({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug || "",
      fromStatus: existing.status,
      toStatus: product.status,
      statusNote: product.statusNote,
    }).catch((err) => {
      console.error("Product status Discord webhook error:", err);
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PATCH /api/admin/products/[id]/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
