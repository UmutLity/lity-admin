import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission, ALL_PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// PUT /api/admin/roles/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "role.manage");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const existing = await prisma.role.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });

    const body = await req.json();
    const { label, permissions } = body;

    const validPerms = (permissions || []).filter((p: string) => (ALL_PERMISSIONS as readonly string[]).includes(p));

    const updated = await prisma.role.update({
      where: { id: params.id },
      data: {
        label: label || existing.label,
        permissions: JSON.stringify(validPerms),
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "UPDATE",
      entity: "Role",
      entityId: params.id,
      before: { label: existing.label, permissions: JSON.parse(existing.permissions || "[]") },
      after: { label: updated.label, permissions: validPerms },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { ...updated, permissions: validPerms },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/roles/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "role.manage");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const existing = await prisma.role.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });

    if (existing.isSystem) {
      return NextResponse.json({ success: false, error: "Cannot delete system role" }, { status: 400 });
    }

    // Remove role from users first
    await prisma.user.updateMany({
      where: { roleId: params.id },
      data: { roleId: null },
    });

    await prisma.role.delete({ where: { id: params.id } });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "DELETE",
      entity: "Role",
      entityId: params.id,
      before: { name: existing.name, label: existing.label },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
