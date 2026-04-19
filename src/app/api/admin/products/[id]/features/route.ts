import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

async function productExists(id: string) {
  try {
    const product = await prisma.product.findFirst({
      where: { id },
      select: { id: true },
    });
    return Boolean(product);
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${id} LIMIT 1`
  );
  return rows.length > 0;
}

type FeatureInput = {
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
};

function normalizeFeatureInput(raw: any, fallbackOrder = 0): FeatureInput {
  return {
    title: String(raw?.title || "").trim(),
    description: raw?.description ? String(raw.description) : null,
    icon: raw?.icon ? String(raw.icon) : null,
    order: Number(raw?.order ?? fallbackOrder) || 0,
  };
}

async function createFeatureWithFallback(productId: string, item: FeatureInput) {
  try {
    return await prisma.productFeature.create({
      data: {
        productId,
        title: item.title,
        description: item.description,
        icon: item.icon,
        order: item.order,
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    return await prisma.productFeature.create({
      data: {
        productId,
        title: item.title,
        description: item.description,
        order: item.order,
      } as any,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  try {
    const withIcon = await prisma.$queryRaw<Array<any>>(
      Prisma.sql`
        INSERT INTO "ProductFeature" (
          "id",
          "productId",
          "title",
          "description",
          "icon",
          "order",
          "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${productId},
          ${item.title},
          ${item.description},
          ${item.icon},
          ${item.order},
          ${new Date()}
        )
        RETURNING "id", "productId", "title", "description", "icon", "order", "createdAt"
      `
    );
    if (withIcon.length) return withIcon[0];
  } catch {}

  const withoutIcon = await prisma.$queryRaw<Array<any>>(
    Prisma.sql`
      INSERT INTO "ProductFeature" (
        "id",
        "productId",
        "title",
        "description",
        "order",
        "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${productId},
        ${item.title},
        ${item.description},
        ${item.order},
        ${new Date()}
      )
      RETURNING "id", "productId", "title", "description", "order", "createdAt"
    `
  );

  if (!withoutIcon.length) {
    throw new Error("Feature could not be created");
  }

  return { ...withoutIcon[0], icon: null };
}

// GET /api/admin/products/[id]/features
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    let features: any[] = [];
    try {
      features = await prisma.productFeature.findMany({
        where: { productId: params.id },
        orderBy: { order: "asc" },
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;

      try {
        features = await prisma.$queryRaw<Array<any>>(
          Prisma.sql`
            SELECT "id", "productId", "title", "description", "icon", "order", "createdAt"
            FROM "ProductFeature"
            WHERE "productId" = ${params.id}
            ORDER BY "order" ASC
          `
        );
      } catch {
        features = await prisma.$queryRaw<Array<any>>(
          Prisma.sql`
            SELECT "id", "productId", "title", "description", "order", "createdAt"
            FROM "ProductFeature"
            WHERE "productId" = ${params.id}
            ORDER BY "order" ASC
          `
        );
        features = features.map((item) => ({ ...item, icon: null }));
      }
    }

    return NextResponse.json({ success: true, data: features });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/admin/products/[id]/features error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products/[id]/features
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const exists = await productExists(params.id);
    if (!exists) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, icon, order, items } = body;

    if (Array.isArray(items)) {
      const normalized = items
        .map((item: any, index: number) => normalizeFeatureInput(item, index))
        .filter((item) => item.title.length > 0);

      if (normalized.length === 0) {
        return NextResponse.json({ success: false, error: "At least one valid feature item is required" }, { status: 400 });
      }

      const created: any[] = [];
      for (const item of normalized) {
        created.push(await createFeatureWithFallback(params.id, item));
      }

      return NextResponse.json({ success: true, data: created });
    }

    const single = normalizeFeatureInput({ title, description, icon, order }, 0);
    if (!single.title) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const feature = await createFeatureWithFallback(params.id, single);
    return NextResponse.json({ success: true, data: feature });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/products/[id]/features error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/features
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const body = await req.json();
    const { featureId, title, description, icon, order } = body;

    if (!featureId) {
      return NextResponse.json({ success: false, error: "featureId is required" }, { status: 400 });
    }

    const updateData: { title?: string; description?: string | null; icon?: string | null; order?: number } = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (order !== undefined) updateData.order = order;

    try {
      const existing = await prisma.productFeature.findFirst({
        where: { id: featureId, productId: params.id },
      });
      if (!existing) return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });

      const feature = await prisma.productFeature.update({
        where: { id: featureId },
        data: updateData,
      });
      return NextResponse.json({ success: true, data: feature });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
    }

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductFeature"
        SET
          "title" = COALESCE(${title ?? null}, "title"),
          "description" = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE "description" END,
          "order" = CASE WHEN ${order !== undefined} THEN ${Number(order || 0)} ELSE "order" END
        WHERE "id" = ${featureId} AND "productId" = ${params.id}
      `
    );

    const rows = await prisma.$queryRaw<Array<any>>(
      Prisma.sql`
        SELECT "id", "productId", "title", "description", "order"
        FROM "ProductFeature"
        WHERE "id" = ${featureId} AND "productId" = ${params.id}
        LIMIT 1
      `
    );
    if (!rows.length) return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...rows[0], icon: null } });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("PUT /api/admin/products/[id]/features error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]/features
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const body = await req.json();
    const { featureId } = body;

    if (!featureId) {
      return NextResponse.json({ success: false, error: "featureId is required" }, { status: 400 });
    }

    try {
      const existing = await prisma.productFeature.findFirst({
        where: { id: featureId, productId: params.id },
      });
      if (!existing) return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });
      await prisma.productFeature.delete({ where: { id: featureId } });
      return NextResponse.json({ success: true });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
    }

    const deleted = await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "ProductFeature" WHERE "id" = ${featureId} AND "productId" = ${params.id}`
    );
    if (!Number(deleted)) return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("DELETE /api/admin/products/[id]/features error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
