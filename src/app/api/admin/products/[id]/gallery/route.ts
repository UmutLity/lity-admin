import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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

async function createGalleryImageWithFallback(
  productId: string,
  data: { url: string; altText?: string | null; order?: number; isThumbnail?: boolean }
) {
  try {
    return await prisma.productGalleryImage.create({
      data: {
        productId,
        url: data.url,
        altText: data.altText ?? null,
        order: data.order ?? 0,
        isThumbnail: data.isThumbnail ?? false,
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; productId: string; url: string; altText: string | null; order: number; isThumbnail: boolean }>>(
    Prisma.sql`
      INSERT INTO "ProductGalleryImage" (
        "id",
        "productId",
        "url",
        "altText",
        "order",
        "isThumbnail"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${productId},
        ${data.url},
        ${data.altText ?? null},
        ${Number(data.order ?? 0)},
        ${Boolean(data.isThumbnail ?? false)}
      )
      RETURNING "id", "productId", "url", "altText", "order", "isThumbnail"
    `
  );

  if (!rows.length) {
    throw new Error("Gallery image could not be created");
  }

  return rows[0];
}

async function createLegacyProductImageFallback(
  productId: string,
  data: { url: string; order?: number }
) {
  const mediaRows = await prisma.$queryRaw<Array<{ id: string; url: string }>>(
    Prisma.sql`
      INSERT INTO "Media" (
        "id",
        "filename",
        "url",
        "mimeType",
        "size"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${`product-${Date.now()}`},
        ${data.url},
        ${"image/remote"},
        ${0}
      )
      RETURNING "id", "url"
    `
  );

  if (!mediaRows.length) {
    throw new Error("Legacy media record could not be created");
  }

  const media = mediaRows[0];
  const imageRows = await prisma.$queryRaw<Array<{ id: string; productId: string; mediaId: string; order: number }>>(
    Prisma.sql`
      INSERT INTO "ProductImage" (
        "id",
        "productId",
        "mediaId",
        "order"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${productId},
        ${media.id},
        ${Number(data.order ?? 0)}
      )
      RETURNING "id", "productId", "mediaId", "order"
    `
  );

  if (!imageRows.length) {
    throw new Error("Legacy product image could not be created");
  }

  return {
    ...imageRows[0],
    url: media.url,
    altText: null,
    isThumbnail: Boolean((data.order ?? 0) === 0),
    legacy: true,
  };
}

// GET /api/admin/products/[id]/gallery
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    let images: any[] = [];
    try {
      images = await prisma.productGalleryImage.findMany({
        where: { productId: params.id },
        orderBy: { order: "asc" },
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
      try {
        images = await prisma.$queryRaw<Array<any>>(
          Prisma.sql`SELECT "id", "productId", "url", "altText", "order", "isThumbnail" FROM "ProductGalleryImage" WHERE "productId" = ${params.id} ORDER BY "order" ASC`
        );
      } catch {
        images = await prisma.$queryRaw<Array<any>>(
          Prisma.sql`
            SELECT
              pi."id",
              pi."productId",
              m."url",
              NULL::TEXT as "altText",
              pi."order",
              CASE WHEN pi."order" = 0 THEN true ELSE false END as "isThumbnail"
            FROM "ProductImage" pi
            INNER JOIN "Media" m ON m."id" = pi."mediaId"
            WHERE pi."productId" = ${params.id}
            ORDER BY pi."order" ASC
          `
        );
      }
    }

    return NextResponse.json({ success: true, data: images });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/admin/products/[id]/gallery error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products/[id]/gallery
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const exists = await productExists(params.id);
    if (!exists) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { url, altText, order, isThumbnail } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    let image: any;
    try {
      image = await createGalleryImageWithFallback(params.id, {
        url,
        altText,
        order,
        isThumbnail,
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
      image = await createLegacyProductImageFallback(params.id, {
        url,
        order,
      });
    }

    return NextResponse.json({ success: true, data: image });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/products/[id]/gallery error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/gallery
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const body = await req.json();
    const { imageId, altText, order, isThumbnail } = body;

    if (!imageId) {
      return NextResponse.json({ success: false, error: "imageId is required" }, { status: 400 });
    }

    const existing = await prisma.productGalleryImage.findFirst({
      where: { id: imageId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
    }

    const updateData: { altText?: string | null; order?: number; isThumbnail?: boolean } = {};
    if (altText !== undefined) updateData.altText = altText;
    if (order !== undefined) updateData.order = order;
    if (isThumbnail !== undefined) updateData.isThumbnail = isThumbnail;

    const image = await prisma.productGalleryImage.update({
      where: { id: imageId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: image });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]/gallery
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);

    const body = await req.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json({ success: false, error: "imageId is required" }, { status: 400 });
    }

    try {
      const existing = await prisma.productGalleryImage.findFirst({
        where: { id: imageId, productId: params.id },
      });

      if (!existing) {
        return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
      }

      await prisma.productGalleryImage.delete({ where: { id: imageId } });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;

      const legacyRows = await prisma.$queryRaw<Array<{ id: string; mediaId: string }>>(
        Prisma.sql`SELECT "id", "mediaId" FROM "ProductImage" WHERE "id" = ${imageId} AND "productId" = ${params.id} LIMIT 1`
      );
      const legacy = legacyRows[0];
      if (!legacy) {
        return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
      }

      await prisma.$executeRaw(Prisma.sql`DELETE FROM "ProductImage" WHERE "id" = ${imageId}`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "Media" WHERE "id" = ${legacy.mediaId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("DELETE /api/admin/products/[id]/gallery error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
