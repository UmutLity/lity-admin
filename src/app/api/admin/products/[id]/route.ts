import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";
import { createAuditLog, diffObjects } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function isForeignKeyDeleteError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

function withDetailDefaults<T extends Record<string, any>>(product: T) {
  return {
    ...product,
    shortDescription: product.shortDescription || null,
    description: product.description || null,
    longDescription: product.longDescription || null,
    technicalDescription: product.technicalDescription || null,
    featureSectionTitle: product.featureSectionTitle || null,
    statusNote: product.statusNote || null,
    buyUrl: product.buyUrl || null,
    accessRoleKey: product.accessRoleKey || null,
    defaultLoaderUrl: product.defaultLoaderUrl || null,
    stockStatus: product.stockStatus || "IN_STOCK",
    deliveryType: product.deliveryType || "MANUAL",
    estimatedDelivery: product.estimatedDelivery || null,
    prices: Array.isArray(product.prices) ? product.prices : [],
    features: Array.isArray(product.features) ? product.features : [],
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    specifications: Array.isArray(product.specifications) ? product.specifications : [],
    images: Array.isArray(product.images) ? product.images : [],
  };
}

async function findProductDetailBase(id: string) {
  try {
    const product = await prisma.product.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        longDescription: true,
        technicalDescription: true,
        featureSectionTitle: true,
        category: true,
        status: true,
        statusNote: true,
        isFeatured: true,
        isActive: true,
        currency: true,
        buyUrl: true,
        accessRoleKey: true,
        defaultLoaderUrl: true,
        stockStatus: true,
        deliveryType: true,
        estimatedDelivery: true,
        sortOrder: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (product) return product;
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<Record<string, any>>>(
    Prisma.sql`
      SELECT
        "id",
        "name",
        "slug",
        "shortDescription",
        "description",
        "longDescription",
        "technicalDescription",
        "featureSectionTitle",
        "category",
        "status",
        "statusNote",
        "isFeatured",
        "isActive",
        "currency",
        "buyUrl",
        "sortOrder",
        "displayOrder",
        "createdAt",
        "updatedAt"
      FROM "Product"
      WHERE "id" = ${id}
      LIMIT 1
    `
  );

  return rows[0] || null;
}

async function safeLoadProductRelations(id: string) {
  const result: Record<string, any[]> = {
    prices: [],
    features: [],
    gallery: [],
    specifications: [],
  };

  try {
    result.prices = await prisma.productPrice.findMany({
      where: { productId: id },
      orderBy: { plan: "asc" },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    result.features = await prisma.productFeature.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    result.gallery = await prisma.productGalleryImage.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    result.specifications = await prisma.productSpecification.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  return result;
}

async function findProductForDelete(id: string) {
  try {
    return await prisma.product.findFirst({
      where: { id },
      select: { id: true, name: true, slug: true, isActive: true, status: true },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string; isActive: boolean; status: string }>>(
      Prisma.sql`SELECT "id", "name", "slug", "isActive", "status" FROM "Product" WHERE "id" = ${id} LIMIT 1`
    );
    return rows[0] || null;
  }
}

async function archiveProductFallback(id: string) {
  try {
    return await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        isFeatured: false,
        status: "DISCONTINUED",
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      UPDATE "Product"
      SET
        "isActive" = false,
        "isFeatured" = false,
        "status" = 'DISCONTINUED',
        "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
      RETURNING "id"
    `
  );
  return rows[0] || null;
}

async function deleteProductWithFallbacks(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    return { mode: "deleted" as const };
  } catch (error) {
    if (!isForeignKeyDeleteError(error) && !isSchemaMismatchError(error)) {
      throw error;
    }
  }

  const archived = await archiveProductFallback(id);
  if (!archived) {
    throw new Error("Archive fallback failed");
  }
  return { mode: "archived" as const };
}

// GET /api/admin/products/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const product = await findProductDetailBase(params.id);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const relations = await safeLoadProductRelations(params.id);

    return NextResponse.json({ success: true, data: withDetailDefaults({ ...product, ...relations }) });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/admin/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);
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
      include: { prices: true, features: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { prices, features, ...productData } = validation.data;

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
        accessRoleKey: productData.accessRoleKey || null,
        defaultLoaderUrl: productData.defaultLoaderUrl || null,
        estimatedDelivery: productData.estimatedDelivery || null,
        lastStatusChangeAt: statusChanged ? new Date() : existing.lastStatusChangeAt,
        prices: {
          deleteMany: {},
          create: prices?.map((p) => ({ plan: p.plan, price: p.price })) || [],
        },
        ...(features
          ? {
              features: {
                deleteMany: {},
                create: features.map((feature, index) => ({
                  title: feature.title,
                  description: feature.description || null,
                  icon: feature.icon || null,
                  order: feature.order ?? index,
                })),
              },
            }
          : {}),
      },
      include: { prices: true, features: { orderBy: { order: "asc" } } },
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
    const session = await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const product = await findProductForDelete(params.id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await deleteProductWithFallbacks(params.id);

    await createAuditLog({
      userId: (session.user as any).id,
      action: result.mode === "deleted" ? "DELETE" : "UPDATE",
      entity: "Product",
      entityId: params.id,
      before: { name: product.name, slug: product.slug, isActive: product.isActive, status: product.status },
      after: result.mode === "archived" ? { isActive: false, status: "DISCONTINUED" } : null,
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      message: result.mode === "deleted"
        ? "Product deleted successfully."
        : "Product has linked records, so it was archived instead of being deleted.",
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("DELETE /api/admin/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
