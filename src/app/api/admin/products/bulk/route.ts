import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

type BulkAction = "FEATURE" | "UNFEATURE" | "ACTIVATE" | "DEACTIVATE" | "ARCHIVE" | "SET_STATUS";

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "EDITOR"]);
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0) : [];
    const action = String(body.action || "").toUpperCase() as BulkAction;
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    const statusNote = typeof body.statusNote === "string" ? body.statusNote.trim() : null;

    if (!ids.length) {
      return NextResponse.json({ success: false, error: "Select at least one product" }, { status: 400 });
    }

    if (!["FEATURE", "UNFEATURE", "ACTIVATE", "DEACTIVATE", "ARCHIVE", "SET_STATUS"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid bulk action" }, { status: 400 });
    }

    let result;
    if (action === "FEATURE") {
      result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isFeatured: true } });
    } else if (action === "UNFEATURE") {
      result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isFeatured: false } });
    } else if (action === "ACTIVATE") {
      result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
    } else if (action === "DEACTIVATE") {
      result = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
    } else if (action === "ARCHIVE") {
      result = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: {
          isActive: false,
          isFeatured: false,
          status: "DISCONTINUED",
          statusNote: statusNote || "Archived from bulk tools",
          lastStatusChangeAt: new Date(),
        },
      });
    } else {
      if (!status) {
        return NextResponse.json({ success: false, error: "status is required for SET_STATUS" }, { status: 400 });
      }
      result = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: {
          status,
          statusNote,
          lastStatusChangeAt: new Date(),
        },
      });
    }

    await createAuditLog({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "Product",
      entityId: ids.join(","),
      after: { ids, action, status: status || null, statusNote },
    }).catch(() => {});

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("PATCH /api/admin/products/bulk error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
