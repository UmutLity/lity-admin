import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/security/sessions
export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const sessions = await prisma.adminSession.findMany({
      where: { revokedAt: null },
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { lastSeenAt: "desc" },
    });
    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/security/sessions - Revoke session(s)
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const userId = (session.user as any).id;
    const body = await req.json();
    const { sessionId, revokeAllForUser } = body;

    if (revokeAllForUser) {
      await prisma.adminSession.updateMany({
        where: { userId: revokeAllForUser, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (sessionId) {
      await prisma.adminSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "DELETE",
      entity: "AdminSession",
      after: { sessionId, revokeAllForUser },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
