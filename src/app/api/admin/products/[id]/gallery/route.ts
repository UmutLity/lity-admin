import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/products/[id]/gallery
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const images = await prisma.productGalleryImage.findMany({
      where: { productId: params.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, data: images });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/products/[id]/gallery
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const body = await req.json();
    const { url, altText, order, isThumbnail } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    const image = await prisma.productGalleryImage.create({
      data: {
        productId: params.id,
        url,
        altText: altText ?? null,
        order: order ?? 0,
        isThumbnail: isThumbnail ?? false,
      },
    });

    return NextResponse.json({ success: true, data: image });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/products/[id]/gallery
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { imageId, altText, order, isThumbnail } = body;

    if (!imageId) {
      return NextResponse.json({ success: false, error: "imageId is required" }, { status: 400 });
    }

    const existing = await prisma.productGalleryImage.findFirst({
      where: { id: imageId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
    }

    const updateData: { altText?: string | null; order?: number; isThumbnail?: boolean } = {};
    if (altText !== undefined) updateData.altText = altText;
    if (order !== undefined) updateData.order = order;
    if (isThumbnail !== undefined) updateData.isThumbnail = isThumbnail;

    const image = await prisma.productGalleryImage.update({
      where: { id: imageId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: image });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]/gallery
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json({ success: false, error: "imageId is required" }, { status: 400 });
    }

    const existing = await prisma.productGalleryImage.findFirst({
      where: { id: imageId, productId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 });
    }

    await prisma.productGalleryImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
