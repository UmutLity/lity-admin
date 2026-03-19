import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/products/[id]/features
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const features = await prisma.productFeature.findMany({
      where: { productId: params.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, data: features });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products/[id]/features
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, icon, order } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const feature = await prisma.productFeature.create({
      data: {
        productId: params.id,
        title,
        description: description ?? null,
        icon: icon ?? null,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: feature });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/features
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { featureId, title, description, icon, order } = body;

    if (!featureId) {
      return NextResponse.json({ success: false, error: "featureId is required" }, { status: 400 });
    }

    const existing = await prisma.productFeature.findFirst({
      where: { id: featureId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });
    }

    const updateData: { title?: string; description?: string | null; icon?: string | null; order?: number } = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (order !== undefined) updateData.order = order;

    const feature = await prisma.productFeature.update({
      where: { id: featureId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: feature });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]/features
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { featureId } = body;

    if (!featureId) {
      return NextResponse.json({ success: false, error: "featureId is required" }, { status: 400 });
    }

    const existing = await prisma.productFeature.findFirst({
      where: { id: featureId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Feature not found" }, { status: 404 });
    }

    await prisma.productFeature.delete({ where: { id: featureId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
