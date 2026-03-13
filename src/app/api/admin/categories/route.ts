import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/categories
export async function GET() {
  try {
    await requireAuth();
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    // Count products per category
    const products = await prisma.product.groupBy({
      by: ["category"],
      _count: { id: true },
    });
    const countMap: Record<string, number> = {};
    products.forEach((p) => { countMap[p.category] = p._count.id; });

    const data = categories.map((c) => ({
      ...c,
      productCount: countMap[c.name] || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/categories
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const hasPerm = await hasPermission(userId, "category.create", userRole);
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, icon, color, sortOrder } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const slug = name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");

    // Check duplicate
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: name.trim().toUpperCase() }, { slug }] },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Category already exists" }, { status: 409 });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim().toUpperCase(),
        slug,
        icon: icon || null,
        color: color || "#7c3aed",
        sortOrder: sortOrder || 0,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "CREATE",
      entity: "Category",
      entityId: category.id,
      after: category,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("Category create error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
