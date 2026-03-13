import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// DELETE /api/admin/security/locks - Unlock account
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.manage");
    if (!hasPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { lockId } = await req.json();
    if (!lockId) {
      return NextResponse.json({ success: false, error: "lockId required" }, { status: 400 });
    }

    const lock = await prisma.accountLock.findUnique({
      where: { id: lockId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!lock) {
      return NextResponse.json({ success: false, error: "Lock not found" }, { status: 404 });
    }

    // Set lockedUntil to now (effectively unlocking)
    await prisma.accountLock.update({
      where: { id: lockId },
      data: { lockedUntil: new Date() },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "UNLOCK",
      entity: "Security",
      entityId: lock.userId,
      after: { email: lock.user.email, unlockedBy: userId },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/admin/security/locks error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
