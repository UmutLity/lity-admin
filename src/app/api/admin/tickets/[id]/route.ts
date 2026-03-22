import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]);
const ALLOWED_PRIORITY = new Set(["LOW", "NORMAL", "HIGH"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const status = typeof body.status === "string" ? body.status : undefined;
    const priority = typeof body.priority === "string" ? body.priority : undefined;
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;

    if (status && !ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    if (priority && !ALLOWED_PRIORITY.has(priority)) {
      return NextResponse.json({ success: false, error: "Invalid priority" }, { status: 400 });
    }

    const existing = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: params.id },
      data: {
        ...(status ? { status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null } : {}),
        ...(priority ? { priority } : {}),
        ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: status && status !== existing.status ? "TICKET_STATUS_CHANGE" : "UPDATE",
      entity: "SupportTicket",
      entityId: existing.id,
      before: {
        status: existing.status,
        priority: existing.priority,
        adminNotes: existing.adminNotes,
      },
      after: {
        status: updated.status,
        priority: updated.priority,
        adminNotes: updated.adminNotes,
      },
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

