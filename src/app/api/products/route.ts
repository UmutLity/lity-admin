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

export async function GET(req: NextRequest) {
  try {
    let isPaused = false;
    try {
      const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
      isPaused = apiPause?.value === "true";
    } catch {
      console.warn("GET /api/products: siteSetting lookup failed, skipping pause check");
    }

    if (isPaused) {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (featured === "true") where.isFeatured = true;

    let products: any[] = [];

    try {
      products = await prisma.product.findMany({
        where,
        include: {
          prices: { orderBy: { plan: "asc" } },
          images: {
            include: { media: true },
            orderBy: { order: "asc" },
          },
          features: { orderBy: { order: "asc" } },
          gallery: { orderBy: { order: "asc" } },
          specifications: { orderBy: { order: "asc" } },
        },
        orderBy: { sortOrder: "asc" },
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;

      console.warn("GET /api/products schema mismatch fallback enabled");
      products = await prisma.product.findMany({
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
          features: { orderBy: { order: "asc" } },
          gallery: { orderBy: { order: "asc" } },
          specifications: { orderBy: { order: "asc" } },
        },
        orderBy: { sortOrder: "asc" },
      });
    }

    return NextResponse.json({ success: true, data: products.map(withProductDefaults) });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
