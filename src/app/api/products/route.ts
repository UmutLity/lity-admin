import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/products - Public: aktif ürünler
export async function GET(req: NextRequest) {
  try {
    // Check public API pause
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
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

    const products = await prisma.product.findMany({
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

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
