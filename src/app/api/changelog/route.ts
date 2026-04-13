import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/changelog - Public: yayınlanmış changelog'lar
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
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 50);
    const q = (searchParams.get("q") || "").trim();
    const type = (searchParams.get("type") || "").trim();
    const product = (searchParams.get("product") || "").trim();

    const where: any = { isDraft: false, publishedAt: { not: null, lte: new Date() } };
    if (type) where.type = type.toUpperCase();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ];
    }
    if (product) {
      where.products = {
        some: {
          product: {
            OR: [
              { slug: { equals: product, mode: "insensitive" } },
              { name: { contains: product, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [changelogs, total] = await Promise.all([
      prisma.changelog.findMany({
        where,
        include: {
          products: {
            include: { product: { select: { id: true, name: true, slug: true } } },
          },
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.changelog.count({
        where,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: changelogs,
      meta: { total, page, pageSize },
    });
  } catch (error) {
    console.error("GET /api/changelog error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
