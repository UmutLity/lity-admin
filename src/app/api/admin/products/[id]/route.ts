import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
import { diffObjects } from "@/lib/audit";
import { trackAdminEvent } from "@/lib/admin-events";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
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

async function productSlugExists(slug: string, excludeId?: string) {
  try {
    const row = await prisma.product.findFirst({
      where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
      select: { id: true },
    });
    return Boolean(row);
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = excludeId
    ? await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Product" WHERE "slug" = ${slug} AND "id" <> ${excludeId} LIMIT 1`
      )
    : await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Product" WHERE "slug" = ${slug} LIMIT 1`
      );
  return rows.length > 0;
}

async function clearOtherFeaturedProducts(excludeId: string) {
  try {
    await prisma.product.updateMany({
      where: { isFeatured: true, NOT: { id: excludeId } },
      data: { isFeatured: false },
    });
    return;
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.warn("PUT /api/admin/products/[id]: featured cleanup schema mismatch, retrying raw SQL");
  }

  await prisma.$executeRaw(
    Prisma.sql`UPDATE "Product" SET "isFeatured" = false WHERE "isFeatured" = true AND "id" <> ${excludeId}`
  );
}

function buildMinimalProductUpdateData(productData: Omit<ProductFormData, "prices" | "features">) {
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

async function updateProductCoreWithFallbacks(
  id: string,
  productData: Omit<ProductFormData, "prices" | "features">,
  statusChanged: boolean
) {
  try {
    return await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        buyUrl: productData.buyUrl || null,
        accessRoleKey: null,
        defaultLoaderUrl: productData.defaultLoaderUrl || null,
        estimatedDelivery: productData.estimatedDelivery || null,
        ...(statusChanged ? { lastStatusChangeAt: new Date() } : {}),
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    return await prisma.product.update({
      where: { id },
      data: {
        name: productData.name,
        slug: productData.slug,
        shortDescription: productData.shortDescription || null,
        description: productData.description || null,
        longDescription: productData.longDescription || null,
        technicalDescription: productData.technicalDescription || null,
        featureSectionTitle: productData.featureSectionTitle || null,
        category: productData.category,
        status: productData.status,
        statusNote: productData.statusNote || null,
        isFeatured: Boolean(productData.isFeatured),
        isActive: Boolean(productData.isActive),
        currency: productData.currency || "USD",
        buyUrl: productData.buyUrl || null,
        sortOrder: Number(productData.sortOrder || 0),
        displayOrder: Number(productData.displayOrder || productData.sortOrder || 0),
        ...(statusChanged ? { lastStatusChangeAt: new Date() } : {}),
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    return await prisma.product.update({
      where: { id },
      data: buildMinimalProductUpdateData(productData),
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<Record<string, any>>>(
    Prisma.sql`
      UPDATE "Product"
      SET
        "name" = ${productData.name},
        "slug" = ${productData.slug},
        "shortDescription" = ${productData.shortDescription || null},
        "description" = ${productData.description || null},
        "category" = ${productData.category},
        "status" = ${productData.status},
        "isFeatured" = ${Boolean(productData.isFeatured)},
        "isActive" = ${Boolean(productData.isActive)},
        "currency" = ${productData.currency || "USD"},
        "buyUrl" = ${productData.buyUrl || null},
        "sortOrder" = ${Number(productData.sortOrder || 0)},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
      RETURNING "id", "name", "slug", "status"
    `
  );

  if (!rows.length) {
    throw new Error("Product update failed");
  }

  return rows[0];
}

async function syncProductRelationsWithFallbacks(
  productId: string,
  prices?: ProductFormData["prices"],
  features?: ProductFormData["features"]
) {
  try {
    await prisma.productPrice.deleteMany({ where: { productId } });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  if (prices?.length) {
    try {
      await prisma.productPrice.createMany({
        data: prices.map((p) => ({ productId, plan: p.plan, price: p.price })),
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
    }
  }

  try {
    await prisma.productFeature.deleteMany({ where: { productId } });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
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
      if (!isSchemaMismatchError(error)) throw error;
    }
  }
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

async function hardDeleteProductWithRelations(id: string) {
  const safe = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        console.warn(`DELETE /api/admin/products/[id]: skipped ${label} due to schema mismatch`);
        return;
      }
      throw error;
    }
  };

  // Run cleanup steps outside a single DB transaction.
  // This prevents one legacy-table mismatch from poisoning the whole delete flow.
  await safe("order items", () => prisma.orderItem.deleteMany({ where: { productId: id } }));
  await safe("licenses", () => prisma.license.deleteMany({ where: { productId: id } }));
  await safe("reseller sales", () => prisma.resellerSale.deleteMany({ where: { productId: id } }));
  await safe("cart items", () => prisma.cartItem.deleteMany({ where: { productId: id } }));
  await safe("favorites", () => prisma.favoriteProduct.deleteMany({ where: { productId: id } }));
  await safe("changelog relations", () => prisma.changelogProduct.deleteMany({ where: { productId: id } }));
  await safe("product images", () => prisma.productImage.deleteMany({ where: { productId: id } }));
  await safe("gallery", () => prisma.productGalleryImage.deleteMany({ where: { productId: id } }));
  await safe("specifications", () => prisma.productSpecification.deleteMany({ where: { productId: id } }));
  await safe("features", () => prisma.productFeature.deleteMany({ where: { productId: id } }));
  await safe("prices", () => prisma.productPrice.deleteMany({ where: { productId: id } }));
  await safe("status history", () => prisma.statusHistory.deleteMany({ where: { productId: id } }));
  await safe("environments", () => prisma.productEnvironment.deleteMany({ where: { productId: id } }));
  await safe("guides", () => prisma.guide.deleteMany({ where: { productId: id } }));

  await safe("support tickets unlink", () =>
    prisma.supportTicket.updateMany({
      where: { productId: id },
      data: { productId: null },
    })
  );
  await safe("reviews unlink", () =>
    prisma.review.updateMany({
      where: { productId: id },
      data: { productId: null },
    })
  );

  await safe("dynamic fk cleanup", () => cleanupLegacyProductForeignKeys(id));

  await prisma.product.delete({ where: { id } });
}

function quoteIdent(identifier: string) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

async function cleanupLegacyProductForeignKeys(productId: string) {
  const refs = await prisma.$queryRaw<
    Array<{
      table_schema: string;
      table_name: string;
      column_name: string;
      is_nullable: "YES" | "NO";
    }>
  >(Prisma.sql`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      cols.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = tc.table_schema
      AND cols.table_name = tc.table_name
      AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'Product'
      AND ccu.column_name = 'id'
      AND tc.table_name <> 'Product'
  `);

  for (const ref of refs) {
    const schema = quoteIdent(ref.table_schema);
    const table = quoteIdent(ref.table_name);
    const column = quoteIdent(ref.column_name);

    try {
      if (ref.is_nullable === "YES") {
        await prisma.$executeRawUnsafe(
          `UPDATE ${schema}.${table} SET ${column} = NULL WHERE ${column} = $1`,
          productId
        );
      } else {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${schema}.${table} WHERE ${column} = $1`,
          productId
        );
      }
    } catch (error) {
      console.warn("cleanupLegacyProductForeignKeys skipped relation cleanup step", {
        table: `${ref.table_schema}.${ref.table_name}`,
        column: ref.column_name,
        error,
      });
    }
  }
}

async function archiveProductFallback(id: string) {
  try {
    await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        status: "DISCONTINUED",
      },
    });
    return true;
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      UPDATE "Product"
      SET "isActive" = false, "status" = 'DISCONTINUED', "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
      RETURNING "id"
    `
  );
  return rows.length > 0;
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

    const existing = await findProductDetailBase(params.id);

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { prices, features, ...productData } = validation.data;

    // Check slug uniqueness if changed
    if (productData.slug !== existing.slug) {
      const slugExists = await productSlugExists(productData.slug, params.id);
      if (slugExists) {
        return NextResponse.json({ error: "This slug is already in use", errors: { slug: "This slug already exists" } }, { status: 400 });
      }
    }

    // Check if status changed
    const statusChanged = productData.status !== existing.status;

    if (productData.isFeatured) {
      await clearOtherFeaturedProducts(params.id);
    }

    const product = await updateProductCoreWithFallbacks(params.id, productData, statusChanged);
    await syncProductRelationsWithFallbacks(params.id, prices, features);

    const diff = diffObjects(
      { name: existing.name, slug: existing.slug, status: existing.status },
      { name: product.name, slug: product.slug, status: product.status }
    );

    await trackAdminEvent({
      userId: (session.user as any).id,
      action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
      entity: "Product",
      entityId: product.id,
      before: diff.before,
      after: diff.after,
      alert: {
        type: statusChanged ? "STATUS" : "SYSTEM",
        severity: statusChanged ? "WARNING" : "INFO",
        title: statusChanged ? `Product status changed: ${product.name}` : `Product updated: ${product.name}`,
        message: statusChanged
          ? `${existing.status} -> ${product.status}`
          : `${product.name} details and pricing were updated.`,
        meta: {
          productId: product.id,
          productSlug: product.slug,
          statusChanged,
          hasPrices: Array.isArray(prices) && prices.length > 0,
        },
      },
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

    await hardDeleteProductWithRelations(params.id);

    await trackAdminEvent({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Product",
      entityId: params.id,
      before: { name: product.name, slug: product.slug, isActive: product.isActive, status: product.status },
      after: null,
      alert: {
        type: "SYSTEM",
        severity: "WARNING",
        title: `Product deleted: ${product.name}`,
        message: `${product.name} and related product data were permanently removed.`,
        meta: {
          productId: params.id,
          previousStatus: product.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      mode: "deleted",
      message: "Product deleted successfully.",
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const archived = await archiveProductFallback(params.id);
      if (archived) {
        return NextResponse.json({
          success: true,
          mode: "archived",
          message: "Hard delete failed due to linked data. Product archived instead.",
        });
      }
    } catch (archiveError) {
      console.error("DELETE /api/admin/products/[id] archive fallback failed:", archiveError);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error: "Product could not be deleted because linked records still exist. Please run latest DB migrations and try again.",
          code: "PRODUCT_DELETE_BLOCKED",
        },
        { status: 409 }
      );
    }
    console.error("DELETE /api/admin/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
