import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { trackAdminEvent } from "@/lib/admin-events";
import { hash } from "bcryptjs";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["FOUNDER", "ADMIN", "EDITOR", "VIEWER", "MODERATOR", "SUPPORT", "ANALYST"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PUT /api/admin/users/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const data: any = { ...validation.data };
    if (data.password) {
      data.password = await hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    const roleChanged = existing.role !== user.role;
    const activeChanged = existing.isActive !== user.isActive;

    await trackAdminEvent({
      userId: (session.user as any).id,
      action: roleChanged ? "ROLE_CHANGE" : "UPDATE",
      entity: "User",
      entityId: user.id,
      before: { name: existing.name, role: existing.role, isActive: existing.isActive },
      after: { name: user.name, role: user.role, isActive: user.isActive },
      alert: roleChanged || activeChanged
        ? {
            type: "SECURITY",
            severity: !user.isActive ? "CRITICAL" : "WARNING",
            title: roleChanged ? `User role changed: ${user.email}` : `User status changed: ${user.email}`,
            message: roleChanged
              ? `${existing.role} -> ${user.role}`
              : `Active state: ${existing.isActive ? "active" : "inactive"} -> ${user.isActive ? "active" : "inactive"}`,
            meta: {
              targetUserId: user.id,
              targetEmail: user.email,
              fromRole: existing.role,
              toRole: user.role,
              fromActive: existing.isActive,
              toActive: user.isActive,
            },
          }
        : undefined,
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const currentUserId = (session.user as any).id;

    if (currentUserId === params.id) {
      return NextResponse.json(
        { error: "Kendinizi silemezsiniz" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.$transaction([
      // bağlı kayıtları temizle
      prisma.auditLog.deleteMany({ where: { userId: params.id } }),
      prisma.adminSession.deleteMany({ where: { userId: params.id } }),
      prisma.loginAttempt.deleteMany({ where: { userId: params.id } }),
      prisma.accountLock.deleteMany({ where: { userId: params.id } }),

      // en son user sil
      prisma.user.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
