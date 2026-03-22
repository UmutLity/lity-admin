import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]);
const ALLOWED_PRIORITY = new Set(["LOW", "NORMAL", "HIGH"]);

function safeParseMeta(meta: string | null) {
  if (!meta) return {};
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

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

    // Fallback records are stored in admin notifications (id starts with fallback-).
    if (params.id.startsWith("fallback-")) {
      const notificationId = params.id.replace("fallback-", "");
      const notification = await prisma.adminNotification.findUnique({ where: { id: notificationId } });
      if (!notification) {
        return NextResponse.json({ success: false, error: "Fallback ticket not found" }, { status: 404 });
      }

      const currentMeta: any = safeParseMeta(notification.meta);
      const updatedMeta = {
        ...currentMeta,
        status: status || currentMeta.status || "OPEN",
        priority: priority || currentMeta.priority || "NORMAL",
        adminNotes: adminNotes !== undefined ? adminNotes : (currentMeta.adminNotes || null),
        lastAdminUpdateAt: new Date().toISOString(),
        fallback: true,
      };

      const updatedNotification = await prisma.adminNotification.update({
        where: { id: notificationId },
        data: {
          meta: JSON.stringify(updatedMeta),
          message: currentMeta.subject
            ? `${currentMeta.subject} from ${currentMeta.email || currentMeta.discordUsername || "unknown contact"}`
            : notification.message,
        },
      });

      await createAuditLog({
        userId: (session.user as any).id,
        action: "UPDATE",
        entity: "SupportTicket",
        entityId: params.id,
        before: {
          status: currentMeta.status || "OPEN",
          priority: currentMeta.priority || "NORMAL",
          adminNotes: currentMeta.adminNotes || null,
        },
        after: {
          status: updatedMeta.status,
          priority: updatedMeta.priority,
          adminNotes: updatedMeta.adminNotes,
        },
        ip: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: params.id,
          isFallback: true,
          ticketNumber: updatedMeta.ticketNumber || 0,
          subject: updatedMeta.subject || updatedNotification.title,
          message: updatedMeta.message || updatedNotification.message,
          status: updatedMeta.status,
          priority: updatedMeta.priority,
          adminNotes: updatedMeta.adminNotes,
          contactType: updatedMeta.contactType || "DISCORD",
          email: updatedMeta.email || null,
          discordUsername: updatedMeta.discordUsername || null,
          createdAt: updatedNotification.createdAt,
          updatedAt: updatedNotification.updatedAt,
        },
      });
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
