import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// PUT /api/admin/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const hasPerm = await hasPermission(userId, "category.update", userRole);
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const category = await prisma.category.findUnique({ where: { id: params.id } });
    if (!category) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { name, icon, color, sortOrder, isActive } = body;

    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim().toUpperCase();
      updateData.slug = name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    }
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: updateData,
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "UPDATE",
      entity: "Category",
      entityId: params.id,
      before: category,
      after: updated,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/categories/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const hasPerm = await hasPermission(userId, "category.delete", userRole);
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const category = await prisma.category.findUnique({ where: { id: params.id } });
    if (!category) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Check if products use this category
    const productCount = await prisma.product.count({ where: { category: category.name } });
    if (productCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete: ${productCount} products use this category. Reassign them first.`,
      }, { status: 400 });
    }

    await prisma.category.delete({ where: { id: params.id } });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "DELETE",
      entity: "Category",
      entityId: params.id,
      before: category,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
