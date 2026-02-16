import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/products/[id]/specifications
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const specifications = await prisma.productSpecification.findMany({
      where: { productId: params.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, data: specifications });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products/[id]/specifications
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { label, value, order } = body;

    if (!label || !value) {
      return NextResponse.json({ success: false, error: "Label and value are required" }, { status: 400 });
    }

    const spec = await prisma.productSpecification.create({
      data: {
        productId: params.id,
        label,
        value,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: spec });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/specifications
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { specId, label, value, order } = body;

    if (!specId) {
      return NextResponse.json({ success: false, error: "specId is required" }, { status: 400 });
    }

    const existing = await prisma.productSpecification.findFirst({
      where: { id: specId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Specification not found" }, { status: 404 });
    }

    const updateData: { label?: string; value?: string; order?: number } = {};
    if (label !== undefined) updateData.label = label;
    if (value !== undefined) updateData.value = value;
    if (order !== undefined) updateData.order = order;

    const spec = await prisma.productSpecification.update({
      where: { id: specId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: spec });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]/specifications
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { specId } = body;

    if (!specId) {
      return NextResponse.json({ success: false, error: "specId is required" }, { status: 400 });
    }

    const existing = await prisma.productSpecification.findFirst({
      where: { id: specId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Specification not found" }, { status: 404 });
    }

    await prisma.productSpecification.delete({ where: { id: specId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
