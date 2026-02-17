import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "EDITOR"]).optional(),
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

    await createAuditLog({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      before: { name: existing.name, role: existing.role, isActive: existing.isActive },
      after: { name: user.name, role: user.role, isActive: user.isActive },
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
