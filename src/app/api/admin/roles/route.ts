import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission, ALL_PERMISSIONS } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/roles
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "role.view");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: roles.map((r) => ({
        ...r,
        permissions: JSON.parse(r.permissions || "[]"),
      })),
      meta: { allPermissions: ALL_PERMISSIONS },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/roles
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "role.manage");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, label, permissions } = body;

    if (!name || !label) {
      return NextResponse.json({ success: false, error: "name and label required" }, { status: 400 });
    }

    // Validate permissions
    const validPerms = (permissions || []).filter((p: string) => (ALL_PERMISSIONS as readonly string[]).includes(p));

    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase().replace(/\s+/g, "_"),
        label,
        permissions: JSON.stringify(validPerms),
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "CREATE",
      entity: "Role",
      entityId: role.id,
      after: { name: role.name, label, permissions: validPerms },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { ...role, permissions: validPerms },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if ((error as any).code === "P2002") {
      return NextResponse.json({ success: false, error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
