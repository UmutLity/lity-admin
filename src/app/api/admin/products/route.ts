import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2021" || error.code === "P2022";
}

function asKnownRequestError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error : null;
}

function withProductDefaults<T extends Record<string, any>>(product: T) {
  return {
    ...product,
    stockStatus: product.stockStatus || "IN_STOCK",
    deliveryType: product.deliveryType || "MANUAL",
    estimatedDelivery: product.estimatedDelivery || null,
    prices: Array.isArray(product.prices) ? product.prices : [],
    images: Array.isArray(product.images) ? product.images : [],
    _count: product._count || { changelogs: 0 },
  };
}

async function loadProductListFallback(where: any) {
  try {
    return await prisma.product.findMany({
      where,
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
        lastStatusChangeAt: true,
        isFeatured: true,
        isActive: true,
        currency: true,
        buyUrl: true,
        accessRoleKey: true,
        defaultLoaderUrl: true,
        sortOrder: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        lastUpdateAt: true,
        lastUpdateChangelogId: true,
        prices: { orderBy: { plan: "asc" } },
        images: {
          include: { media: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  } catch (fallbackError) {
    console.warn("GET /api/admin/products fallback query degraded to minimal fields", fallbackError);
    return prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        status: true,
        statusNote: true,
        isFeatured: true,
        isActive: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        lastUpdateAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  }
}

// GET /api/admin/products - Admin: all products
export async function GET(req: NextRequest) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;

    let products: any[] = [];

    try {
      products = await prisma.product.findMany({
        where,
        include: {
          prices: { orderBy: { plan: "asc" } },
          images: { include: { media: true }, orderBy: { order: "asc" } },
          _count: { select: { changelogs: true } },
        },
        orderBy: { sortOrder: "asc" },
      });
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        console.warn("GET /api/admin/products schema mismatch fallback enabled");
      } else {
        console.warn("GET /api/admin/products primary query failed, trying fallback", error);
      }
      products = await loadProductListFallback(where);
    }

    return NextResponse.json({ success: true, data: products.map(withProductDefaults) });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products - Create new product
export async function POST(req: NextRequest) {
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

    const { prices, features, ...productData } = validation.data;

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({ where: { slug: productData.slug } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already in use", errors: { slug: "Slug already exists" } }, { status: 400 });
    }

    let product: any;
    try {
      product = await prisma.product.create({
        data: {
          ...productData,
          buyUrl: productData.buyUrl || null,
          accessRoleKey: productData.accessRoleKey || null,
          defaultLoaderUrl: productData.defaultLoaderUrl || null,
          estimatedDelivery: productData.estimatedDelivery || null,
          prices: prices?.length
            ? { create: prices.map((p) => ({ plan: p.plan, price: p.price })) }
            : undefined,
          features: features?.length
            ? {
                create: features.map((feature, index) => ({
                  title: feature.title,
                  description: feature.description || null,
                  icon: feature.icon || null,
                  order: feature.order ?? index,
                })),
              }
            : undefined,
        },
        include: { prices: true, features: { orderBy: { order: "asc" } } },
      });
    } catch (error: unknown) {
      const known = asKnownRequestError(error);
      if (isSchemaMismatchError(error)) {
        console.error("POST /api/admin/products schema mismatch:", {
          code: known?.code,
          meta: known?.meta,
        });
        return NextResponse.json(
          {
            success: false,
            code: "DB_SCHEMA_MISMATCH",
            error: "Database schema is out of date. Run migrations.",
          },
          { status: 500 }
        );
      }

      if (known?.code === "P2002") {
        return NextResponse.json(
          {
            success: false,
            code: "PRODUCT_CREATE_FAILED",
            error: "Unique constraint failed while creating product.",
          },
          { status: 400 }
        );
      }

      console.error("POST /api/admin/products create failed:", {
        code: known?.code,
        meta: known?.meta,
        error,
      });
      return NextResponse.json(
        {
          success: false,
          code: "PRODUCT_CREATE_FAILED",
          error: "Product could not be created.",
        },
        { status: 500 }
      );
    }

    try {
      await createAuditLog({
        userId: (session.user as any).id,
        action: "CREATE",
        entity: "Product",
        entityId: product.id,
        after: { name: product.name, slug: product.slug, status: product.status },
      });
    } catch (error: unknown) {
      const known = asKnownRequestError(error);
      if (isSchemaMismatchError(error)) {
        console.error("POST /api/admin/products audit schema mismatch:", {
          code: known?.code,
          meta: known?.meta,
        });
        return NextResponse.json(
          {
            success: false,
            code: "DB_SCHEMA_MISMATCH",
            error: "Database schema is out of date. Run migrations.",
          },
          { status: 500 }
        );
      }
      console.error("POST /api/admin/products audit failed:", {
        code: known?.code,
        meta: known?.meta,
        error,
      });
      return NextResponse.json(
        {
          success: false,
          code: "PRODUCT_CREATE_FAILED",
          error: "Product created but audit log could not be written.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const known = asKnownRequestError(error);
    if (isSchemaMismatchError(error)) {
      console.error("POST /api/admin/products top-level schema mismatch:", {
        code: known?.code,
        meta: known?.meta,
      });
      return NextResponse.json(
        {
          success: false,
          code: "DB_SCHEMA_MISMATCH",
          error: "Database schema is out of date. Run migrations.",
        },
        { status: 500 }
      );
    }

    console.error("POST /api/admin/products error:", {
      code: known?.code,
      meta: known?.meta,
      error,
    });
    return NextResponse.json(
      {
        success: false,
        code: "PRODUCT_CREATE_FAILED",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
