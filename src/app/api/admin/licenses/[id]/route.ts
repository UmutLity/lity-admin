import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const updateLicenseSchema = z.object({
  customerId: z.string().cuid().optional().nullable(),
  productId: z.string().cuid(),
  plan: z.string().min(1).max(40),
  key: z.string().min(3).max(120).regex(/^[a-zA-Z0-9_.-]+$/),
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]),
  expiresAt: z.string().datetime().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const validation = updateLicenseSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((entry) => {
        errors[entry.path.join(".")] = entry.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const current = await prisma.license.findUnique({
      where: { id: params.id },
      include: {
        product: { select: { name: true } },
        customer: { select: { username: true, email: true } },
      },
    });

    if (!current) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    const data = validation.data;
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, defaultLoaderUrl: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.defaultLoaderUrl) {
      return NextResponse.json({ error: "Selected product does not have a default Mega loader link yet" }, { status: 400 });
    }

    const normalizedKey = data.key.trim();
    const duplicate = await prisma.license.findFirst({
      where: {
        key: normalizedKey,
        NOT: { id: params.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: "This license key is already in use" }, { status: 409 });
    }

    const updated = await prisma.license.update({
      where: { id: params.id },
      data: {
        customerId: data.customerId || null,
        productId: data.productId,
        plan: data.plan.toUpperCase(),
        key: normalizedKey,
        status: data.status,
        downloadUrl: product.defaultLoaderUrl,
        note: data.note || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, username: true, email: true, isActive: true } },
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "License",
      entityId: updated.id,
      before: {
        key: current.key,
        product: current.product.name,
        customer: current.customer?.username || null,
        status: current.status,
      },
      after: {
        key: updated.key,
        product: updated.product.name,
        customer: updated.customer?.username || null,
        status: updated.status,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/licenses/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();

    const existing = await prisma.license.findUnique({
      where: { id: params.id },
      include: {
        product: { select: { name: true } },
        customer: { select: { username: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    await prisma.license.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "License",
      entityId: existing.id,
      before: {
        key: existing.key,
        product: existing.product.name,
        customer: existing.customer?.username || null,
        status: existing.status,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DELETE /api/admin/licenses/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
