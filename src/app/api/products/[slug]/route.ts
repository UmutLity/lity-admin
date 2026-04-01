import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isSchemaMismatchError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function withProductDefaults<T extends Record<string, any>>(product: T) {
  return {
    ...product,
    stockStatus: product.stockStatus || "IN_STOCK",
    deliveryType: product.deliveryType || "MANUAL",
    estimatedDelivery: product.estimatedDelivery || null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    let product: any = null;

    try {
      product = await prisma.product.findFirst({
        where: { slug: params.slug, isActive: true },
        include: {
          prices: { orderBy: { plan: "asc" } },
          images: {
            include: { media: true },
            orderBy: { order: "asc" },
          },
          changelogs: {
            include: {
              changelog: true,
            },
            orderBy: { changelog: { publishedAt: "desc" } },
            take: 5,
          },
          features: { orderBy: { order: "asc" } },
          gallery: { orderBy: { order: "asc" } },
          specifications: { orderBy: { order: "asc" } },
        },
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;

      console.warn("GET /api/products/[slug] schema mismatch fallback enabled");
      product = await prisma.product.findFirst({
        where: { slug: params.slug, isActive: true },
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
          changelogs: {
            include: {
              changelog: true,
            },
            orderBy: { changelog: { publishedAt: "desc" } },
            take: 5,
          },
          features: { orderBy: { order: "asc" } },
          gallery: { orderBy: { order: "asc" } },
          specifications: { orderBy: { order: "asc" } },
        },
      });
    }

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: withProductDefaults(product) });
  } catch (error) {
    console.error("GET /api/products/[slug] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
