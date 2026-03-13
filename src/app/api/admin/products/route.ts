import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";

// GET /api/admin/products - Admin: all products
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

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

    const products = await prisma.product.findMany({
      where,
      include: {
        prices: { orderBy: { plan: "asc" } },
        images: { include: { media: true }, orderBy: { order: "asc" } },
        _count: { select: { changelogs: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: products });
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
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();

    const validation = productSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const { prices, ...productData } = validation.data;

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({ where: { slug: productData.slug } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already in use", errors: { slug: "Slug already exists" } }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        ...productData,
        buyUrl: productData.buyUrl || null,
        prices: prices?.length
          ? { create: prices.map((p) => ({ plan: p.plan, price: p.price })) }
          : undefined,
      },
      include: { prices: true },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      after: { name: product.name, slug: product.slug, status: product.status },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
