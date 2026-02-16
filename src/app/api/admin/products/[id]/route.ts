import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";
import { createAuditLog, diffObjects } from "@/lib/audit";

// GET /api/admin/products/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        prices: { orderBy: { plan: "asc" } },
        images: { include: { media: true }, orderBy: { order: "asc" } },
        features: { orderBy: { order: "asc" } },
        gallery: { orderBy: { order: "asc" } },
        specifications: { orderBy: { order: "asc" } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();

    const validation = productSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      include: { prices: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { prices, ...productData } = validation.data;

    // Check slug uniqueness if changed
    if (productData.slug !== existing.slug) {
      const slugExists = await prisma.product.findUnique({ where: { slug: productData.slug } });
      if (slugExists) {
        return NextResponse.json({ error: "This slug is already in use", errors: { slug: "This slug already exists" } }, { status: 400 });
      }
    }

    // Check if status changed
    const statusChanged = productData.status !== existing.status;

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...productData,
        buyUrl: productData.buyUrl || null,
        lastStatusChangeAt: statusChanged ? new Date() : existing.lastStatusChangeAt,
        prices: {
          deleteMany: {},
          create: prices?.map((p) => ({ plan: p.plan, price: p.price })) || [],
        },
      },
      include: { prices: true },
    });

    const diff = diffObjects(
      { name: existing.name, slug: existing.slug, status: existing.status },
      { name: product.name, slug: product.slug, status: product.status }
    );

    await createAuditLog({
      userId: (session.user as any).id,
      action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
      entity: "Product",
      entityId: product.id,
      before: diff.before,
      after: diff.after,
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PUT /api/admin/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Product",
      entityId: params.id,
      before: { name: product.name, slug: product.slug },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("DELETE /api/admin/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
