import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/products/[slug] - Public: tek ürün detay
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await prisma.product.findUnique({
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
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error("GET /api/products/[slug] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
