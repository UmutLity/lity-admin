import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
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

function buildProductCreateData(
  productData: Omit<ProductFormData, "prices" | "features">,
  prices?: ProductFormData["prices"],
  features?: ProductFormData["features"]
): Prisma.ProductCreateInput {
  return {
    ...productData,
    buyUrl: productData.buyUrl || null,
    accessRoleKey: null,
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
  };
}

function buildMinimalProductCreateData(
  productData: Omit<ProductFormData, "prices" | "features">
): Prisma.ProductUncheckedCreateInput {
  return {
    name: productData.name,
    slug: productData.slug,
    shortDescription: productData.shortDescription || null,
    description: productData.description || null,
    category: productData.category,
    status: productData.status,
    isFeatured: Boolean(productData.isFeatured),
    isActive: Boolean(productData.isActive),
    currency: productData.currency || "USD",
    buyUrl: productData.buyUrl || null,
    sortOrder: Number(productData.sortOrder || 0),
  };
}

async function productSlugExists(slug: string) {
  try {
    const existing = await prisma.product.findFirst({
      where: { slug },
      select: { id: true },
    });
    return Boolean(existing);
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.warn("POST /api/admin/products slug lookup schema mismatch, retrying with raw SQL");
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "slug" = ${slug} LIMIT 1`
  );
  return rows.length > 0;
}

async function createProductWithRawFallback(
  productData: Omit<ProductFormData, "prices" | "features">
) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      slug: string;
      shortDescription: string | null;
      description: string | null;
      longDescription: string | null;
      technicalDescription: string | null;
      featureSectionTitle: string | null;
      category: string;
      status: string;
      statusNote: string | null;
      isFeatured: boolean;
      isActive: boolean;
      currency: string;
      buyUrl: string | null;
      sortOrder: number;
      displayOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    INSERT INTO "Product" (
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
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${productData.name},
      ${productData.slug},
      ${productData.shortDescription || null},
      ${productData.description || null},
      ${productData.longDescription || null},
      ${productData.technicalDescription || null},
      ${productData.featureSectionTitle || null},
      ${productData.category},
      ${productData.status},
      ${productData.statusNote || null},
      ${Boolean(productData.isFeatured)},
      ${Boolean(productData.isActive)},
      ${productData.currency || "USD"},
      ${productData.buyUrl || null},
      ${Number(productData.sortOrder || 0)},
      ${Number(productData.displayOrder || productData.sortOrder || 0)},
      ${new Date()}
    )
    RETURNING
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
  `);

  if (!rows.length) {
    throw new Error("Raw product insert returned no rows");
  }

  return rows[0];
}

async function createProductWithFallbacks(
  productData: Omit<ProductFormData, "prices" | "features">,
  prices?: ProductFormData["prices"],
  features?: ProductFormData["features"]
) {
  const fullData = buildProductCreateData(productData, prices, features);

  try {
    return await prisma.product.create({
      data: fullData,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.warn("POST /api/admin/products full create schema mismatch, retrying with legacy fields only");
  }

  const {
    longDescription: _legacyLongDescription,
    technicalDescription: _legacyTechnicalDescription,
    featureSectionTitle: _legacyFeatureSectionTitle,
    statusNote: _legacyStatusNote,
    stockStatus: _legacyStockStatus,
    deliveryType: _legacyDeliveryType,
    estimatedDelivery: _legacyEstimatedDelivery,
    defaultLoaderUrl: _legacyDefaultLoaderUrl,
    displayOrder: _legacyDisplayOrder,
    ...legacyProductFields
  } = productData;

  try {
    return await prisma.product.create({
      data: {
        ...legacyProductFields,
        buyUrl: legacyProductFields.buyUrl || null,
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
      } as Prisma.ProductCreateInput,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.warn("POST /api/admin/products legacy create still mismatched, retrying with minimal base fields");
  }

  try {
    return await prisma.product.create({
      data: buildMinimalProductCreateData(productData),
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.warn("POST /api/admin/products minimal Prisma create still mismatched, retrying with raw SQL");
  }

  return createProductWithRawFallback(productData);
}

async function attachProductRelationsWithFallbacks(
  productId: string,
  prices?: ProductFormData["prices"],
  features?: ProductFormData["features"]
) {
  if (prices?.length) {
    try {
      await prisma.productPrice.createMany({
        data: prices.map((p) => ({
          productId,
          plan: p.plan,
          price: p.price,
        })),
      });
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        console.warn("POST /api/admin/products prices schema mismatch, skipping price attach");
      } else {
        throw error;
      }
    }
  }

  if (features?.length) {
    try {
      await prisma.productFeature.createMany({
        data: features.map((feature, index) => ({
          productId,
          title: feature.title,
          description: feature.description || null,
          icon: feature.icon || null,
          order: feature.order ?? index,
        })),
      });
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        console.warn("POST /api/admin/products features schema mismatch, skipping feature attach");
      } else {
        throw error;
      }
    }
  }
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
    const existing = await productSlugExists(productData.slug);
    if (existing) {
      return NextResponse.json({ error: "This slug is already in use", errors: { slug: "Slug already exists" } }, { status: 400 });
    }

    let product: any;
    try {
      product = await createProductWithFallbacks(productData, undefined, undefined);
      await attachProductRelationsWithFallbacks(product.id, prices, features);
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

    await createAuditLog({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      after: { name: product.name, slug: product.slug, status: product.status },
    });

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
