import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/products/[id]/environments
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const environments = await prisma.productEnvironment.findMany({
      where: { productId: params.id },
      orderBy: { environment: "asc" },
    });

    // If no environments exist, create defaults
    if (environments.length === 0) {
      const product = await prisma.product.findUnique({ where: { id: params.id } });
      if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

      const defaults = ["PRODUCTION", "BETA", "EXPERIMENTAL"];
      const created = [];
      for (const env of defaults) {
        const e = await prisma.productEnvironment.create({
          data: {
            productId: params.id,
            environment: env,
            status: env === "PRODUCTION" ? product.status : "UNDETECTED",
            statusNote: env === "PRODUCTION" ? product.statusNote : null,
          },
        });
        created.push(e);
      }
      return NextResponse.json({ success: true, data: created });
    }

    return NextResponse.json({ success: true, data: environments });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/environments
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "product.status.change");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { environment, status, statusNote } = body;

    if (!environment || !status) {
      return NextResponse.json({ success: false, error: "Environment and status are required" }, { status: 400 });
    }

    const env = await prisma.productEnvironment.findUnique({
      where: { productId_environment: { productId: params.id, environment } },
    });

    if (!env) {
      return NextResponse.json({ success: false, error: "Environment not found" }, { status: 404 });
    }

    const before = { ...env };
    const updated = await prisma.productEnvironment.update({
      where: { id: env.id },
      data: {
        status,
        statusNote: statusNote !== undefined ? statusNote : env.statusNote,
        lastStatusChangeAt: status !== env.status ? new Date() : env.lastStatusChangeAt,
        lastUpdateAt: new Date(),
      },
    });

    // If updating PRODUCTION, also update the main product
    if (environment === "PRODUCTION") {
      await prisma.product.update({
        where: { id: params.id },
        data: {
          status,
          statusNote: statusNote !== undefined ? statusNote : undefined,
          lastStatusChangeAt: status !== env.status ? new Date() : undefined,
        },
      });

      // Add status history
      if (status !== env.status) {
        await prisma.statusHistory.create({
          data: {
            productId: params.id,
            fromStatus: env.status,
            toStatus: status,
            note: statusNote || null,
          },
        });
      }
    }

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "STATUS_CHANGE",
      entity: "ProductEnvironment",
      entityId: env.id,
      before,
      after: updated,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
