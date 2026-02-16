import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

// PATCH /api/admin/customers/[id] - Update customer role/status/password
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const { role, isActive, newPassword, mustChangePassword } = body;

    const existing = await prisma.customer.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const updateData: any = {};
    const changes: Record<string, any> = {};

    if (role !== undefined) {
      updateData.role = role;
      changes.role = { from: existing.role, to: role };
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      changes.isActive = { from: existing.isActive, to: isActive };
    }
    if (mustChangePassword !== undefined) {
      updateData.mustChangePassword = mustChangePassword;
      changes.mustChangePassword = { from: existing.mustChangePassword, to: mustChangePassword };
    }

    // Admin password reset
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
      updateData.mustChangePassword = true; // Force password change on next login
      changes.passwordReset = true;
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: updateData,
    });

    const action = newPassword ? "PASSWORD_RESET" : "UPDATE";
    await createAuditLog({
      userId: (session.user as any).id,
      action,
      entity: "Customer",
      entityId: params.id,
      before: { role: existing.role, isActive: existing.isActive },
      after: changes,
    });

    return NextResponse.json({ success: true, data: { id: updated.id, role: updated.role, isActive: updated.isActive } });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/customers/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const existing = await prisma.customer.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    await prisma.customer.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Customer",
      entityId: params.id,
      before: { username: existing.username, email: existing.email },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
