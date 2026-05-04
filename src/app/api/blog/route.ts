import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "9", 10), 1), 50);
    const q = (searchParams.get("q") || "").trim();
    const featuredOnly = searchParams.get("featured") === "true";

    const where: any = {
      isDraft: false,
      publishedAt: { not: null },
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { authorName: { contains: q, mode: "insensitive" } },
      ];
    }

    if (featuredOnly) {
      where.OR = [
        ...(where.OR || []),
        { title: { contains: "guide", mode: "insensitive" } },
        { title: { contains: "tutorial", mode: "insensitive" } },
        { excerpt: { contains: "guide", mode: "insensitive" } },
        { excerpt: { contains: "tutorial", mode: "insensitive" } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          content: true,
          coverImageUrl: true,
          authorName: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: posts, meta: { total, page, pageSize } });
  } catch (error) {
    console.error("GET /api/blog error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
